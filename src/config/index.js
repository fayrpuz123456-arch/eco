const dotenv = require('dotenv');
const path = require('path');

// تحميل المتغيرات البيئية
dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'EcoGuardian',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecoguardian',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000
    }
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
    expiry: process.env.JWT_EXPIRY || '7d',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d'
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0
  },

  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: `ecoguardian_${Math.random().toString(16).substr(2, 8)}`
  },

  socket: {
    port: parseInt(process.env.SOCKET_PORT, 10) || 3001,
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000'
  },

  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://ai-service:5000',
    predictionEndpoint: process.env.AI_PREDICTION_ENDPOINT || '/api/v1/predict'
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    path: process.env.STORAGE_PATH || './uploads',
    aws: {
      accessKey: process.env.AWS_ACCESS_KEY,
      secretKey: process.env.AWS_SECRET_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_BUCKET
    }
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ecoguardian.log',
    errorFile: process.env.LOG_ERROR_FILE || 'logs/error.log'
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')
  },

  plugins: {
    path: process.env.PLUGIN_PATH || './src/plugins',
    autoLoad: process.env.AUTO_LOAD_PLUGINS === 'true'
  },

  features: {
    enableMqtt: process.env.ENABLE_MQTT === 'true' || false,
    enableSocket: process.env.ENABLE_SOCKET === 'true' || false,
    enableRedis: process.env.ENABLE_REDIS === 'true' || false,
    enableAI: process.env.ENABLE_AI === 'true' || false
  }
};