const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ============ NOTIFICATION SCHEMA ============

const notificationSchema = new mongoose.Schema({
  // ===== Base Fields =====
  companyId: { 
    type: String, 
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return v && v.startsWith('comp_');
      },
      message: 'Company ID must start with "comp_"'
    }
  },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'],
    default: 'pending'
  },

  // ===== Notification Content =====
  userId: {
    type: String,
    required: true,
    index: true
  },
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
    maxlength: 500,
    default: null
  },
  type: {
    type: String,
    enum: [
      'info', 'success', 'warning', 'error', 'alert',
      'reminder', 'update', 'report', 'notification', 'system'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'system', 'security', 'maintenance', 'production',
      'energy', 'water', 'carbon', 'waste', 'alert',
      'report', 'user', 'company', 'factory', 'machine', 'sensor'
    ],
    required: true
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
      sentAt: { type: Date, default: null },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String, default: null }
    },
    push: {
      sentAt: { type: Date, default: null },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String, default: null },
      platform: { type: String, enum: ['ios', 'android', 'web', 'all'], default: 'all' }
    },
    sms: {
      sentAt: { type: Date, default: null },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String, default: null }
    },
    inApp: {
      sentAt: { type: Date, default: null },
      readAt: { type: Date, default: null },
      status: { type: String, enum: ['pending', 'sent', 'read'], default: 'pending' }
    },
    webhook: {
      sentAt: { type: Date, default: null },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      error: { type: String, default: null },
      response: { type: mongoose.Schema.Types.Mixed, default: null }
    }
  },

  // ===== Actions =====
  actions: {
    type: [{
      id: { type: String, default: () => uuidv4() },
      label: { type: String, trim: true, required: true },
      url: { type: String, trim: true, required: true },
      type: { type: String, enum: ['link', 'button', 'action'], default: 'link' },
      data: { type: mongoose.Schema.Types.Mixed, default: {} }
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
    id: { type: String, default: null },
    name: { type: String, trim: true, default: null },
    version: { type: String, default: null }
  },

  // ===== Scheduling =====
  scheduledAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  isScheduled: { type: Boolean, default: false },

  // ===== Read/Seen =====
  readAt: { type: Date, default: null },
  seenAt: { type: Date, default: null },

  // ===== Feedback =====
  feedback: {
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, default: null },
    givenAt: { type: Date, default: null }
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

// فهارس للبحث
notificationSchema.index({ companyId: 1, userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
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

notificationSchema.virtual('isFailed').get(function() {
  return this.status === 'failed';
});

notificationSchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date(this.expiresAt) < new Date();
});

notificationSchema.virtual('isScheduledFuture').get(function() {
  return this.isScheduled && this.scheduledAt && new Date(this.scheduledAt) > new Date();
});

// ============ PRE-SAVE MIDDLEWARE ============
// ملحوظة: Mongoose 9 شالت next() من الـ pre-hooks خالص.
// بدل ما ننده next(error) بنعمل throw، وبدل next() في الآخر مش محتاجين نعمل حاجة
// (async function من غير return next() كفاية).

notificationSchema.pre('save', async function() {
  this.updatedAt = new Date();

  // تنظيف البيانات النصية
  if (this.title) this.title = this.title.trim();
  if (this.message) this.message = this.message.trim();
  if (this.body) this.body = this.body.trim();

  // التحقق من الحقول المطلوبة
  if (!this.userId) {
    throw new Error('userId is required');
  }

  if (!this.title || !this.message) {
    throw new Error('Title and message are required');
  }

  // إذا كان هناك scheduledAt والمستقبل، نضع isScheduled = true
  if (this.scheduledAt && new Date(this.scheduledAt) > new Date()) {
    this.isScheduled = true;
  } else if (this.scheduledAt) {
    // إذا كان الوقت المحدد في الماضي، نرسل فوراً
    this.isScheduled = false;
    this.scheduledAt = null;
  }

  // تنظيف الـ actions
  if (this.actions && this.actions.length > 0) {
    this.actions = this.actions.map(action => ({
      ...action,
      label: action.label ? action.label.trim() : action.label,
      url: action.url ? action.url.trim() : action.url
    }));
  }
});

// ============ PRE-VALIDATE MIDDLEWARE ============

notificationSchema.pre('validate', async function() {
  if (this.title) {
    this.title = this.title.trim();
  }

  if (this.message) {
    this.message = this.message.trim();
  }

  if (this.body) {
    this.body = this.body.trim();
  }

  // التحقق من صحة التاريخ
  if (this.scheduledAt && this.expiresAt) {
    if (new Date(this.scheduledAt) > new Date(this.expiresAt)) {
      throw new Error('Scheduled date cannot be after expiry date');
    }
  }
});

// ============ PRE-FINDONEANDUPDATE MIDDLEWARE ============

notificationSchema.pre('findOneAndUpdate', async function() {
  this.set({ updatedAt: new Date() });
});

// ============ PRE-UPDATEONE MIDDLEWARE ============

notificationSchema.pre('updateOne', async function() {
  this.set({ updatedAt: new Date() });
});

// ============ PRE-UPDATEMANY MIDDLEWARE ============

notificationSchema.pre('updateMany', async function() {
  this.set({ updatedAt: new Date() });
});

// ============ POST-SAVE MIDDLEWARE ============

notificationSchema.post('save', function(doc) {
  console.log('✅ Notification saved successfully:', doc._id);
});

// ✅ معالج الأخطاء - بنتأكد إن next دالة فعلاً قبل ما ننده عليها،
// عشان لو مونجوز مبعتهاش (زي ما بيحصل في إصدارات معينة) الكود ميقعش.
notificationSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving notification:', error.message);
  }
  if (typeof next === 'function') {
    next(error);
  }
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

notificationSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Notification updated successfully:', doc._id);
  }
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
  if (!channel || !this.delivery[channel]) {
    throw new Error(`Invalid channel: ${channel}`);
  }
  
  this.delivery[channel].status = status;
  this.delivery[channel].sentAt = new Date();
  if (error) this.delivery[channel].error = error;
  
  // تحديث الحالة العامة بناءً على جميع القنوات
  const allChannels = Object.keys(this.delivery);
  const allSent = allChannels.every(ch => 
    !this.channels[ch] || this.delivery[ch].status === 'sent'
  );
  const anyFailed = allChannels.some(ch => 
    this.channels[ch] && this.delivery[ch].status === 'failed'
  );
  
  if (allSent) {
    this.status = 'sent';
  } else if (anyFailed) {
    this.status = 'failed';
  }
  
  return this.save();
};

