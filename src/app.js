const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

// تحميل المتغيرات البيئية
dotenv.config();

// استيراد التهيئات
const config = require('./config');
const database = require('./config/database');
const firebaseService = require('./config/firebase');
const { errorHandler } = require('./core/middleware/errorHandler');
const { rateLimiter } = require('./core/middleware/rateLimiter');
const logger = require('./core/utils/logger');

class App {
  constructor() {
    this.app = express();
    this.server = null;
  }

  async initialize() {
    try {
      logger.info('🔍 Starting application initialization...');
      logger.info(`🔍 Node.js version: ${process.version}`);

      // تهيئة Firebase مع تتبع
      try {
        logger.info('🔍 Initializing Firebase...');
        firebaseService.initialize();
        logger.info(`🔍 Firebase initialized: ${firebaseService.isInitialized()}`);
      } catch (fbError) {
        logger.error('❌ Firebase initialization failed:', fbError.message);
        logger.error('📝 Stack:', fbError.stack);
      }

      // الاتصال بقاعدة البيانات
      logger.info('🔍 Connecting to MongoDB...');
      await database.connect();
      logger.info('✅ MongoDB connected successfully');

      // إعداد الـ Middleware
      logger.info('🔍 Setting up middleware...');
      this.setupMiddleware();

      // إعداد الـ Routes
      logger.info('🔍 Setting up routes...');
      this.setupRoutes();

      // إعداد معالجة الأخطاء
      this.setupErrorHandling();

      logger.info('✅ Application initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize application:', error);
      logger.error('📝 Stack:', error.stack);
      throw error;
    }
  }

  setupMiddleware() {
    // الأمان
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.security.corsOrigin || '*',
      credentials: true,
    }));

    // معالجة الطلبات
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // الضغط
    this.app.use(compression());

    // التسجيل
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.http(message.trim())
        }
      }));
    }

    // تحديد سرعة الطلبات
    this.app.use(rateLimiter);

    // الملفات الثابتة
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    this.app.use('/public', express.static(path.join(__dirname, '../public')));

    // فحص الصحة
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  setupRoutes() {
    // API Versioning
    const apiV1 = express.Router();

    // ===== Import All Routes =====
    const routes = [
      { name: 'users', path: './modules/users/routes/UserRoutes' },
      { name: 'companies', path: './modules/companies/routes/CompanyRoutes' },
      { name: 'factories', path: './modules/factories/routes/FactoryRoutes' },
      { name: 'departments', path: './modules/departments/routes/DepartmentRoutes' },
      { name: 'machines', path: './modules/machines/routes/MachineRoutes' },
      { name: 'sensors', path: './modules/sensors/routes/SensorRoutes' },
      { name: 'sensor-readings', path: './modules/sensorReadings/routes/SensorReadingRoutes' },
      { name: 'carbon', path: './modules/carbon/routes/CarbonRoutes' },
      { name: 'energy', path: './modules/energy/routes/EnergyRoutes' },
      { name: 'water', path: './modules/water/routes/WaterRoutes' },
      { name: 'waste', path: './modules/waste/routes/WasteRoutes' },
      { name: 'alerts', path: './modules/alerts/routes/AlertRoutes' },
      { name: 'notifications', path: './modules/notifications/routes/NotificationRoutes' },
      { name: 'reports', path: './modules/reports/routes/ReportRoutes' },
      { name: 'dashboards', path: './modules/dashboard/routes/DashboardRoutes' }
    ];

    let loadedCount = 0;
    for (const route of routes) {
      try {
        const routeModule = require(route.path);
        if (routeModule && typeof routeModule === 'function') {
          apiV1.use(`/${route.name}`, routeModule);
          logger.info(`✅ ${route.name} routes loaded at /api/v1/${route.name}`);
          loadedCount++;
        }
      } catch (error) {
        logger.warn(`⚠️ ${route.name} routes not found`);
      }
    }

    logger.info(`📊 Total routes loaded: ${loadedCount}/${routes.length}`);

    // ===== Base route =====
    apiV1.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'EcoGuardian API v1',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Mount API routes
    this.app.use('/api/v1', apiV1);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled promise rejection:', error);
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });
  }

  start() {
    const port = config.port || 3000;
    this.server = this.app.listen(port, () => {
      logger.info(`🚀 EcoGuardian server running on port ${port}`);
      logger.info(`📚 Environment: ${config.env || 'development'}`);
      logger.info(`🔗 API URL: http://localhost:${port}/api/v1`);
      logger.info(`📖 Health: http://localhost:${port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    logger.info('🛑 Shutting down server...');
    try {
      await database.disconnect();
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
      }
      logger.info('✅ Server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = App;