const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const slowDown = require('express-slow-down');
const config = require('../../config');
const logger = require('../utils/logger');
const { RateLimitError } = require('./errorHandler');

// ============ HELPER FUNCTION ============

// دالة مساعدة لتوليد مفتاح آمن
const generateKey = (req, extra = '') => {
  if (req.user?.id) {
    return extra ? `${req.user.id}:${extra}` : req.user.id;
  }

  const ip = ipKeyGenerator(req);
  return extra ? `${ip}:${extra}` : ip;
};

// ============ RATE LIMITER ============

// 1. المحدد الأساسي - للطلبات العامة
const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs || 15 * 60 * 1000, // 15 دقيقة
  max: config.rateLimit.max || 100, // حد أقصى 100 طلب لكل IP
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return next(new RateLimitError('Too many requests, please try again later'));
  },
  
  skip: (req) => {
    return req.path === '/health' || req.path === '/favicon.ico';
  },
  
  keyGenerator: (req) => generateKey(req)
});

// ============ STRICT RATE LIMITER ============

// 2. محدّد صارم - للعمليات الحساسة
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10, // 10 محاولات فقط
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`Strict rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return next(new RateLimitError('Too many attempts, please try again after 15 minutes'));
  },
  
  keyGenerator: (req) => generateKey(req)
});

// ============ API RATE LIMITER ============

// 3. محدّد APIs - للطلبات من تطبيقات Flutter/Web
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 60, // 60 طلب في الدقيقة
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return next(new RateLimitError('API rate limit exceeded, please slow down'));
  },
  
  keyGenerator: (req) => generateKey(req)
});

// ============ SLOW DOWN ============

// 4. بطء تدريجي - لتقليل الضغط عند الطلبات المتكررة
const slowDownLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  delayAfter: 50, // بعد 50 طلب
  delayMs: (used, req) => {
    const delayAfter = req.slowDown?.limit || 50;
    return (used - delayAfter) * 500;
  },
  maxDelayMs: 20000, // أقصى تأخير 20 ثانية
  
  keyGenerator: (req) => generateKey(req)
});

// ============ CREATING CUSTOM LIMITERS ===========

// 5. محدّد مخصص
const createRateLimiter = (windowMs, max, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    
    handler: (req, res, next) => {
      logger.warn(`Custom rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return next(new RateLimitError(message));
    },
    
    keyGenerator: (req) => generateKey(req)
  });
};

// ============ SKIP IF ADMIN ============

// 6. محدّد يتخطى المستخدمين الإداريين
const rateLimiterSkipAdmin = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    
    skip: (req) => {
      return req.user?.role === 'admin' || req.path === '/health';
    },
    
    handler: (req, res, next) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return next(new RateLimitError('Too many requests, please try again later'));
    },
    
    keyGenerator: (req) => generateKey(req)
  });
};

// ============ SENSITIVE ENDPOINT LIMITERS ============

// 7. محدّد خاص بتسجيل الدخول
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات فاشلة فقط
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`Login rate limit exceeded for IP: ${req.ip}`, {
      email: req.body.email,
      ip: req.ip
    });
    return next(new RateLimitError('Too many login attempts, please try again after 15 minutes'));
  },
  
  keyGenerator: (req) => generateKey(req, req.body.email || 'unknown'),
  
  skipSuccessfulRequests: true
});

// 8. محدّد خاص بتسجيل المستخدمين
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  max: 3, // 3 محاولات تسجيل فقط في الساعة
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`Registration rate limit exceeded for IP: ${req.ip}`);
    return next(new RateLimitError('Too many registration attempts, please try again later'));
  },
  
  keyGenerator: (req) => generateKey(req)
});

// 9. محدّد خاص بطلبات تحميل الملفات
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  max: 10, // 10 تحميلات فقط في الساعة
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res, next) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`, {
      userId: req.user?.id,
      ip: req.ip
    });
    return next(new RateLimitError('Too many uploads, please try again later'));
  },
  
  keyGenerator: (req) => generateKey(req)
});

// ============ EXPORT ============

module.exports = {
  // Main limiters
  rateLimiter,
  strictRateLimiter,
  apiRateLimiter,
  slowDownLimiter,
  
  // Specialized limiters
  loginRateLimiter,
  registerRateLimiter,
  uploadRateLimiter,
  rateLimiterSkipAdmin,
  
  // Factory function
  createRateLimiter
};