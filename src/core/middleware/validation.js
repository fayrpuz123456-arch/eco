 
const Joi = require('joi');
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { ValidationError } = require('./errorHandler');

// ============ MAIN VALIDATION MIDDLEWARE ============

/**
 * Middleware للتحقق من صحة البيانات
 * @param {object} schema - Schema Joi
 * @param {string} property - مكان البيانات (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false, // يجمع كل الأخطاء
        stripUnknown: true, // يزيل الحقول غير المعروفة
        allowUnknown: true, // يسمح بحقول إضافية
        convert: true // يحول البيانات إلى النوع الصحيح
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
          context: detail.context
        }));

        logger.warn('Validation failed', {
          property,
          errors,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userId: req.user?.id
        });

        return sendError(res, 400, 'Validation failed', errors);
      }

      // استبدال البيانات بالبيانات المُتحقق منها
      req[property] = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error', error);
      return sendError(res, 500, 'Validation error');
    }
  };
};

// ============ SCHEMAS ============

// ===== COMMON SCHEMAS =====

/**
 * معرف (UUID)
 */
const idSchema = Joi.string().uuid({ version: 'uuidv4' }).required();

/**
 * معرف اختياري
 */
const optionalIdSchema = Joi.string().uuid({ version: 'uuidv4' }).optional();

/**
 * البريد الإلكتروني
 */
const emailSchema = Joi.string().email().lowercase().trim().required();

/**
 * كلمة المرور
 */
const passwordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
  .required()
  .messages({
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  });

/**
 * رقم الهاتف
 */
const phoneSchema = Joi.string()
  .pattern(/^[0-9+\-\s()]+$/)
  .min(10)
  .max(20)
  .optional();

/**
 * الرابط (URL)
 */
const urlSchema = Joi.string().uri().optional();

/**
 * التاريخ
 */
const dateSchema = Joi.date().iso().optional();

/**
 * التوقيت
 */
const timestampSchema = Joi.date().iso().default(Date.now);

/**
 * Pagination
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().optional(),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Range (from - to)
 */
const rangeSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional()
});

// ===== USER SCHEMAS =====

/**
 * إنشاء مستخدم
 */
const createUserSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: Joi.string().min(2).max(100).required(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  role: Joi.string().valid('admin', 'manager', 'engineer', 'employee', 'viewer').default('employee'),
  phoneNumber: phoneSchema,
  factoryIds: Joi.array().items(idSchema).default([]),
  departmentIds: Joi.array().items(idSchema).default([]),
  permissions: Joi.array().items(Joi.string()).default([])
});

/**
 * تحديث مستخدم
 */
const updateUserSchema = Joi.object({
  displayName: Joi.string().min(2).max(100).optional(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  profilePicture: urlSchema,
  phoneNumber: phoneSchema,
  role: Joi.string().valid('admin', 'manager', 'engineer', 'employee', 'viewer').optional(),
  isActive: Joi.boolean().optional(),
  preferences: Joi.object({
    language: Joi.string().valid('en', 'ar', 'fr', 'es', 'de').default('en'),
    timezone: Joi.string().default('UTC'),
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      push: Joi.boolean().default(true),
      sms: Joi.boolean().default(false)
    }),
    dashboard: Joi.object({
      refreshRate: Joi.number().min(1000).max(60000).default(5000),
      theme: Joi.string().valid('light', 'dark').default('light')
    })
  }).optional()
});

/**
 * تحديث الصلاحيات
 */
const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required()
});

// ===== COMPANY SCHEMAS =====

/**
 * إنشاء شركة
 */
const createCompanySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(3).max(10).uppercase().required(),
  industry: Joi.string().valid(
    'manufacturing', 'energy', 'chemical', 'pharmaceutical',
    'food_beverage', 'automotive', 'aerospace', 'electronics',
    'textile', 'steel', 'mining', 'construction',
    'agriculture', 'technology', 'other'
  ).required(),
  industrySubtype: Joi.string().max(50).optional(),
  description: Joi.string().max(500).optional(),
  website: urlSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    postalCode: Joi.string().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lng: Joi.number().min(-180).max(180).optional()
    }).optional()
  }).optional(),
  timezone: Joi.string().default('UTC'),
  currency: Joi.string().default('USD')
});

/**
 * تحديث شركة
 */
const updateCompanySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  industry: Joi.string().valid(
    'manufacturing', 'energy', 'chemical', 'pharmaceutical',
    'food_beverage', 'automotive', 'aerospace', 'electronics',
    'textile', 'steel', 'mining', 'construction',
    'agriculture', 'technology', 'other'
  ).optional(),
  industrySubtype: Joi.string().max(50).optional(),
  description: Joi.string().max(500).optional(),
  website: urlSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    postalCode: Joi.string().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lng: Joi.number().min(-180).max(180).optional()
    }).optional()
  }).optional(),
  timezone: Joi.string().optional(),
  currency: Joi.string().optional(),
  esg: Joi.object({
    carbonReductionGoal: Joi.number().min(0).max(100).optional(),
    waterReductionGoal: Joi.number().min(0).max(100).optional(),
    wasteReductionGoal: Joi.number().min(0).max(100).optional(),
    energyEfficiencyGoal: Joi.number().min(0).max(100).optional(),
    sustainabilityScore: Joi.number().min(0).max(100).optional(),
    certifications: Joi.array().items(Joi.string()).optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

// ===== SENSOR SCHEMAS =====

/**
 * إنشاء حساس
 */
const createSensorSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  type: Joi.string().valid(
    'PZEM004T', 'WaterFlow', 'FuelFlow', 'MQ135',
    'Temperature', 'Humidity', 'Pressure', 'Rain',
    'WaterLevel', 'Ultrasonic', 'HeatSensor', 'Vibration',
    'Current', 'Voltage', 'Power', 'Energy'
  ).required(),
  unit: Joi.string().required(),
  machineId: idSchema.required(),
  factoryId: idSchema.required(),
  departmentId: idSchema.optional(),
  calibration: Joi.object({
    offset: Joi.number().default(0),
    multiplier: Joi.number().default(1),
    lastCalibrated: Joi.date().iso().default(Date.now)
  }).optional(),
  thresholds: Joi.object({
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    warning: Joi.number().optional(),
    critical: Joi.number().optional()
  }).optional(),
  location: Joi.string().optional(),
  metadata: Joi.object().optional()
});

/**
 * قراءة حساس
 */
const sensorReadingSchema = Joi.object({
  sensorId: idSchema.required(),
  value: Joi.number().required(),
  unit: Joi.string().required(),
  timestamp: timestampSchema,
  quality: Joi.string().valid('good', 'average', 'poor', 'unknown').default('good'),
  metadata: Joi.object().default({})
});

/**
 * قراءات متعددة (Bulk)
 */
const bulkSensorReadingsSchema = Joi.object({
  readings: Joi.array().items(sensorReadingSchema).min(1).max(1000).required()
});

// ===== AUTH SCHEMAS =====

/**
 * تسجيل الدخول
 */
const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required()
});

/**
 * تسجيل مستخدم جديد
 */
const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: Joi.string().min(2).max(100).required(),
  companyCode: Joi.string().min(3).max(10).optional()
});

/**
 * تحديث كلمة المرور
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match'
  })
});

/**
 * طلب إعادة تعيين كلمة المرور
 */
const forgotPasswordSchema = Joi.object({
  email: emailSchema
});

/**
 * إعادة تعيين كلمة المرور
 */
const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match'
  })
});

// ===== REPORT SCHEMAS =====

/**
 * إنشاء تقرير
 */
const createReportSchema = Joi.object({
  type: Joi.string().valid('carbon', 'energy', 'water', 'waste', 'production').required(),
  factoryId: idSchema.required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('pdf', 'excel', 'csv').default('pdf'),
  filters: Joi.object({
    departmentId: idSchema.optional(),
    machineId: idSchema.optional(),
    sensorId: idSchema.optional()
  }).optional(),
  includeCharts: Joi.boolean().default(true),
  includeRecommendations: Joi.boolean().default(true)
});

// ===== NOTIFICATION SCHEMAS =====

/**
 * إنشاء إشعار
 */
const createNotificationSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  message: Joi.string().min(2).max(1000).required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error').default('info'),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  userId: idSchema.optional(),
  companyId: idSchema.optional(),
  factoryId: idSchema.optional(),
  data: Joi.object().optional()
});

// ===== ALERT SCHEMAS =====

/**
 * إنشاء تنبيه
 */
const createAlertSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid('threshold', 'anomaly', 'maintenance', 'system').required(),
  severity: Joi.string().valid('info', 'warning', 'critical').required(),
  sensorId: idSchema.required(),
  condition: Joi.object({
    operator: Joi.string().valid('>', '>=', '<', '<=', '==', '!=').required(),
    value: Joi.number().required(),
    duration: Joi.number().optional()
  }).required(),
  actions: Joi.array().items(Joi.object({
    type: Joi.string().valid('email', 'sms', 'push', 'webhook').required(),
    target: Joi.string().required(),
    config: Joi.object().optional()
  })).optional(),
  isActive: Joi.boolean().default(true)
});

// ===== PLUGIN SCHEMAS =====

/**
 * تثبيت إضافة
 */
const installPluginSchema = Joi.object({
  pluginName: Joi.string().required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
  config: Joi.object().optional()
});

/**
 * تحديث إضافة
 */
const updatePluginSchema = Joi.object({
  config: Joi.object().required(),
  isActive: Joi.boolean().optional()
});

// ===== SEARCH SCHEMAS =====

/**
 * بحث
 */
const searchSchema = Joi.object({
  query: Joi.string().min(2).required(),
  type: Joi.string().valid('users', 'companies', 'factories', 'machines', 'sensors').optional(),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

// ===== FILTER SCHEMAS =====

/**
 * فلتر تاريخ
 */
const dateFilterSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional()
});

/**
 * فلتر عام
 */
const generalFilterSchema = Joi.object({
  search: Joi.string().optional(),
  status: Joi.string().valid('active', 'inactive', 'archived').optional(),
  sort: Joi.string().optional(),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

// ============ CUSTOM VALIDATORS ============

/**
 * التحقق من أن القيمة رقم صحيح
 */
const isPositiveNumber = (value, helpers) => {
  if (value <= 0) {
    return helpers.error('any.invalid', { message: 'Must be a positive number' });
  }
  return value;
};

/**
 * التحقق من أن القيمة ضمن المدى
 */
const isInRange = (min, max) => {
  return (value, helpers) => {
    if (value < min || value > max) {
      return helpers.error('any.invalid', { 
        message: `Must be between ${min} and ${max}` 
      });
    }
    return value;
  };
};

/**
 * التحقق من أن القيمة ليست فارغة
 */
const isNotEmpty = (value, helpers) => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return helpers.error('any.invalid', { message: 'Cannot be empty' });
  }
  return value;
};

/**
 * التحقق من أن القيمة فريدة (مستخدم مع قاعدة البيانات)
 */
const isUnique = (model, field) => {
  return async (value, helpers) => {
    const existing = await model.findOne({ [field]: value });
    if (existing) {
      return helpers.error('any.invalid', { 
        message: `${field} already exists` 
      });
    }
    return value;
  };
};

// ============ VALIDATION HELPERS ============

/**
 * التحقق من وجود حقول مطلوبة
 */
const validateRequiredFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }
  return true;
};

/**
 * تنظيف البيانات من الحقول غير المرغوب فيها
 */
const sanitizeData = (data, allowedFields) => {
  const sanitized = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  }
  return sanitized;
};

// ============ EXPORT ============

module.exports = {
  // Main middleware
  validate,
  
  // Common schemas
  idSchema,
  optionalIdSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  urlSchema,
  dateSchema,
  timestampSchema,
  paginationSchema,
  rangeSchema,
  
  // User schemas
  createUserSchema,
  updateUserSchema,
  updatePermissionsSchema,
  
  // Company schemas
  createCompanySchema,
  updateCompanySchema,
  
  // Sensor schemas
  createSensorSchema,
  sensorReadingSchema,
  bulkSensorReadingsSchema,
  
  // Auth schemas
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  
  // Report schemas
  createReportSchema,
  
  // Notification schemas
  createNotificationSchema,
  
  // Alert schemas
  createAlertSchema,
  
  // Plugin schemas
  installPluginSchema,
  updatePluginSchema,
  
  // Search schemas
  searchSchema,
  
  // Filter schemas
  dateFilterSchema,
  generalFilterSchema,
  
  // Custom validators
  isPositiveNumber,
  isInRange,
  isNotEmpty,
  isUnique,
  
  // Helpers
  validateRequiredFields,
  sanitizeData
};