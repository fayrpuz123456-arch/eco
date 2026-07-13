const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const BaseModel = require('../../../core/base/BaseModel');

// ============ NOTIFICATION SCHEMA ============

const notificationSchema = new mongoose.Schema({
  // ===== Base Fields =====
  _id: { type: String, default: () => uuidv4() },
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // ===== Notification Content =====
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 1000
  },
  body: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: [
      'info',           // معلومات
      'success',        // نجاح
      'warning',        // تحذير
      'error',          // خطأ
      'alert',          // تنبيه
      'reminder',       // تذكير
      'update',         // تحديث
      'report',         // تقرير
      'notification',   // إشعار عام
      'system'          // نظام
    ],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'system',         // نظام
      'security',       // أمن
      'maintenance',    // صيانة
      'production',     // إنتاج
      'energy',         // طاقة
      'water',          // مياه
      'carbon',         // كربون
      'waste',          // نفايات
      'alert',          // تنبيه
      'report',         // تقرير
      'user',           // مستخدم
      'company',        // شركة
      'factory',        // مصنع
      'machine',        // آلة
      'sensor'          // حساس
    ],
    required: true,
    index: true
  },

  // ===== Channels =====
  channels: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
    webhook: { type: Boolean, default: false }
  },

  // ===== Recipients =====
  recipients: {
    userIds: { type: [String], default: [] },
    emails: { type: [String], default: [] },
    phones: { type: [String], default: [] },
    deviceTokens: { type: [String], default: [] }
  },

  // ===== Delivery =====
  delivery: {
    email: {
      sentAt: { type: Date },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String }
    },
    push: {
      sentAt: { type: Date },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String },
      platform: { type: String, enum: ['ios', 'android', 'web', 'all'], default: 'all' }
    },
    sms: {
      sentAt: { type: Date },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String }
    },
    inApp: {
      sentAt: { type: Date },
      readAt: { type: Date },
      status: { type: String, enum: ['pending', 'sent', 'read'], default: 'pending' }
    },
    webhook: {
      sentAt: { type: Date },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String },
      response: { type: mongoose.Schema.Types.Mixed }
    }
  },

  // ===== Actions =====
  actions: {
    type: [{
      label: { type: String, trim: true },
      url: { type: String, trim: true },
      type: { type: String, enum: ['link', 'button', 'action'] },
      data: { type: mongoose.Schema.Types.Mixed }
    }],
    default: []
  },

  // ===== Data =====
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Templates =====
  template: {
    id: { type: String },
    name: { type: String, trim: true },
    version: { type: String }
  },

  // ===== Scheduling =====
  scheduledAt: { type: Date },
  expiresAt: { type: Date },
  isScheduled: { type: Boolean, default: false },

  // ===== Read/Seen =====
  readAt: { type: Date },
  seenAt: { type: Date },

  // ===== Feedback =====
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    givenAt: { type: Date }
  },

  // ===== Metadata =====
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Tags =====
  tags: {
    type: [String],
    default: []
  },

  // ===== Soft Delete =====
  deletedBy: { type: String, default: null },
  deletedReason: { type: String, default: null }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  },
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// ============ INDEXES ============

notificationSchema.index({ companyId: 1, userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledAt: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

notificationSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

notificationSchema.virtual('isSent').get(function() {
  return this.status === 'sent';
});

notificationSchema.virtual('isRead').get(function() {
  return this.status === 'read';
});

notificationSchema.virtual('isDelivered').get(function() {
  return this.status === 'delivered';
});

// ============ METHODS ============

/**
 * وضع علامة كمقروء
 */
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

/**
 * وضع علامة كمشاهد
 */
notificationSchema.methods.markAsSeen = function() {
  this.seenAt = new Date();
  return this.save();
};

/**
 * تحديث حالة الإرسال
 */
notificationSchema.methods.updateDeliveryStatus = function(channel, status, error = null) {
  if (this.delivery[channel]) {
    this.delivery[channel].status = status;
    this.delivery[channel].sentAt = new Date();
    if (error) this.delivery[channel].error = error;
    
    // تحديث الحالة العامة
    if (status === 'sent') {
      this.status = 'sent';
    } else if (status === 'failed') {
      this.status = 'failed';
    }
  }
  return this.save();
};

/**
 * إضافة ردود فعل
 */
notificationSchema.methods.addFeedback = function(rating, comment = '') {
  this.feedback.rating = rating;
  this.feedback.comment = comment;
  this.feedback.givenAt = new Date();
  return this.save();
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
notificationSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    title: this.title,
    message: this.message,
    type: this.type,
    priority: this.priority,
    category: this.category,
    status: this.status,
    channels: this.channels,
    scheduledAt: this.scheduledAt,
    readAt: this.readAt,
    createdAt: this.createdAt,
    data: this.data,
    actions: this.actions
  };
};

// ============ STATIC METHODS ============

/**
 * الحصول على إشعارات المستخدم
 */
notificationSchema.statics.findByUser = async function(userId, options = {}) {
  const { limit = 50, page = 1, status, type } = options;
  const query = { userId, deletedAt: null };
  if (status) query.status = status;
  if (type) query.type = type;
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
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
};

/**
 * الحصول على الإشعارات غير المقروءة
 */
notificationSchema.statics.findUnread = async function(userId) {
  return this.find({
    userId,
    status: { $in: ['sent', 'delivered', 'pending'] },
    deletedAt: null
  }).sort({ createdAt: -1 });
};

/**
 * الحصول على إحصائيات الإشعارات
 */
notificationSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId, deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: {
            $cond: [
              { $in: ['$status', ['sent', 'delivered', 'pending']] },
              1,
              0
            ]
          }
        },
        read: {
          $sum: {
            $cond: [{ $eq: ['$status', 'read'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, unread: 0, read: 0 };
};

/**
 * وضع علامة كمقروءة لكل الإشعارات
 */
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    {
      userId,
      status: { $in: ['sent', 'delivered'] },
      deletedAt: null
    },
    {
      status: 'read',
      readAt: new Date(),
      updatedAt: new Date()
    }
  );
};

// ============ MIDDLEWARE ============

// Pre-save: تحديث updatedAt
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============ EXPORT ============

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;