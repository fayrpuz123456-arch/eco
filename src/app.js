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

// ============ استيراد الخدمات الإضافية ============
const redisService = require('./config/redis');
const mqttService = require('./config/mqtt');
const socketService = require('./config/socket');

class App {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
  }

  async initialize() {
    try {
      logger.info('🔍 Starting application initialization...');
      logger.info(`🔍 Node.js version: ${process.version}`);

      // ============ تهيئة Firebase ============
      try {
        logger.info('🔍 Initializing Firebase...');
        firebaseService.initialize();
        logger.info(`🔍 Firebase initialized: ${firebaseService.isInitialized()}`);
      } catch (fbError) {
        logger.error('❌ Firebase initialization failed:', fbError.message);
        logger.error('📝 Stack:', fbError.stack);
      }

      // ============ الاتصال بقاعدة البيانات ============
      logger.info('🔍 Connecting to MongoDB...');
      await database.connect();
      logger.info('✅ MongoDB connected successfully');

      // ============ إنشاء الفهارس (Indexes) ============
      logger.info('🔍 Creating database indexes...');
      await this.createIndexes();
      logger.info('✅ Database indexes created');

      // ============ تهيئة Redis (إذا كان مفعلاً) ============
      if (config.features.enableRedis) {
        try {
          logger.info('🔍 Initializing Redis...');
          redisService.initialize();
          logger.info('✅ Redis initialized successfully');
        } catch (redisError) {
          logger.error('❌ Redis initialization failed:', redisError.message);
        }
      }

      // ============ تهيئة MQTT (إذا كان مفعلاً) ============
      if (config.features.enableMqtt) {
        try {
          logger.info('🔍 Initializing MQTT...');
          mqttService.initialize();
          logger.info('✅ MQTT initialized successfully');
        } catch (mqttError) {
          logger.error('❌ MQTT initialization failed:', mqttError.message);
        }
      }

      // ============ إعداد الـ Middleware ============
      logger.info('🔍 Setting up middleware...');
      this.setupMiddleware();

      // ============ إعداد الـ Routes ============
      logger.info('🔍 Setting up routes...');
      this.setupRoutes();

      // ============ إعداد Socket.IO (إذا كان مفعلاً) ============
      if (config.features.enableSocket) {
        logger.info('🔍 Setting up Socket.IO...');
        // سيتم تهيئته بعد بدء الخادم
      }

      // ============ إعداد معالجة الأخطاء ============
      this.setupErrorHandling();

      logger.info('✅ Application initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize application:', error);
      logger.error('📝 Stack:', error.stack);
      throw error;
    }
  }

  // ============ إنشاء الفهارس ============
  async createIndexes() {
    try {
      const models = [];

      // محاولة استيراد جميع الـ Models
      const modelPaths = [
        './modules/users/models/User.model',
        './modules/companies/models/Company.model',
        './modules/factories/models/Factory.model',
        './modules/departments/models/Department.model',
        './modules/machines/models/Machine.model',
        './modules/sensors/models/Sensor.model',
        './modules/sensorReadings/models/SensorReading.model',
        './modules/carbon/models/Carbon.model',
        './modules/energy/models/Energy.model',
        './modules/water/models/Water.model',
        './modules/waste/models/Waste.model',
        './modules/alerts/models/Alert.model',
        './modules/notifications/models/Notification.model',
        './modules/reports/models/Report.model',
        './modules/dashboard/models/Dashboard.model',
        './modules/productionLines/models/ProductionLine.model',
        './modules/exchange/models/Exchange.model',
        './modules/heatRecovery/models/HeatRecovery.model'
      ];

      for (const modelPath of modelPaths) {
        try {
          const model = require(modelPath);
          if (model && model.schema) {
            models.push(model);
          }
        } catch (error) {
          logger.debug(`⚠️ Model not found at ${modelPath}: ${error.message}`);
        }
      }

      if (models.length > 0) {
        await database.createIndexes(models);
        logger.info(`✅ Indexes created for ${models.length} models`);
      }
    } catch (error) {
      logger.error('❌ Error creating indexes:', error);
    }
  }

  setupMiddleware() {
    // ============ الأمان ============
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }));

    this.app.use(cors({
      origin: config.security.corsOrigin || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Company-Id'],
      exposedHeaders: ['X-Total-Count', 'X-Pagination'],
    }));

    // ============ معالجة الطلبات ============
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ============ الضغط ============
    this.app.use(compression());

    // ============ التسجيل ============
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.http(message.trim())
        }
      }));
    }

    // ============ تحديد سرعة الطلبات ============
    this.app.use(rateLimiter);

    // ============ الملفات الثابتة ============
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    this.app.use('/public', express.static(path.join(__dirname, '../public')));

    // ============ فحص الصحة ============
    this.app.get('/health', async (req, res) => {
      try {
        const dbStatus = await database.healthCheck();
        const redisStatus = redisService.isConnectedToRedis ? await redisService.isConnectedToRedis() : false;
        const mqttStatus = mqttService.isConnectedToBroker ? await mqttService.isConnectedToBroker() : false;

        const isHealthy = dbStatus.isConnected;

        res.status(isHealthy ? 200 : 503).json({
          status: isHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          services: {
            database: dbStatus,
            redis: { connected: redisStatus },
            mqtt: { connected: mqttStatus },
            firebase: { initialized: firebaseService.isInitialized() }
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });

    // ============ إضافة Correlation ID ============
    this.app.use((req, res, next) => {
      req.correlationId = req.headers['x-correlation-id'] || 
                          req.headers['x-request-id'] || 
                          `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
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
      { name: 'dashboards', path: './modules/dashboard/routes/DashboardRoutes' },
      // ===== Production Lines =====
      { name: 'production-lines', path: './modules/productionLines/routes/ProductionLineRoutes' },
      // ===== Exchange =====
      { name: 'exchange', path: './modules/exchange/routes/ExchangeRoutes' },
      // ===== Heat Recovery =====
      { name: 'heat-recovery', path: './modules/heatRecovery/routes/HeatRecoveryRoutes' },
      // ===== AI =====
      { name: 'ai', path: './modules/ai/routes/AIRoutes' },
    ];

    let loadedCount = 0;
    for (const route of routes) {
      try {
        const routeModule = require(route.path);
        if (routeModule) {
          apiV1.use(`/${route.name}`, routeModule);
          logger.info(`✅ ${route.name} routes loaded at /api/v1/${route.name}`);
          loadedCount++;
        }
      } catch (error) {
        logger.warn(`⚠️ ${route.name} routes not found: ${error.message}`);
      }
    }

    logger.info(`📊 Total routes loaded: ${loadedCount}/${routes.length}`);

    // ===== Base route =====
    apiV1.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'EcoGuardian API v1',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        routes: {
          total: loadedCount,
          loaded: routes.map(r => r.name)
        }
      });
    });

    // ===== API Info =====
    apiV1.get('/info', (req, res) => {
      res.json({
        name: config.appName || 'EcoGuardian',
        version: '1.0.0',
        environment: config.env,
        features: config.features,
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
        path: req.path,
        method: req.method,
        correlationId: req.correlationId
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (error) => {
      logger.error('❌ Unhandled promise rejection:', error);
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught exception:', error);
      // نغلق التطبيق بأمان
      this.shutdown().then(() => {
        process.exit(1);
      });
    });

    // SIGTERM و SIGINT معالجين في start()
  }

  start() {
    const port = config.port || 3000;
    
    // ============ إنشاء خادم HTTP ============
    this.server = this.app.listen(port, () => {
      logger.info(`🚀 EcoGuardian server running on port ${port}`);
      logger.info(`📚 Environment: ${config.env || 'development'}`);
      logger.info(`🔗 API URL: http://localhost:${port}/api/v1`);
      logger.info(`📖 Health: http://localhost:${port}/health`);
      logger.info(`📊 Features: ${Object.keys(config.features).filter(k => config.features[k]).join(', ') || 'none'}`);
    });

    // ============ تهيئة Socket.IO (إذا كان مفعلاً) ============
    if (config.features.enableSocket) {
      try {
        const socketService = require('./config/socket');
        this.io = socketService.initialize(this.server);
        logger.info('✅ Socket.IO initialized successfully');
      } catch (socketError) {
        logger.error('❌ Socket.IO initialization failed:', socketError.message);
      }
    }

    // ============ Graceful Shutdown ============
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    logger.info('🛑 Shutting down server...');
    const shutdownPromises = [];

    try {
      // ============ إغلاق Socket.IO ============
      if (this.io) {
        shutdownPromises.push(
          new Promise((resolve) => {
            this.io.close(() => {
              logger.info('✅ Socket.IO closed');
              resolve();
            });
          })
        );
      }

      // ============ إغلاق MQTT ============
      if (mqttService.isConnectedToBroker && mqttService.isConnectedToBroker()) {
        shutdownPromises.push(
          new Promise((resolve) => {
            try {
              mqttService.disconnect();
              logger.info('✅ MQTT disconnected');
            } catch (error) {
              logger.error('❌ MQTT disconnect error:', error);
            }
            resolve();
          })
        );
      }

      // ============ إغلاق Redis ============
      if (redisService.isConnectedToRedis && redisService.isConnectedToRedis()) {
        shutdownPromises.push(
          new Promise(async (resolve) => {
            try {
              await redisService.disconnect();
              logger.info('✅ Redis disconnected');
            } catch (error) {
              logger.error('❌ Redis disconnect error:', error);
            }
            resolve();
          })
        );
      }

      // ============ إغلاق Database ============
      shutdownPromises.push(
        new Promise(async (resolve) => {
          try {
            await database.disconnect();
            logger.info('✅ Database disconnected');
          } catch (error) {
            logger.error('❌ Database disconnect error:', error);
          }
          resolve();
        })
      );

      // ============ إغلاق HTTP Server ============
      if (this.server) {
        shutdownPromises.push(
          new Promise((resolve) => {
            this.server.close(() => {
              logger.info('✅ HTTP server closed');
              resolve();
            });
          })
        );
      }

      // انتظار جميع عمليات الإغلاق
      await Promise.all(shutdownPromises);

      logger.info('✅ Server shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = App;