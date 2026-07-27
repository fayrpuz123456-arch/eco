const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// تحميل متغيرات البيئة
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============ HELPER FUNCTIONS ============

/**
 * التحقق من وجود متغيرات البيئة المطلوبة في Production
 */
const validateProductionEnv = () => {
  if (process.env.NODE_ENV === 'production') {
    const required = [
      'MONGODB_URI',
      'JWT_SECRET',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `❌ Missing required environment variables in production:\n${missing.join('\n')}\n` +
        `Please set these variables in your .env file or environment.`
      );
    }

    // التحقق من أن JWT_SECRET ليس القيمة الافتراضية
    if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this') {
      throw new Error(
        '❌ JWT_SECRET is still using the default value in production!\n' +
        'Please generate a secure secret using: openssl rand -base64 32'
      );
    }
  }
};

/**
 * توليد clientId آمن لـ MQTT
 */
const generateMqttClientId = () => {
  const prefix = process.env.MQTT_CLIENT_PREFIX || 'ecoguardian';
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${random}`;
};

// ============ VALIDATE ENVIRONMENT ============

// التحقق من البيئة في production فقط
if (process.env.NODE_ENV === 'production') {
  validateProductionEnv();
}

// ============ CONFIGURATION ============

module.exports = {
  // ===== Environment =====
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'EcoGuardian',

  // ===== Database =====
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 10,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE, 10) || 2,
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT, 10) || 45000,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT, 10) || 5000,
      // إعدادات إضافية مفيدة
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT, 10) || 10000,
      heartbeatFrequencyMS: parseInt(process.env.MONGODB_HEARTBEAT_FREQUENCY, 10) || 10000
    }
  },

  // ===== Firebase =====
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    // إعدادات إضافية
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN
  },

  // ===== JWT =====
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || '7d',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    issuer: process.env.JWT_ISSUER || 'ecoguardian',
    audience: process.env.JWT_AUDIENCE || 'ecoguardian-api'
  },

  // ===== Redis =====
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    // إعدادات إضافية
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ecoguardian:',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3
  },

  // ===== MQTT =====
  mqtt: {
    broker: process.env.MQTT_BROKER,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID || generateMqttClientId(),
    // إعدادات إضافية
    protocol: process.env.MQTT_PROTOCOL || 'mqtt',
    port: parseInt(process.env.MQTT_PORT, 10) || 1883,
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD, 10) || 5000,
    connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT, 10) || 30000,
    keepalive: parseInt(process.env.MQTT_KEEPALIVE, 10) || 60,
    clean: process.env.MQTT_CLEAN !== 'false',
    qos: parseInt(process.env.MQTT_QOS, 10) || 1,
    retain: process.env.MQTT_RETAIN === 'true'
  },

  // ===== Socket.IO =====
  socket: {
    port: parseInt(process.env.SOCKET_PORT, 10) || 3001,
    corsOrigin: process.env.SOCKET_CORS_ORIGIN,
    // إعدادات إضافية
    path: process.env.SOCKET_PATH || '/socket.io',
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
    transports: (process.env.SOCKET_TRANSPORTS || 'websocket,polling').split(',')
  },

  // ===== AI Service =====
  ai: {
    serviceUrl: process.env.AI_SERVICE_URL,
    predictionEndpoint: process.env.AI_PREDICTION_ENDPOINT || '/api/v1/predict',
    // إعدادات إضافية
    timeout: parseInt(process.env.AI_TIMEOUT, 10) || 30000,
    apiKey: process.env.AI_API_KEY,
    retries: parseInt(process.env.AI_RETRIES, 10) || 3,
    retryDelay: parseInt(process.env.AI_RETRY_DELAY, 10) || 1000
  },

  // ===== Storage =====
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    path: process.env.STORAGE_PATH || './uploads',
    // إعدادات إضافية
    maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: (process.env.STORAGE_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(','),
    aws: {
      accessKey: process.env.AWS_ACCESS_KEY,
      secretKey: process.env.AWS_SECRET_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_BUCKET,
      endpoint: process.env.AWS_ENDPOINT,
      forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === 'true'
    }
  },

  // ===== Email =====
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    // إعدادات إضافية
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM || 'noreply@ecoguardian.com',
    replyTo: process.env.SMTP_REPLY_TO || 'support@ecoguardian.com'
  },

  // ===== Rate Limit =====
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    // إعدادات إضافية
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    standardHeaders: process.env.RATE_LIMIT_HEADERS !== 'false',
    legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS === 'true'
  },

  // ===== Logging =====
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ecoguardian.log',
    errorFile: process.env.LOG_ERROR_FILE || 'logs/error.log',
    // إعدادات إضافية
    maxSize: parseInt(process.env.LOG_MAX_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5,
    format: process.env.LOG_FORMAT || 'json',
    silent: process.env.LOG_SILENT === 'true'
  },

  // ===== Security =====
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [],
    // إعدادات إضافية
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    csrfProtection: process.env.CSRF_PROTECTION === 'true',
    xssProtection: process.env.XSS_PROTECTION !== 'false',
    hstsEnabled: process.env.HSTS_ENABLED !== 'false',
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE, 10) || 31536000,
    allowedMethods: (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
    allowedHeaders: (process.env.ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With,X-Company-Id').split(',')
  },

  // ===== Plugins =====
  plugins: {
    path: process.env.PLUGIN_PATH || './src/plugins',
    autoLoad: process.env.AUTO_LOAD_PLUGINS === 'true',
    // إعدادات إضافية
    allowedPlugins: process.env.ALLOWED_PLUGINS ? process.env.ALLOWED_PLUGINS.split(',') : [],
    disabledPlugins: process.env.DISABLED_PLUGINS ? process.env.DISABLED_PLUGINS.split(',') : []
  },

  // ===== Features =====
  features: {
    enableMqtt: process.env.ENABLE_MQTT === 'true' || false,
    enableSocket: process.env.ENABLE_SOCKET === 'true' || false,
    enableRedis: process.env.ENABLE_REDIS === 'true' || false,
    enableAI: process.env.ENABLE_AI === 'true' || false,
    // إعدادات إضافية
    enableAnalytics: process.env.ENABLE_ANALYTICS === 'true' || false,
    enableMonitoring: process.env.ENABLE_MONITORING === 'true' || false,
    enableSwagger: process.env.ENABLE_SWAGGER === 'true' || false,
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    enableCors: process.env.ENABLE_CORS !== 'false'
  },

  // ===== API =====
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api',
    // إعدادات إضافية
    bodyLimit: process.env.API_BODY_LIMIT || '10mb',
    urlencodedLimit: process.env.API_URLENCODED_LIMIT || '10mb',
    timeout: parseInt(process.env.API_TIMEOUT, 10) || 30000
  },

  // ===== Cache =====
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
    enabled: process.env.CACHE_ENABLED === 'true' || false,
    // إعدادات إضافية
    maxSize: parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000,
    staleWhileRevalidate: parseInt(process.env.CACHE_STALE_WHILE_REVALIDATE, 10) || 60
  },

  // ===== Monitoring =====
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true' || false,
    endpoint: process.env.MONITORING_ENDPOINT || '/metrics',
    // إعدادات إضافية
    collectDefaultMetrics: process.env.MONITORING_COLLECT_DEFAULT !== 'false',
    timeout: parseInt(process.env.MONITORING_TIMEOUT, 10) || 5000
  },

  // ===== Session =====
  session: {
    secret: process.env.SESSION_SECRET,
    name: process.env.SESSION_NAME || 'ecoguardian.sid',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000, // 7 days
    // إعدادات إضافية
    secure: process.env.SESSION_SECURE === 'true' || process.env.NODE_ENV === 'production',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    resave: process.env.SESSION_RESAVE === 'true',
    saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED === 'true'
  },

  // ===== Queue =====
  queue: {
    enabled: process.env.QUEUE_ENABLED === 'true' || false,
    // إعدادات إضافية
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    attempts: parseInt(process.env.QUEUE_ATTEMPTS, 10) || 3,
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY, 10) || 5000,
    removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE === 'true',
    removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL === 'true'
  },

  // ===== Notification =====
  notification: {
    // Push Notification
    push: {
      enabled: process.env.PUSH_ENABLED === 'true' || false,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
      webPushSubject: process.env.WEB_PUSH_SUBJECT || 'mailto:support@ecoguardian.com'
    },
    // SMS
    sms: {
      provider: process.env.SMS_PROVIDER || 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    }
  },

  // ===== Webhook =====
  webhook: {
    enabled: process.env.WEBHOOK_ENABLED === 'true' || false,
    // إعدادات إضافية
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 5000,
    retries: parseInt(process.env.WEBHOOK_RETRIES, 10) || 3,
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY, 10) || 1000,
    maxPayloadSize: parseInt(process.env.WEBHOOK_MAX_PAYLOAD_SIZE, 10) || 1024 * 1024 // 1MB
  }
};

// ============ EXPORT VALIDATION ============

// تصدير دالة للتحقق من صحة الإعدادات
module.exports.validate = function() {
  const errors = [];

  // التحقق من MongoDB URI في production
  if (process.env.NODE_ENV === 'production' && !module.exports.mongodb.uri) {
    errors.push('MONGODB_URI is required in production');
  }

  // التحقق من JWT Secret
  if (process.env.NODE_ENV === 'production' && 
      (!module.exports.jwt.secret || module.exports.jwt.secret === 'your-super-secret-jwt-key-change-this')) {
    errors.push('JWT_SECRET must be set to a secure value in production');
  }

  // التحقق من Firebase credentials
  if (process.env.NODE_ENV === 'production') {
    if (!module.exports.firebase.projectId) errors.push('FIREBASE_PROJECT_ID is required in production');
    if (!module.exports.firebase.privateKey) errors.push('FIREBASE_PRIVATE_KEY is required in production');
    if (!module.exports.firebase.clientEmail) errors.push('FIREBASE_CLIENT_EMAIL is required in production');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============ LOGGING THE CONFIG (Development Only) ============

if (process.env.NODE_ENV === 'development' && process.env.LOG_CONFIG !== 'false') {
  console.log('📋 Configuration loaded:');
  console.log(`   Environment: ${module.exports.env}`);
  console.log(`   Port: ${module.exports.port}`);
  console.log(`   MongoDB: ${module.exports.mongodb.uri ? '✓' : '✗'}`);
  console.log(`   Firebase: ${module.exports.firebase.projectId ? '✓' : '✗'}`);
  console.log(`   JWT Secret: ${module.exports.jwt.secret && module.exports.jwt.secret !== 'your-super-secret-jwt-key-change-this' ? '✓' : '⚠️'}`);
  console.log(`   Redis: ${module.exports.redis.host ? '✓' : '✗'}`);
  console.log(`   MQTT: ${module.exports.mqtt.broker ? '✓' : '✗'}`);
  console.log(`   AI Service: ${module.exports.ai.serviceUrl ? '✓' : '✗'}`);
  console.log(`   Features: ${Object.keys(module.exports.features).filter(k => module.exports.features[k]).join(', ') || 'none'}`);
  console.log('');
}