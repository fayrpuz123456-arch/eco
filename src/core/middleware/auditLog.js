const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../../config');

// ============ AUDIT LOG SCHEMA ============

const auditLogSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true },
  userRole: { type: String, default: 'viewer' },
  
  // Action details
  action: { 
    type: String, 
    required: true,
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'READ',
      'LOGIN', 'LOGOUT', 'REGISTER',
      'APPROVE', 'REJECT', 'REVOKE',
      'ENABLE', 'DISABLE', 'ACTIVATE', 'DEACTIVATE',
      'EXPORT', 'IMPORT', 'DOWNLOAD',
      'SEND', 'RECEIVE', 'PUBLISH',
      'VIEW', 'SEARCH', 'FILTER',
      'CONFIGURE', 'SETTINGS', 'CHANGE',
      'PERMISSION_CHANGE', 'ROLE_CHANGE',
      'PLUGIN_INSTALL', 'PLUGIN_UNINSTALL', 'PLUGIN_ENABLE', 'PLUGIN_DISABLE',
      'SYSTEM', 'ERROR', 'WARNING',
      'SENSOR_READING', 'SENSOR_CALIBRATION',
      'ALERT_TRIGGERED', 'ALERT_ACKNOWLEDGE', 'ALERT_RESOLVED',
      'REPORT_GENERATED', 'REPORT_SCHEDULED'
    ],
    required: true
  },
  
  // Resource details
  resource: { 
    type: String, 
    required: true,
    enum: [
      'USER', 'COMPANY', 'FACTORY', 'DEPARTMENT', 'PRODUCTION_LINE',
      'MACHINE', 'SENSOR', 'SENSOR_READING',
      'CARBON', 'ENERGY', 'WATER', 'WASTE',
      'REPORT', 'ALERT', 'NOTIFICATION',
      'PLUGIN', 'SETTINGS', 'PERMISSION',
      'EXCHANGE', 'MAINTENANCE', 'DIGITAL_TWIN',
      'SYSTEM', 'AUTH', 'API'
    ],
    required: true
  },
  
  resourceId: { type: String, index: true },
  
  // Details
  details: {
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    changes: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  
  // Request context
  context: {
    ip: { type: String },
    userAgent: { type: String },
    method: { type: String },
    path: { type: String },
    query: { type: mongoose.Schema.Types.Mixed, default: null },
    body: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  
  // Status
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'PENDING'],
    default: 'SUCCESS'
  },
  
  error: {
    code: { type: String },
    message: { type: String },
    stack: { type: String }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Retention
  retentionDate: { 
    type: Date, 
    default: () => {
      const days = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 180;
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date;
    },
    index: true
  },
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ retentionDate: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook
auditLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// ============ AUDIT LOG SERVICE ============

class AuditLogService {
  constructor() {
    this.model = AuditLog;
  }

  /**
   * إنشاء سجل تدقيق
   */
  async createLog(data) {
    try {
      const log = new this.model(data);
      await log.save();
      
      // تسجيل في الـ Winston أيضاً
      logger.info(`AUDIT: ${data.action} on ${data.resource} by ${data.userEmail}`, {
        action: data.action,
        resource: data.resource,
        userId: data.userId,
        companyId: data.companyId
      });
      
      return log;
    } catch (error) {
      logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  /**
   * الحصول على سجلات التدقيق
   */
  async getLogs(companyId, filter = {}, options = {}) {
    const query = { companyId, ...filter };
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.model.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(query)
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * الحصول على سجلات مستخدم معين
   */
  async getUserLogs(userId, companyId, options = {}) {
    return this.getLogs(companyId, { userId }, options);
  }

  /**
   * الحصول على سجلات مورد معين
   */
  async getResourceLogs(resource, resourceId, companyId, options = {}) {
    return this.getLogs(companyId, { resource, resourceId }, options);
  }

  /**
   * الحصول على سجلات إجراء معين
   */
  async getActionLogs(action, companyId, options = {}) {
    return this.getLogs(companyId, { action }, options);
  }

  /**
   * الحصول على سجلات الفترة الزمنية
   */
  async getLogsByDateRange(companyId, startDate, endDate, options = {}) {
    const filter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    return this.getLogs(companyId, filter, options);
  }

  /**
   * حذف السجلات القديمة
   */
  async deleteOldLogs(days = 180) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await this.model.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    logger.info(`Deleted ${result.deletedCount} old audit logs (older than ${days} days)`);
    return result;
  }

  /**
   * إحصائيات السجلات
   */
  async getLogStats(companyId) {
    const stats = await this.model.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const total = await this.model.countDocuments({ companyId });
    
    return {
      total,
      topActions: stats.slice(0, 10),
      allActions: stats
    };
  }

  /**
   * البحث في السجلات
   */
  async searchLogs(companyId, searchTerm, options = {}) {
    const query = {
      companyId,
      $or: [
        { userEmail: { $regex: searchTerm, $options: 'i' } },
        { action: { $regex: searchTerm, $options: 'i' } },
        { resource: { $regex: searchTerm, $options: 'i' } },
        { resourceId: { $regex: searchTerm, $options: 'i' } },
        { 'context.ip': { $regex: searchTerm, $options: 'i' } },
        { 'error.message': { $regex: searchTerm, $options: 'i' } }
      ]
    };
    
    return this.getLogs(companyId, query, options);
  }

  /**
   * تصدير السجلات
   */
  async exportLogs(companyId, filter = {}, format = 'json') {
    const logs = await this.model.find({ companyId, ...filter }).lean();
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    }
    
    return logs;
  }

  /**
   * تحويل إلى CSV
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';
    
    const headers = [
      'id', 'action', 'resource', 'resourceId', 
      'userEmail', 'userRole', 'status',
      'createdAt', 'context.ip'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const log of logs) {
      const row = headers.map(header => {
        let value = '';
        const parts = header.split('.');
        if (parts.length === 1) {
          value = log[parts[0]] || '';
        } else {
          value = log.context?.[parts[1]] || '';
        }
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }
}

// ============ AUDIT LOG MIDDLEWARE ============

/**
 * Middleware لتسجيل جميع الطلبات
 */
const auditLogMiddleware = async (req, res, next) => {
  try {
    // حفظ وقت البدء
    const startTime = Date.now();
    
    // تخزين البيانات الأصلية
    const originalSend = res.send;
    let responseBody = null;
    
    // اعتراض الـ Response
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    
    // تسجيل الطلب بعد الانتهاء
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        
        // تحديد الإجراء بناءً على الطريقة
        const actionMap = {
          'GET': 'READ',
          'POST': 'CREATE',
          'PUT': 'UPDATE',
          'PATCH': 'UPDATE',
          'DELETE': 'DELETE'
        };
        
        const action = actionMap[req.method] || 'READ';
        
        // تحديد المورد
        const resourceMap = {
          '/users': 'USER',
          '/companies': 'COMPANY',
          '/factories': 'FACTORY',
          '/departments': 'DEPARTMENT',
          '/machines': 'MACHINE',
          '/sensors': 'SENSOR',
          '/reports': 'REPORT',
          '/alerts': 'ALERT',
          '/notifications': 'NOTIFICATION',
          '/auth': 'AUTH',
          '/settings': 'SETTINGS'
        };
        
        let resource = 'SYSTEM';
        const path = req.path;
        for (const [key, value] of Object.entries(resourceMap)) {
          if (path.startsWith(key)) {
            resource = value;
            break;
          }
        }
        
        // استخراج resourceId من المسار
        const pathParts = path.split('/');
        const resourceId = pathParts.length > 2 ? pathParts[2] : null;
        
        // تحديد الحالة
        const status = res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS';
        
        // إنشاء سجل التدقيق
        const auditData = {
          companyId: req.companyId || 'system',
          userId: req.user?.id || 'system',
          userEmail: req.user?.email || 'system',
          userRole: req.user?.role || 'viewer',
          action,
          resource,
          resourceId: resourceId || null,
          context: {
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent') || 'unknown',
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.method !== 'GET' ? req.body : null
          },
          status,
          metadata: {
            duration: `${duration}ms`,
            statusCode: res.statusCode
          }
        };
        
        // إضافة تفاصيل الخطأ في حالة الفشل
        if (status === 'FAILURE' && responseBody) {
          try {
            const body = JSON.parse(responseBody);
            auditData.error = {
              message: body.message || 'Unknown error',
              code: body.code || 'ERROR'
            };
          } catch (e) {
            auditData.error = {
              message: 'Unknown error'
            };
          }
        }
        
        // تسجيل فقط الإجراءات المهمة (اختياري)
        const importantActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE'];
        if (importantActions.includes(action) || status === 'FAILURE') {
          await auditLogService.createLog(auditData);
        }
        
      } catch (error) {
        logger.error('Error creating audit log', error);
      }
    });
    
    next();
  } catch (error) {
    logger.error('Audit log middleware error', error);
    next();
  }
};

