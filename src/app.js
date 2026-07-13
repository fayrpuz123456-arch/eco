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
      // تهيئة Firebase
      firebaseService.initialize();

      // الاتصال بقاعدة البيانات
      await database.connect();

      // إعداد الـ Middleware
      this.setupMiddleware();

      // إعداد الـ Routes
      this.setupRoutes();

      // إعداد معالجة الأخطاء
      this.setupErrorHandling();

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
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
          console.log(`✅ ${route.name} routes loaded at /api/v1/${route.name}`);
          loadedCount++;
        }
      } catch (error) {
        console.log(`⚠️ ${route.name} routes not found`);
      }
    }

    console.log(`📊 Total routes loaded: ${loadedCount}/${routes.length}`);

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
      console.log(`🚀 EcoGuardian server running on port ${port}`);
      console.log(`📚 Environment: ${config.env || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${port}/api/v1`);
      console.log(`📖 Health: http://localhost:${port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    console.log('🛑 Shutting down server...');
    try {
      await database.disconnect();
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
      }
      console.log('✅ Server shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = App;