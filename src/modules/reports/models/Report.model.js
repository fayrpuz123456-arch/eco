const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ REPORT SCHEMA ============

// استخدام BaseModel لإضافة الحقول الأساسية (companyId, deletedAt, createdBy, updatedBy, status, metadata)
// ولكننا نحتفظ بالحقول المخصصة لأن Report Model معقد
const reportSchema = new mongoose.Schema({
  // ===== Base Fields (من BaseModel) =====
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
    enum: ['draft', 'generating', 'completed', 'failed', 'archived'],
    default: 'draft'
  },

  // ===== Basic Information =====
  factoryId: {
    type: String,
    required: true,
    index: true
  },
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
    year: { type: Number, default: null },
    month: { type: Number, min: 1, max: 12, default: null },
    quarter: { type: Number, min: 1, max: 4, default: null }
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
    id: { type: String, default: null },
    name: { type: String, trim: true, default: null },
    version: { type: String, default: null }
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
    dayOfWeek: { type: Number, min: 1, max: 7, default: null },
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    time: { type: String, default: '08:00' },
    lastGenerated: { type: Date, default: null },
    nextGeneration: { type: Date, default: null }
  },

  // ===== Delivery =====
  delivery: {
    email: { type: Boolean, default: false },
    recipients: { type: [String], default: [] },
    subject: { type: String, default: null },
    message: { type: String, default: null },
    push: { type: Boolean, default: false },
    download: { type: Boolean, default: true }
  },

  // ===== File =====
  file: {
    url: { type: String, default: null },
    path: { type: String, default: null },
    size: { type: Number, default: null },
    mimeType: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },

  // ===== Sharing =====
  sharing: {
    public: { type: Boolean, default: false },
    shareableLink: { type: String, default: null },
    sharedWith: { type: [String], default: [] },
    sharedAt: { type: Date, default: null }
  },

  // ===== Comments =====
  comments: {
    type: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  // ===== AI Insights =====
  insights: {
    type: [{
      title: { type: String, required: true },
      description: { type: String, required: true },
      type: { type: String, enum: ['insight', 'warning', 'opportunity'], default: 'insight' },
      category: { type: String, default: null },
      confidence: { type: Number, min: 0, max: 1, default: 0.8 },
      recommendation: { type: String, default: null }
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
// ✅ كل فهرس معرف مرة واحدة فقط

// فهارس للبحث
reportSchema.index({ companyId: 1, type: 1, status: 1 });
reportSchema.index({ companyId: 1, 'period.startDate': 1, 'period.endDate': 1 });
reportSchema.index({ factoryId: 1, type: 1 });
reportSchema.index({ type: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'period.startDate': 1 });
reportSchema.index({ 'period.endDate': 1 });

// ✅ فهرس فريد لـ code و companyId
reportSchema.index({ code: 1, companyId: 1 }, { unique: true });

// ✅ فهرس Soft Delete
reportSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

reportSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

reportSchema.virtual('isDraft').get(function() {
  return this.status === 'draft';
});

reportSchema.virtual('isGenerating').get(function() {
  return this.status === 'generating';
});

reportSchema.virtual('isFailed').get(function() {
  return this.status === 'failed';
});

reportSchema.virtual('isArchived').get(function() {
  return this.status === 'archived';
});

reportSchema.virtual('isScheduled').get(function() {
  return this.scheduling.enabled;
});

reportSchema.virtual('hasFile').get(function() {
  return this.file && this.file.url && this.file.path;
});

reportSchema.virtual('isShared').get(function() {
  return this.sharing.sharedWith && this.sharing.sharedWith.length > 0;
});

reportSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

reportSchema.virtual('insightCount').get(function() {
  return this.insights ? this.insights.length : 0;
});

// ============ PRE-SAVE MIDDLEWARE ============

reportSchema.pre('save', async function() {
  try {
    this.updatedAt = new Date();

    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.description) this.description = this.description.trim();

    if (!this.factoryId) {
      throw new Error('factoryId is required');
    }

    if (!this.name) {
      throw new Error('Name is required');
    }

    if (!this.code) {
      throw new Error('Code is required');
    }

    if (!this.type) {
      throw new Error('Type is required');
    }

    if (!this.period || !this.period.startDate || !this.period.endDate) {
      throw new Error('Period startDate and endDate are required');
    }

    if (new Date(this.period.startDate) > new Date(this.period.endDate)) {
      throw new Error('Start date must be before end date');
    }

    // حساب year, month, quarter تلقائياً
    const startDate = new Date(this.period.startDate);
    this.period.year = startDate.getFullYear();
    this.period.month = startDate.getMonth() + 1;
    this.period.quarter = Math.ceil((startDate.getMonth() + 1) / 3);

    // تحديث summary إذا كان التقرير مكتمل
    if (this.data && Object.keys(this.data).length > 0 && this.status === 'completed') {
      const values = Object.values(this.data).filter(v => typeof v === 'number' && !isNaN(v));
      if (values.length > 0) {
        this.summary.total = values.reduce((a, b) => a + b, 0);
        this.summary.average = this.summary.total / values.length;
        this.summary.min = Math.min(...values);
        this.summary.max = Math.max(...values);
        this.summary.count = values.length;
      }
    }

    // حساب موعد التوليد القادم
    if (this.scheduling && this.scheduling.enabled) {
      this.scheduling.nextGeneration = this.calculateNextGeneration();
    }

    // ترتيب الأقسام
    if (this.sections && this.sections.length > 0) {
      this.sections = this.sections
        .map(section => ({
          ...section,
          title: section.title ? section.title.trim() : section.title,
          content: section.content ? section.content.trim() : section.content
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // ✅ التحقق من companyId
    if (!this.companyId) {
      throw new Error('Company ID is required');
    }

    if (!this.companyId.startsWith('comp_')) {
      throw new Error('Company ID must start with "comp_"');
    }
  } catch (error) {
    throw error;
  }
});

// ============ PRE-VALIDATE MIDDLEWARE ============

reportSchema.pre('validate', async function() {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }

    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }

    if (this.description) {
      this.description = this.description.trim();
    }

    if (this.period && this.period.startDate && this.period.endDate) {
      if (new Date(this.period.startDate) > new Date(this.period.endDate)) {
        throw new Error('Start date must be before end date');
      }
    }

    if (this.scheduling && this.scheduling.enabled) {
      if (this.scheduling.frequency === 'weekly' && !this.scheduling.dayOfWeek) {
        throw new Error('Day of week is required for weekly schedule');
      }
      if (this.scheduling.frequency === 'monthly' && !this.scheduling.dayOfMonth) {
        throw new Error('Day of month is required for monthly schedule');
      }
      if (this.scheduling.frequency === 'quarterly' && !this.scheduling.dayOfMonth) {
        throw new Error('Day of month is required for quarterly schedule');
      }
    }

    // ✅ التحقق من companyId
    if (!this.companyId) {
      throw new Error('Company ID is required');
    }

    if (!this.companyId.startsWith('comp_')) {
      throw new Error('Company ID must start with "comp_"');
    }
  } catch (error) {
    throw error;
  }
});

// ============ PRE-FINDONEANDUPDATE MIDDLEWARE ============

reportSchema.pre('findOneAndUpdate', async function() {
  try {
    this.set({ updatedAt: new Date() });
  } catch (error) {
    throw error;
  }
});

// ============ POST-SAVE MIDDLEWARE (بدون next) ============

reportSchema.post('save', function(doc) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Report saved successfully:', doc._id);
  }
});

// ✅ معالج الأخطاء - لازم 3 parameters (error, doc, next) عشان مونجوز
// يتعرف عليها كـ error-handling middleware فعلاً.
// (لو سبتها بباراميترين بس، مونجوز هيفهمها غلط كـ async post hook عادي
// وهيبعتلها الـ doc مكان الـ error، وده اللي كان بيطلع "undefined" في اللوج
// حتى لما الحفظ بينجح).
reportSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving report:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

reportSchema.post('findOneAndUpdate', function(doc) {
  if (doc && process.env.NODE_ENV !== 'production') {
    console.log('✅ Report updated successfully:', doc._id);
  }
});

// ✅ معالج الأخطاء لـ findOneAndUpdate - نفس المبدأ: 3 parameters
reportSchema.post('findOneAndUpdate', function(error, doc, next) {
  if (error) {
    console.error('❌ Error updating report:', error.message);
  }
  next(error);
});

// ============ METHODS ============

/**
 * بدء توليد التقرير
 */
reportSchema.methods.startGeneration = function() {
  if (this.status === 'generating') {
    throw new Error('Report is already being generated');
  }
  this.status = 'generating';
  return this.save();
};

/**
 * إكمال التقرير
 */
reportSchema.methods.complete = function(fileData = null) {
  if (this.status !== 'generating') {
    throw new Error('Report must be in generating state to complete');
  }

  this.status = 'completed';
  if (fileData) {
    this.file = {
      ...this.file,
      ...fileData,
      generatedAt: new Date()
    };
  }
  this.scheduling.lastGenerated = new Date();

  if (this.scheduling && this.scheduling.enabled) {
    this.scheduling.nextGeneration = this.calculateNextGeneration();
  }

  return this.save();
};

/**
 * فشل التقرير
 */
reportSchema.methods.fail = function(error) {
  if (this.status !== 'generating') {
    throw new Error('Report must be in generating state to fail');
  }

  this.status = 'failed';
  this.metadata = {
    ...this.metadata,
    error: error ? error.message || error : 'Unknown error',
    failedAt: new Date()
  };
  return this.save();
};

/**
 * إضافة تعليق
 */
reportSchema.methods.addComment = function(userId, userName, content) {
  if (!userId || !userName || !content) {
    throw new Error('userId, userName, and content are required');
  }

  this.comments.push({
    userId,
    userName: userName.trim(),
    content: content.trim()
  });
  return this.save();
};

/**
 * حذف تعليق
 */
reportSchema.methods.deleteComment = function(commentId, userId) {
  if (!commentId) {
    throw new Error('commentId is required');
  }

  const commentIndex = this.comments.findIndex(c => c._id.toString() === commentId);
  if (commentIndex === -1) {
    throw new Error('Comment not found');
  }

  if (this.comments[commentIndex].userId !== userId) {
    throw new Error('You can only delete your own comments');
  }

  this.comments.splice(commentIndex, 1);
  return this.save();
};

/**
 * مشاركة التقرير
 */
reportSchema.methods.share = function(userIds) {
  if (!userIds || userIds.length === 0) {
    throw new Error('userIds are required');
  }

  this.sharing.sharedWith = [...new Set([...this.sharing.sharedWith, ...userIds])];
  this.sharing.sharedAt = new Date();
  return this.save();
};

/**
 * إلغاء المشاركة
 */
reportSchema.methods.unshare = function(userIds) {
  if (!userIds || userIds.length === 0) {
    throw new Error('userIds are required');
  }

  this.sharing.sharedWith = this.sharing.sharedWith.filter(
    id => !userIds.includes(id)
  );

  if (this.sharing.sharedWith.length === 0) {
    this.sharing.sharedAt = null;
  }

  return this.save();
};

/**
 * تحديث جدولة التقرير
 */
reportSchema.methods.updateSchedule = function(scheduleData) {
  if (!scheduleData) {
    throw new Error('scheduleData is required');
  }

  this.scheduling = {
    ...this.scheduling,
    ...scheduleData,
    enabled: true
  };
  this.scheduling.nextGeneration = this.calculateNextGeneration();
  return this.save();
};

/**
 * إيقاف الجدولة
 */
reportSchema.methods.disableSchedule = function() {
  this.scheduling.enabled = false;
  this.scheduling.nextGeneration = null;
  return this.save();
};

/**
 * حساب موعد التوليد القادم
 */
reportSchema.methods.calculateNextGeneration = function() {
  if (!this.scheduling || !this.scheduling.enabled) {
    return null;
  }

  const now = new Date();
  let next = new Date(now);

  switch (this.scheduling.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      const currentDay = next.getDay();
      const targetDay = this.scheduling.dayOfWeek || 1;
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      next.setDate(next.getDate() + daysToAdd);
      break;
    case 'monthly':
      const targetDayOfMonth = this.scheduling.dayOfMonth || 1;
      next.setMonth(next.getMonth() + 1);
      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDayOfMonth, lastDayOfMonth));
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      const targetDayOfMonthQ = this.scheduling.dayOfMonth || 1;
      const lastDayOfMonthQ = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDayOfMonthQ, lastDayOfMonthQ));
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  const timeParts = (this.scheduling.time || '08:00').split(':');
  next.setHours(parseInt(timeParts[0]) || 8, parseInt(timeParts[1]) || 0, 0, 0);

  return next;
};

