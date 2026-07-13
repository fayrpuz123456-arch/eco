const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const BaseModel = require('../../../core/base/BaseModel');

// ============ DASHBOARD SCHEMA ============

const dashboardSchema = new mongoose.Schema({
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
    enum: ['active', 'archived'],
    default: 'active'
  },

  // ===== Basic Information =====
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  type: {
    type: String,
    enum: [
      'overview',        // نظرة عامة
      'sustainability',  // الاستدامة
      'production',      // الإنتاج
      'energy',          // الطاقة
      'water',           // المياه
      'carbon',          // الكربون
      'waste',           // النفايات
      'maintenance',     // الصيانة
      'financial',       // المالية
      'custom'           // مخصص
    ],
    required: true,
    index: true
  },
  layout: {
    type: String,
    enum: ['grid', 'list', 'flex', 'custom'],
    default: 'grid'
  },

  // ===== Widgets =====
  widgets: {
    type: [{
      id: { type: String, required: true },
      type: {
        type: String,
        enum: [
          'kpi',           // مؤشر أداء رئيسي
          'chart',         // مخطط
          'table',         // جدول
          'list',          // قائمة
          'map',           // خريطة
          'gauge',         // مقياس
          'progress',      // تقدم
          'calendar',      // تقويم
          'alerts',        // تنبيهات
          'notifications', // إشعارات
          'reports',       // تقارير
          'custom'         // مخصص
        ],
        required: true
      },
      title: { type: String, required: true },
      description: { type: String },
      size: {
        width: { type: Number, default: 2 },
        height: { type: Number, default: 2 }
      },
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      refreshInterval: { type: Number, default: 0 }, // بالثواني
      isVisible: { type: Boolean, default: true },
      order: { type: Number, default: 0 }
    }],
    default: []
  },

  // ===== Filters =====
  filters: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ['date', 'dateRange', 'select', 'multiSelect', 'text', 'number'],
        required: true
      },
      options: { type: mongoose.Schema.Types.Mixed },
      value: { type: mongoose.Schema.Types.Mixed },
      isActive: { type: Boolean, default: true }
    }],
    default: []
  },

  // ===== Time Period =====
  timePeriod: {
    type: {
      type: String,
      enum: ['today', 'week', 'month', 'quarter', 'year', 'custom'],
      default: 'week'
    },
    startDate: { type: Date },
    endDate: { type: Date },
    customRange: {
      startDate: { type: Date },
      endDate: { type: Date }
    }
  },

  // ===== Preferences =====
  preferences: {
    refreshRate: { type: Number, default: 30 }, // بالثواني
    autoRefresh: { type: Boolean, default: true },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    viewMode: {
      type: String,
      enum: ['compact', 'normal', 'expanded'],
      default: 'normal'
    },
    columns: { type: Number, default: 4 }
  },

  // ===== Settings =====
  settings: {
    isDefault: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
    sharedWith: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    tags: { type: [String], default: [] }
  },

  // ===== Metrics Cache =====
  metricsCache: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Last Updated =====
  lastUpdated: { type: Date, default: Date.now },

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

dashboardSchema.index({ companyId: 1, userId: 1 });
dashboardSchema.index({ userId: 1, type: 1 });
dashboardSchema.index({ companyId: 1, 'settings.isDefault': 1 });
dashboardSchema.index({ userId: 1, 'settings.pinned': 1 });
dashboardSchema.index({ createdAt: -1 });
dashboardSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

dashboardSchema.virtual('isDefault').get(function() {
  return this.settings.isDefault;
});

dashboardSchema.virtual('isPinned').get(function() {
  return this.settings.pinned;
});

dashboardSchema.virtual('widgetCount').get(function() {
  return this.widgets.filter(w => w.isVisible).length;
});

// ============ METHODS ============

/**
 * إضافة عنصر واجهة
 */
dashboardSchema.methods.addWidget = function(widget) {
  widget.id = widget.id || uuidv4();
  widget.order = this.widgets.length;
  this.widgets.push(widget);
  return this.save();
};

/**
 * إزالة عنصر واجهة
 */
dashboardSchema.methods.removeWidget = function(widgetId) {
  this.widgets = this.widgets.filter(w => w.id !== widgetId);
  return this.save();
};

/**
 * تحديث عنصر واجهة
 */
dashboardSchema.methods.updateWidget = function(widgetId, data) {
  const widget = this.widgets.find(w => w.id === widgetId);
  if (widget) {
    Object.assign(widget, data);
  }
  return this.save();
};

/**
 * تحديث ترتيب العناصر
 */
dashboardSchema.methods.reorderWidgets = function(widgetIds) {
  const newOrder = [];
  for (const id of widgetIds) {
    const widget = this.widgets.find(w => w.id === id);
    if (widget) {
      widget.order = newOrder.length;
      newOrder.push(widget);
    }
  }
  // إضافة أي عناصر غير موجودة في القائمة
  for (const widget of this.widgets) {
    if (!widgetIds.includes(widget.id)) {
      widget.order = newOrder.length;
      newOrder.push(widget);
    }
  }
  this.widgets = newOrder;
  return this.save();
};

/**
 * تحديث البيانات المخزنة مؤقتاً
 */
dashboardSchema.methods.updateCache = function(metrics) {
  this.metricsCache = metrics;
  this.lastUpdated = new Date();
  return this.save();
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
dashboardSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    layout: this.layout,
    widgets: this.widgets.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      size: w.size,
      position: w.position,
      isVisible: w.isVisible
    })),
    timePeriod: this.timePeriod,
    preferences: this.preferences,
    settings: this.settings,
    lastUpdated: this.lastUpdated,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

/**
 * الحصول على لوحات التحكم للمستخدم
 */
dashboardSchema.statics.findByUser = async function(userId, companyId) {
  return this.find({
    userId,
    companyId,
    deletedAt: null
  }).sort({ 'settings.pinned': -1, createdAt: -1 });
};

/**
 * الحصول على لوحة التحكم الافتراضية
 */
dashboardSchema.statics.findDefault = async function(userId, companyId) {
  return this.findOne({
    userId,
    companyId,
    'settings.isDefault': true,
    deletedAt: null
  });
};

/**
 * الحصول على لوحات التحكم حسب النوع
 */
dashboardSchema.statics.findByType = async function(userId, companyId, type) {
  return this.find({
    userId,
    companyId,
    type,
    deletedAt: null
  }).sort({ createdAt: -1 });
};

/**
 * الحصول على لوحات التحكم المثبتة
 */
dashboardSchema.statics.findPinned = async function(userId, companyId) {
  return this.find({
    userId,
    companyId,
    'settings.pinned': true,
    deletedAt: null
  }).sort({ createdAt: -1 });
};

// ============ MIDDLEWARE ============

// Pre-save: تحديث updatedAt
dashboardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============ EXPORT ============

const Dashboard = mongoose.model('Dashboard', dashboardSchema);

module.exports = Dashboard;