/**
 * إضافة ردود فعل
 */
notificationSchema.methods.addFeedback = function(rating, comment = '') {
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  this.feedback.rating = rating;
  this.feedback.comment = comment ? comment.trim() : null;
  this.feedback.givenAt = new Date();
  return this.save();
};

/**
 * إلغاء الإشعار
 */
notificationSchema.methods.cancel = function(reason = null) {
  if (this.status === 'sent' || this.status === 'delivered') {
    throw new Error('Cannot cancel a notification that has already been sent');
  }
  
  this.status = 'cancelled';
  if (reason) {
    this.metadata = {
      ...this.metadata,
      cancellationReason: reason,
      cancelledAt: new Date()
    };
  }
  return this.save();
};

/**
 * إعادة محاولة الإرسال
 */
notificationSchema.methods.retry = function() {
  if (this.status !== 'failed') {
    throw new Error('Only failed notifications can be retried');
  }
  
  // إعادة تعيين حالة التسليم
  const channels = Object.keys(this.delivery);
  for (const channel of channels) {
    if (this.channels[channel] && this.delivery[channel].status === 'failed') {
      this.delivery[channel].status = 'pending';
      this.delivery[channel].error = null;
      this.delivery[channel].sentAt = null;
    }
  }
  
  this.status = 'pending';
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

/**
 * البيانات الكاملة للإدارة
 */
notificationSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    userId: this.userId,
    companyId: this.companyId,
    recipients: this.recipients,
    delivery: this.delivery,
    feedback: this.feedback,
    template: this.template,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * الحصول على إشعارات المستخدم
 */
notificationSchema.statics.findByUser = async function(userId, options = {}) {
  if (!userId) {
    throw new Error('userId is required');
  }
  
  const { limit = 50, page = 1, status, type, category, priority } = options;
  const query = { userId, deletedAt: null };
  if (status) query.status = status;
  if (type) query.type = type;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};

/**
 * الحصول على الإشعارات غير المقروءة
 */
notificationSchema.statics.findUnread = async function(userId) {
  if (!userId) return [];
  
  return this.find({
    userId,
    status: { $in: ['sent', 'delivered', 'pending'] },
    deletedAt: null
  }).sort({ createdAt: -1 }).lean();
};

/**
 * الحصول على إشعارات الشركة
 */
notificationSchema.statics.findByCompany = async function(companyId, options = {}) {
  if (!companyId) {
    throw new Error('companyId is required');
  }
  
  const { limit = 50, page = 1, status, type, category } = options;
  const query = { companyId, deletedAt: null };
  if (status) query.status = status;
  if (type) query.type = type;
  if (category) query.category = category;
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};

/**
 * الحصول على إحصائيات الإشعارات للمستخدم
 */
notificationSchema.statics.getStats = async function(userId) {
  if (!userId) {
    return { total: 0, unread: 0, read: 0, sent: 0, failed: 0, cancelled: 0 };
  }
  
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
        },
        sent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'sent'] }, 1, 0]
          }
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
          }
        },
        cancelled: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, unread: 0, read: 0, sent: 0, failed: 0, cancelled: 0 };
};

/**
 * الحصول على إحصائيات الإشعارات للشركة
 */
notificationSchema.statics.getCompanyStats = async function(companyId) {
  if (!companyId) {
    return { total: 0, unread: 0, read: 0, sent: 0, failed: 0, cancelled: 0 };
  }
  
  const stats = await this.aggregate([
    { $match: { companyId, deletedAt: null } },
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
        },
        sent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'sent'] }, 1, 0]
          }
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
          }
        },
        cancelled: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, unread: 0, read: 0, sent: 0, failed: 0, cancelled: 0 };
};

/**
 * وضع علامة كمقروءة لكل الإشعارات
 */
notificationSchema.statics.markAllAsRead = async function(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }
  
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

/**
 * الحصول على الإشعارات المجدولة
 */
notificationSchema.statics.findScheduled = async function() {
  const now = new Date();
  return this.find({
    scheduledAt: { $lte: now },
    isScheduled: true,
    status: { $in: ['pending'] },
    deletedAt: null
  }).sort({ scheduledAt: 1 });
};

/**
 * حذف الإشعارات المنتهية
 */
notificationSchema.statics.deleteExpired = async function() {
  const now = new Date();
  return this.deleteMany({
    expiresAt: { $lte: now },
    status: { $in: ['sent', 'delivered', 'read'] },
    deletedAt: null
  });
};

/**
 * حذف الإشعارات القديمة
 */
notificationSchema.statics.deleteOld = async function(days = 30) {
  if (!days || days < 1) {
    throw new Error('Days must be a positive number');
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['read', 'failed', 'cancelled'] },
    deletedAt: null
  });
};

// ============ EXPORT ============

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;