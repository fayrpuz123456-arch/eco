const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

// ============ CLASSES ============

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 400, true, errors);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, true);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, true);
    this.name = 'ForbiddenError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists', errors = null) {
    super(message, 409, true, errors);
    this.name = 'ConflictError';
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors = null) {
    super(message, 400, true, errors);
    this.name = 'BadRequestError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, true);
    this.name = 'RateLimitError';
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, true);
    this.name = 'ServiceUnavailableError';
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database error', errors = null) {
    super(message, 500, true, errors);
    this.name = 'DatabaseError';
  }
}

// ============ ERROR HANDLER MIDDLEWARE ============

const errorHandler = (err, req, res, next) => {
  // تسجيل الخطأ
  logError(err, req);

  // معالجة أنواع مختلفة من الأخطاء
  const errorResponse = formatError(err);

  // إرسال الرد
  sendError(
    res,
    errorResponse.statusCode,
    errorResponse.message,
    errorResponse.errors
  );
};

// ============ LOGGING FUNCTIONS ============

const logError = (err, req) => {
  const errorLog = {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    companyId: req.companyId || 'unknown',
    timestamp: new Date().toISOString(),
    userAgent: req.get('user-agent')
  };

  if (err.isOperational) {
    logger.warn('⚠️ Operational error:', errorLog);
  } else {
    logger.error('❌ Unexpected error:', errorLog);
  }
};

// ============ ERROR FORMATTER ============

const formatError = (err) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  // ====== MongoDB Errors ======
  
  // خطأ التكرار (Duplicate Key)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return {
      statusCode: 409,
      message: `Duplicate value for ${field}`,
      errors: {
        field,
        message: `${field} already exists`
      }
    };
  }

  // خطأ التحقق من الصحة (Validation)
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      type: e.kind
    }));
    return {
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors
    };
  }

  // خطأ النوع (Cast Error)
  if (err.name === 'CastError') {
    return {
      statusCode: 400,
      message: `Invalid ${err.path}: ${err.value}`,
      errors: {
        field: err.path,
        value: err.value,
        type: 'Invalid data type'
      }
    };
  }

  // ====== Mongoose Errors ======
  
  if (err.name === 'MongooseError') {
    return {
      statusCode: 500,
      message: 'Database operation failed',
      errors: process.env.NODE_ENV === 'development' ? err.message : null
    };
  }

  // ====== JWT Errors ======
  
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      message: 'Invalid token',
      errors: err.message
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'Token expired',
      errors: 'Please login again'
    };
  }

  // ====== Firebase Errors ======
  
  if (err.code && err.code.startsWith('auth/')) {
    let statusCode = 403;
    let message = err.message;
    
    if (err.code === 'auth/id-token-expired') {
      statusCode = 401;
      message = 'Authentication token expired';
    } else if (err.code === 'auth/user-not-found') {
      statusCode = 404;
      message = 'User not found';
    } else if (err.code === 'auth/email-already-exists') {
      statusCode = 409;
      message = 'Email already registered';
    }
    
    return {
      statusCode,
      message,
      errors: err.code
    };
  }

  // ====== Joi Validation Errors ======
  
  if (err.name === 'ValidationError' && err.details) {
    const validationErrors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));
    return {
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors
    };
  }

  // ====== Multer Errors ======
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 413,
      message: 'File too large',
      errors: 'Maximum file size exceeded'
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      statusCode: 400,
      message: 'Unexpected file',
      errors: err.field
    };
  }

  // ====== Rate Limit Errors ======
  
  if (err.name === 'RateLimitError') {
    return {
      statusCode: 429,
      message: 'Too many requests',
      errors: 'Please try again later'
    };
  }

  // ====== Custom App Errors ======
  
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors
    };
  }

  // ====== Default (Unexpected) Errors ======
  
  // في بيئة الإنتاج، لا نعرض تفاصيل الأخطاء غير المتوقعة
  if (process.env.NODE_ENV === 'production') {
    return {
      statusCode: 500,
      message: 'Internal server error',
      errors: null
    };
  }

  // في بيئة التطوير، نعرض تفاصيل الخطأ
  return {
    statusCode: 500,
    message: err.message || 'Internal server error',
    errors: {
      stack: err.stack,
      name: err.name
    }
  };
};

// ============ ASYNC WRAPPER ============

// للتعامل مع الأخطاء في الدوال غير المتزامنة
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============ NOT FOUND HANDLER ============

const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// ============ UNHANDLED REJECTION/EXCEPTION HANDLERS ============

const setupUnhandledHandlers = () => {
  // Unhandled Promise Rejections
  process.on('unhandledRejection', (error) => {
    logger.error('❌ Unhandled promise rejection:', {
      error: error.message,
      stack: error.stack
    });
    // لا نغلق التطبيق، فقط نسجل الخطأ
  });

  // Uncaught Exceptions
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught exception:', {
      error: error.message,
      stack: error.stack
    });
    // نغلق التطبيق لأن الحالة غير مستقرة
    process.exit(1);
  });
};

// ============ EXPRESS ERROR HANDLER FOR MONGOOSE ============

const handleMongoDBError = (err) => {
  // خطأ الاتصال
  if (err.name === 'MongoNetworkError') {
    return new ServiceUnavailableError('Database connection failed');
  }
  
  // خطأ المهلة
  if (err.name === 'MongoTimeoutError') {
    return new ServiceUnavailableError('Database operation timed out');
  }
  
  return err;
};

// ============ MIDDLEWARE WRAPPER ============

// لتغليف الميدلوير ومعالجة الأخطاء
const withErrorHandling = (middleware) => {
  return async (req, res, next) => {
    try {
      await middleware(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// ============ EXPORT ============

module.exports = {
  // Classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError,
  DatabaseError,

  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  withErrorHandling,

  // Setup
  setupUnhandledHandlers,
  handleMongoDBError,
  formatError
}; 