/**
 * إضافة Insight
 */
reportSchema.methods.addInsight = function(insight) {
  if (!insight || !insight.title || !insight.description) {
    throw new Error('Insight must have title and description');
  }

  this.insights.push({
    ...insight,
    title: insight.title.trim(),
    description: insight.description.trim()
  });
  return this.save();
};

/**
 * حذف Insight
 */
reportSchema.methods.deleteInsight = function(insightId) {
  if (!insightId) {
    throw new Error('insightId is required');
  }

  const insightIndex = this.insights.findIndex(i => i._id.toString() === insightId);
  if (insightIndex === -1) {
    throw new Error('Insight not found');
  }

  this.insights.splice(insightIndex, 1);
  return this.save();
};

/**
 * تحديث حالة التقرير
 */
reportSchema.methods.updateStatus = function(status) {
  const validStatuses = ['draft', 'generating', 'completed', 'failed', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  this.status = status;
  return this.save();
};

/**
 * أرشفة التقرير
 */
reportSchema.methods.archive = function(reason = null) {
  if (this.status === 'archived') {
    throw new Error('Report is already archived');
  }

  this.status = 'archived';
  if (reason) {
    this.metadata = {
      ...this.metadata,
      archivedReason: reason,
      archivedAt: new Date()
    };
  }
  return this.save();
};

/**
 * استعادة التقرير من الأرشفة
 */
reportSchema.methods.restore = function() {
  if (this.status !== 'archived') {
    throw new Error('Only archived reports can be restored');
  }

  this.status = 'draft';
  if (this.metadata && this.metadata.archivedReason) {
    delete this.metadata.archivedReason;
    delete this.metadata.archivedAt;
  }
  return this.save();
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

/**
 * البيانات الكاملة للإدارة
 */
reportSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    factoryId: this.factoryId,
    companyId: this.companyId,
    data: this.data,
    charts: this.charts,
    tables: this.tables,
    sections: this.sections,
    filters: this.filters,
    delivery: this.delivery,
    sharing: this.sharing,
    comments: this.comments,
    insights: this.insights,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * الحصول على التقارير حسب النوع
 */
reportSchema.statics.findByType = async function(companyId, type) {
  if (!companyId || !type) {
    throw new Error('companyId and type are required');
  }

  return this.find({
    companyId,
    type,
    deletedAt: null
  }).sort({ createdAt: -1 }).lean();
};

/**
 * الحصول على التقارير حسب الفترة
 */
reportSchema.statics.findByPeriod = async function(companyId, startDate, endDate) {
  if (!companyId || !startDate || !endDate) {
    throw new Error('companyId, startDate, and endDate are required');
  }

  return this.find({
    companyId,
    'period.startDate': { $gte: new Date(startDate) },
    'period.endDate': { $lte: new Date(endDate) },
    deletedAt: null
  }).sort({ createdAt: -1 }).lean();
};

/**
 * الحصول على التقارير حسب المصنع
 */
reportSchema.statics.findByFactory = async function(factoryId, companyId) {
  if (!factoryId || !companyId) {
    throw new Error('factoryId and companyId are required');
  }

  return this.find({
    factoryId,
    companyId,
    deletedAt: null
  }).sort({ createdAt: -1 }).lean();
};

/**
 * الحصول على التقارير حسب الحالة
 */
reportSchema.statics.findByStatus = async function(companyId, status) {
  if (!companyId || !status) {
    throw new Error('companyId and status are required');
  }

  return this.find({
    companyId,
    status,
    deletedAt: null
  }).sort({ createdAt: -1 }).lean();
};

/**
 * الحصول على إحصائيات التقارير
 */
reportSchema.statics.getStats = async function(companyId) {
  if (!companyId) {
    return {
      total: 0,
      completed: 0,
      generating: 0,
      failed: 0,
      draft: 0,
      archived: 0
    };
  }

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
        },
        archived: {
          $sum: {
            $cond: [{ $eq: ['$status', 'archived'] }, 1, 0]
          }
        }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    completed: 0,
    generating: 0,
    failed: 0,
    draft: 0,
    archived: 0
  };
};

/**
 * الحصول على توزيع التقارير حسب النوع
 */
reportSchema.statics.getTypeDistribution = async function(companyId) {
  if (!companyId) return [];

  return this.aggregate([
    { $match: { companyId, deletedAt: null } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

/**
 * الحصول على توزيع التقارير حسب الحالة
 */
reportSchema.statics.getStatusDistribution = async function(companyId) {
  if (!companyId) return [];

  return this.aggregate([
    { $match: { companyId, deletedAt: null } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
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
  }).sort({ 'scheduling.nextGeneration': 1 });
};

/**
 * الحصول على التقارير المنتهية (expired)
 */
reportSchema.statics.findExpired = async function(days = 30) {
  if (!days || days < 1) {
    throw new Error('Days must be a positive number');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.find({
    'file.generatedAt': { $lt: cutoffDate },
    status: 'completed',
    deletedAt: null
  }).lean();
};

/**
 * حذف التقارير القديمة
 */
reportSchema.statics.deleteOld = async function(days = 90) {
  if (!days || days < 1) {
    throw new Error('Days must be a positive number');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['archived', 'failed'] },
    deletedAt: null
  });
};

// ============ EXPORT ============

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;