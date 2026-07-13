const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config');

// ============ التأكد من وجود مجلد السجلات ============

const logDir = path.join(__dirname, '../../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ============ تنسيق السجلات ============

// تنسيق السجلات
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // إضافة الـ metadata إذا وجد
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    // إضافة الـ stack trace إذا وجد
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// تنسيق للـ Console (ملون)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // إضافة الـ metadata إذا وجد
    if (Object.keys(meta).length > 0) {
      const metaStr = JSON.stringify(meta);
      logMessage += ` ${metaStr}`;
    }
    
    // إضافة الـ stack trace إذا وجد
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// ============ إنشاء الـ Logger ============

const logger = winston.createLogger({
  level: config.logging?.level || 'info',
  format: logFormat,
  transports: [
    // Console Transport
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true
    }),
    
    // File Transport - جميع السجلات
    new winston.transports.File({
      filename: path.join(__dirname, '../../../', config.logging?.file || 'logs/ecoguardian.log'),
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true,
      handleExceptions: true
    }),
    
    // File Transport - أخطاء فقط
    new winston.transports.File({
      filename: path.join(__dirname, '../../../', config.logging?.errorFile || 'logs/error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true,
      handleExceptions: true
    })
  ],
  
  // معالجة الاستثناءات غير المتوقعة
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  
  exitOnError: false
});

// ============ CLASS Logger ============

class Logger {
  constructor() {
    this.logger = logger;
  }

  // ============ BASIC LOGGING ============

  info(message, meta = {}) {
    this.logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  }

  error(message, error = null, meta = {}) {
    if (error) {
      this.logger.error(message, { 
        error: error.message || error,
        stack: error.stack || null,
        ...meta,
        timestamp: new Date().toISOString()
      });
    } else {
      this.logger.error(message, { ...meta, timestamp: new Date().toISOString() });
    }
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
  }

  http(message, meta = {}) {
    this.logger.http(message, { ...meta, timestamp: new Date().toISOString() });
  }

  verbose(message, meta = {}) {
    this.logger.verbose(message, { ...meta, timestamp: new Date().toISOString() });
  }

  silly(message, meta = {}) {
    this.logger.silly(message, { ...meta, timestamp: new Date().toISOString() });
  }

  // ============ CONTEXTED LOGGING ============

  child(module) {
    return {
      info: (message, meta = {}) => this.info(message, { module, ...meta }),
      error: (message, error = null, meta = {}) => this.error(message, error, { module, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { module, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { module, ...meta }),
      http: (message, meta = {}) => this.http(message, { module, ...meta }),
      verbose: (message, meta = {}) => this.verbose(message, { module, ...meta }),
      silly: (message, meta = {}) => this.silly(message, { module, ...meta }),
      business: (action, data = {}) => this.info(`[BUSINESS] ${action}`, { module, ...data }),
      security: (event, data = {}) => this.warn(`[SECURITY] ${event}`, { module, ...data }),
      performance: (operation, duration, data = {}) => this.debug(`[PERFORMANCE] ${operation}: ${duration}ms`, { module, ...data })
    };
  }

  // ============ REQUEST LOGGING ============

  logRequest(req, meta = {}) {
    const requestInfo = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous',
      companyId: req.companyId || 'unknown',
      ...meta
    };
    
    this.http('Incoming request', requestInfo);
  }

  logResponse(req, res, responseTime = 0) {
    const responseInfo = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id || 'anonymous',
      companyId: req.companyId || 'unknown'
    };
    
    if (res.statusCode >= 400) {
      this.warn('Request completed with error', responseInfo);
    } else {
      this.http('Request completed successfully', responseInfo);
    }
  }

  // ============ ERROR LOGGING ============

  logError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      ...context,
      timestamp: new Date().toISOString()
    };
    
    this.logger.error('Error occurred', errorInfo);
  }

  // ============ BUSINESS LOGGING ============

  logBusinessAction(action, userId, companyId, data = {}) {
    const actionInfo = {
      action,
      userId,
      companyId,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.info(`Business action: ${action}`, actionInfo);
  }

  // ============ SECURITY LOGGING ============

  logSecurityEvent(event, userId = null, details = {}) {
    const securityInfo = {
      event,
      userId: userId || 'anonymous',
      ...details,
      timestamp: new Date().toISOString()
    };
    
    this.warn(`Security event: ${event}`, securityInfo);
  }

  // ============ PERFORMANCE LOGGING ============

  logPerformance(operation, duration, meta = {}) {
    const performanceInfo = {
      operation,
      duration: `${duration}ms`,
      ...meta,
      timestamp: new Date().toISOString()
    };
    
    this.debug(`Performance: ${operation}`, performanceInfo);
  }

  // ============ SENSOR LOGGING ============

  logSensorReading(sensorId, value, unit, meta = {}) {
    const sensorInfo = {
      sensorId,
      value,
      unit,
      ...meta,
      timestamp: new Date().toISOString()
    };
    
    this.info(`Sensor reading: ${sensorId} = ${value} ${unit}`, sensorInfo);
  }

  // ============ SYSTEM LOGGING ============

  logSystemEvent(event, status = 'info', details = {}) {
    const systemInfo = {
      event,
      status,
      ...details,
      timestamp: new Date().toISOString()
    };
    
    if (status === 'error') {
      this.error(`System event: ${event}`, systemInfo);
    } else if (status === 'warning') {
      this.warn(`System event: ${event}`, systemInfo);
    } else {
      this.info(`System event: ${event}`, systemInfo);
    }
  }

  // ============ DATABASE LOGGING ============

  logDatabaseQuery(collection, operation, query, duration = 0) {
    const queryInfo = {
      collection,
      operation,
      query: JSON.stringify(query).substring(0, 500),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
    
    if (duration > 1000) {
      this.warn(`Slow database query: ${collection}.${operation}`, queryInfo);
    } else {
      this.debug(`Database query: ${collection}.${operation}`, queryInfo);
    }
  }

  // ============ STARTUP LOGGING ============

  logStartup(port, environment) {
    this.info('🚀 Server started successfully', {
      port,
      environment,
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  }

  logShutdown() {
    this.info('🛑 Server shutting down', {
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
}

// ============ EXPORT ============

module.exports = new Logger();