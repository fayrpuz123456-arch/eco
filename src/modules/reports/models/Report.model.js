const mongoose = require('mongoose');

// ============ REPORT SCHEMA ============

const reportSchema = new mongoose.Schema({
  // ===== Base Fields =====
  companyId: { type: String, required: true, index: true },
  factoryId: { type: String, required: true, index: true },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['draft', 'generating', 'completed', 'failed', 'archived'],
    default: 'draft'
  },

  // ===== Basic Information =====
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 20,
    unique: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  type: {
    type: String,
    enum: [
      'carbon', 'energy', 'water', 'waste', 'production',
      'sustainability', 'custom', 'compliance', 'esg', 'summary'
    ],
    required: true
  },
  format: {
    type: String,
    enum: ['pdf', 'excel', 'csv', 'json', 'html'],
    default: 'pdf'
  },
  language: {
    type: String,
    enum: ['en', 'ar', 'fr', 'es', 'de'],
    default: 'en'
  },

  // ===== Period =====
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      required: true
    },
    year: { type: Number },
    month: { type: Number, min: 1, max: 12 },
    quarter: { type: Number, min: 1, max: 4 }
  },

  // ===== Data =====
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Summary =====
  summary: {
    total: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
    percentage: { type: Number, default: 0 }
  },

  // ===== Charts =====
  charts: {
    type: [{
      type: { type: String, enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'column'] },
      title: { type: String },
      labels: { type: [String] },
      datasets: { type: [mongoose.Schema.Types.Mixed] },
      options: { type: mongoose.Schema.Types.Mixed }
    }],
    default: []
  },

  // ===== Tables =====
  tables: {
    type: [{
      title: { type: String },
      headers: { type: [String] },
      rows: { type: [mongoose.Schema.Types.Mixed] },
      totalRow: { type: mongoose.Schema.Types.Mixed }
    }],
    default: []
  },

  // ===== Sections =====
  sections: {
    type: [{
      title: { type: String, required: true },
      content: { type: String },
      order: { type: Number },
      type: { type: String, enum: ['text', 'chart', 'table', 'summary'] }
    }],
    default: []
  },

  // ===== Templates =====
  template: {
    id: { type: String },
    name: { type: String, trim: true },
    version: { type: String }
  },

  // ===== Filters =====
  filters: {
    departments: { type: [String], default: [] },
    productionLines: { type: [String], default: [] },
    machines: { type: [String], default: [] },
    sensors: { type: [String], default: [] },
    custom: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // ===== Scheduling =====
  scheduling: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    dayOfWeek: { type: Number, min: 1, max: 7 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    time: { type: String, default: '08:00' },
    lastGenerated: { type: Date },
    nextGeneration: { type: Date }
  },

  // ===== Delivery =====
  delivery: {
    email: { type: Boolean, default: false },
    recipients: { type: [String], default: [] },
    subject: { type: String },
    message: { type: String },
    push: { type: Boolean, default: false },
    download: { type: Boolean, default: true }
  },

  // ===== File =====
  file: {
    url: { type: String },
    path: { type: String },
    size: { type: Number },
    mimeType: { type: String },
    generatedAt: { type: Date },
    expiresAt: { type: Date }
  },

  // ===== Sharing =====
  sharing: {
    public: { type: Boolean, default: false },
    shareableLink: { type: String },
    sharedWith: { type: [String], default: [] },
    sharedAt: { type: Date }
  },

  // ===== Comments =====
  comments: {
    type: [{
      userId: { type: String },
      userName: { type: String },
      content: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  // ===== Tags =====
  tags: {
    type: [String],
    default: []
  },

  // ===== Metadata =====
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
// تم إزالة الفهارس المكررة - كل فهرس موجود مرة واحدة فقط

reportSchema.index({ companyId: 1, type: 1, status: 1 });
reportSchema.index({ companyId: 1, 'period.startDate': 1, 'period.endDate': 1 });
reportSchema.index({ factoryId: 1, type: 1 });
reportSchema.index({ code: 1 }, { unique: true });
reportSchema.index({ status: 1 });
reportSchema.index({ type: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'period.startDate': 1 });
reportSchema.index({ 'period.endDate': 1 });
reportSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

reportSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

reportSchema.virtual('isDraft').get(function() {
  return this.status === 'draft';
});

reportSchema.virtual('isScheduled').get(function() {
  return this.scheduling.enabled;
});

// ============ METHODS ============

/**
 * بدء توليد التقرير
 */
reportSchema.methods.startGeneration = function() {
  this.status = 'generating';
  return this.save();
};

/**
 * إكمال التقرير
 */
reportSchema.methods.complete = function(fileData) {
  this.status = 'completed';
  if (fileData) {
    this.file = {
      ...this.file,
      ...fileData,
      generatedAt: new Date()
    };
  }
  this.scheduling.lastGenerated = new Date();
  return this.save();
};

/**
 * فشل التقرير
 */
reportSchema.methods.fail = function(error) {
  this.status = 'failed';
  this.metadata = { ...this.metadata, error };
  return this.save();
};

/**
 * إضافة تعليق
 */
reportSchema.methods.addComment = function(userId, userName, content) {
  this.comments.push({ userId, userName, content });
  return this.save();
};

/**
 * مشاركة التقرير
 */
reportSchema.methods.share = function(userIds) {
  this.sharing.sharedWith = [...new Set([...this.sharing.sharedWith, ...userIds])];
  this.sharing.sharedAt = new Date();
  return this.save();
};

/**
 * إلغاء المشاركة
 */
reportSchema.methods.unshare = function(userIds) {
  this.sharing.sharedWith = this.sharing.sharedWith.filter(
    id => !userIds.includes(id)
  );
  return this.save();
};

/**
 * تحديث جدولة التقرير
 */
reportSchema.methods.updateSchedule = function(scheduleData) {
  this.scheduling = {
    ...this.scheduling,
    ...scheduleData,
    enabled: true
  };
  this.scheduling.nextGeneration = this.calculateNextGeneration();
  return this.save();
};

/**
 * حساب موعد التوليد القادم
 */
reportSchema.methods.calculateNextGeneration = function() {
  const now = new Date();
  let next = new Date(now);
  
  switch (this.scheduling.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
  }
  
  const timeParts = this.scheduling.time.split(':');
  next.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
  
  return next;
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
reportSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    format: this.format,
    status: this.status,
    period: this.period,
    summary: this.summary,
    file: this.file,
    scheduling: {
      enabled: this.scheduling.enabled,
      frequency: this.scheduling.frequency,
      nextGeneration: this.scheduling.nextGeneration
    },
    createdAt: this.createdAt,
    tags: this.tags
  };
};

// ============ STATIC METHODS ============

/**
 * الحصول على التقارير حسب النوع
 */
reportSchema.statics.findByType = async function(companyId, type) {
  return this.find({
    companyId,
    type,
    deletedAt: null
  }).sort({ createdAt: -1 });
};

/**
 * الحصول على التقارير حسب الفترة
 */
reportSchema.statics.findByPeriod = async function(companyId, startDate, endDate) {
  return this.find({
    companyId,
    'period.startDate': { $gte: new Date(startDate) },
    'period.endDate': { $lte: new Date(endDate) },
    deletedAt: null
  }).sort({ createdAt: -1 });
};

/**
 * الحصول على إحصائيات التقارير
 */
reportSchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    { $match: { companyId, deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        generating: {
          $sum: {
            $cond: [{ $eq: ['$status', 'generating'] }, 1, 0]
          }
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
          }
        },
        draft: {
          $sum: {
            $cond: [{ $eq: ['$status', 'draft'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, completed: 0, generating: 0, failed: 0, draft: 0 };
};

/**
 * الحصول على التقارير المجدولة
 */
reportSchema.statics.findScheduled = async function() {
  const now = new Date();
  return this.find({
    'scheduling.enabled': true,
    'scheduling.nextGeneration': { $lte: now },
    status: { $in: ['draft', 'completed'] },
    deletedAt: null
  });
};

// ============ MIDDLEWARE ============

reportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============ EXPORT ============

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;