// ============ HELPER FUNCTIONS ============

/**
 * تسجيل إجراء يدوياً
 */
const logAction = async (req, action, resource, resourceId = null, details = {}) => {
  try {
    const auditData = {
      companyId: req.companyId || 'system',
      userId: req.user?.id || 'system',
      userEmail: req.user?.email || 'system',
      userRole: req.user?.role || 'viewer',
      action,
      resource,
      resourceId: resourceId || null,
      details,
      context: {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent') || 'unknown',
        method: req.method,
        path: req.path
      },
      status: 'SUCCESS'
    };
    
    return await auditLogService.createLog(auditData);
  } catch (error) {
    logger.error('Failed to log action', error);
    throw error;
  }
};

/**
 * تسجيل إجراء فاشل
 */
const logFailure = async (req, action, resource, error, resourceId = null) => {
  try {
    const auditData = {
      companyId: req.companyId || 'system',
      userId: req.user?.id || 'system',
      userEmail: req.user?.email || 'system',
      userRole: req.user?.role || 'viewer',
      action,
      resource,
      resourceId: resourceId || null,
      context: {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent') || 'unknown',
        method: req.method,
        path: req.path
      },
      status: 'FAILURE',
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'ERROR',
        stack: error.stack
      }
    };
    
    return await auditLogService.createLog(auditData);
  } catch (error) {
    logger.error('Failed to log failure', error);
    throw error;
  }
};

// ============ EXPORT ============

// Singleton instance
const auditLogService = new AuditLogService();

module.exports = {
  // Service
  auditLogService,
  AuditLog,
  
  // Middleware
  auditLogMiddleware,
  
  // Helpers
  logAction,
  logFailure
}; 
