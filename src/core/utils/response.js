/**
 * EcoGuardian API Response Handler
 * نظام موحد للردود في جميع أنحاء التطبيق
 */

// ============ CLASS ApiResponse ============

class ApiResponse {
  /**
   * إنشاء رد API موحد
   * @param {boolean} success - حالة الطلب (نجاح/فشل)
   * @param {string} message - رسالة توضيحية
   * @param {*} data - البيانات المطلوبة
   * @param {object} meta - معلومات إضافية (pagination, etc.)
   * @param {*} errors - أخطاء (إذا وجدت)
   */
  constructor(success, message, data = null, meta = null, errors = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    this.version = '1.0.0';
  }

  /**
   * رد نجاح
   */
  static success(message, data = null, meta = null) {
    return new ApiResponse(true, message, data, meta, null);
  }

  /**
   * رد خطأ
   */
  static error(message, errors = null, statusCode = 400) {
    return new ApiResponse(false, message, null, { statusCode }, errors);
  }

  /**
   * تحويل إلى JSON
   */
  toJSON() {
    const json = {
      success: this.success,
      message: this.message,
      timestamp: this.timestamp,
      version: this.version
    };

    if (this.data !== null && this.data !== undefined) json.data = this.data;
    if (this.meta !== null && this.meta !== undefined) json.meta = this.meta;
    if (this.errors !== null && this.errors !== undefined) json.errors = this.errors;

    return json;
  }
}

// ============ RESPONSE SEND FUNCTIONS ============

/**
 * إرسال رد نجاح
 */
const sendResponse = (res, statusCode, message, data = null, meta = null) => {
  const response = ApiResponse.success(message, data, meta);
  return res.status(statusCode).json(response);
};

/**
 * إرسال رد خطأ
 */
const sendError = (res, statusCode, message, errors = null) => {
  const response = ApiResponse.error(message, errors, statusCode);
  return res.status(statusCode).json(response);
};

/**
 * إرسال رد Paginated
 */
const sendPaginatedResponse = (res, message, data, paginationMeta) => {
  const meta = {
    page: paginationMeta.page || 1,
    limit: paginationMeta.limit || 10,
    total: paginationMeta.total || 0,
    totalPages: paginationMeta.totalPages || 0,
    hasNext: paginationMeta.page < paginationMeta.totalPages,
    hasPrev: paginationMeta.page > 1
  };
  
  return sendResponse(res, 200, message, data, meta);
};

/**
 * إرسال رد إنشاء (201)
 */
const sendCreated = (res, message, data = null) => {
  return sendResponse(res, 201, message, data);
};

/**
 * إرسال رد حذف (204)
 */
const sendDeleted = (res, message = 'Deleted successfully') => {
  return res.status(204).json({
    success: true,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * إرسال رد بدون محتوى (204)
 */
const sendNoContent = (res) => {
  return res.status(204).send();
};

/**
 * إرسال رد غير مصرح (401)
 */
const sendUnauthorized = (res, message = 'Unauthorized access') => {
  return sendError(res, 401, message);
};

/**
 * إرسال رد ممنوع (403)
 */
const sendForbidden = (res, message = 'Access denied') => {
  return sendError(res, 403, message);
};

/**
 * إرسال رد غير موجود (404)
 */
const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, 404, message);
};

/**
 * إرسال رد تعارض (409)
 */
const sendConflict = (res, message = 'Resource already exists', errors = null) => {
  return sendError(res, 409, message, errors);
};

/**
 * إرسال رد خطأ في التحقق (422)
 */
const sendValidationError = (res, message = 'Validation failed', errors = null) => {
  return sendError(res, 422, message, errors);
};

/**
 * إرسال رد خطأ في الخادم (500)
 */
const sendServerError = (res, message = 'Internal server error', errors = null) => {
  return sendError(res, 500, message, errors);
};

/**
 * إرسال رد مع تدفق البيانات (Stream)
 */
const sendStream = (res, data, contentType = 'application/json') => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();
  
  if (Array.isArray(data)) {
    res.write('[');
    data.forEach((item, index) => {
      res.write(JSON.stringify(item));
      if (index < data.length - 1) res.write(',');
    });
    res.write(']');
  } else {
    res.write(JSON.stringify(data));
  }
  
  res.end();
};

/**
 * إرسال رد مع تنزيل ملف
 */
const sendFile = (res, filePath, fileName) => {
  res.download(filePath, fileName, (err) => {
    if (err) {
      sendError(res, 500, 'Error downloading file', err.message);
    }
  });
};

// ============ PAGINATION HELPER ============

/**
 * إنشاء Meta للـ Pagination
 */
const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * حساب الـ Skip للتقسيم
 */
const getPaginationSkip = (page, limit) => {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 10;
  return (p - 1) * l;
};

// ============ DATA TRANSFORMERS ============

/**
 * تحويل البيانات إلى JSON آمن
 */
const toSafeJSON = (data, excludeFields = ['__v', 'password', 'token']) => {
  if (!data) return null;
  
  if (Array.isArray(data)) {
    return data.map(item => toSafeJSON(item, excludeFields));
  }
  
  if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (!excludeFields.includes(key)) {
        // تحويل ObjectId إلى String
        if (value && typeof value === 'object' && value._bsontype === 'ObjectID') {
          result[key] = value.toString();
        } else if (value && typeof value === 'object' && value.toJSON) {
          result[key] = value.toJSON();
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
  
  return data;
};

/**
 * إزالة الحقول الحساسة من البيانات
 */
const sanitizeData = (data, sensitiveFields = ['password', 'token', 'refreshToken']) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, sensitiveFields));
  }
  
  if (typeof data === 'object' && data !== null) {
    const result = { ...data };
    for (const field of sensitiveFields) {
      delete result[field];
    }
    return result;
  }
  
  return data;
};

// ============ CUSTOM RESPONSE BUILDERS ============

/**
 * بناء رد للـ Dashboard
 */
const buildDashboardResponse = (data) => {
  return {
    success: true,
    data: {
      metrics: data.metrics || {},
      charts: data.charts || {},
      alerts: data.alerts || [],
      recent: data.recent || [],
      timestamp: new Date().toISOString()
    },
    meta: {
      refreshRate: data.refreshRate || 5000
    }
  };
};

/**
 * بناء رد للـ Sensor Readings
 */
const buildSensorResponse = (readings, metadata = {}) => {
  return {
    success: true,
    data: readings,
    meta: {
      count: readings.length,
      unit: metadata.unit || 'unknown',
      sensorId: metadata.sensorId || null,
      from: metadata.from || null,
      to: metadata.to || null,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * بناء رد للإحصائيات
 */
const buildStatsResponse = (stats, period = 'today') => {
  return {
    success: true,
    data: stats,
    meta: {
      period,
      calculatedAt: new Date().toISOString(),
      timezone: stats.timezone || 'UTC'
    }
  };
};

// ============ EXPORT ============

module.exports = {
  // Class
  ApiResponse,
  
  // Main response functions
  sendResponse,
  sendError,
  sendPaginatedResponse,
  sendCreated,
  sendDeleted,
  sendNoContent,
  
  // HTTP status specific responses
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  sendServerError,
  
  // Special responses
  sendStream,
  sendFile,
  
  // Pagination helpers
  createPaginationMeta,
  getPaginationSkip,
  
  // Data transformers
  toSafeJSON,
  sanitizeData,
  
  // Response builders
  buildDashboardResponse,
  buildSensorResponse,
  buildStatsResponse
};