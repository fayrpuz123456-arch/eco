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
dashboardSchema.index({ name: 1 });
dashboardSchema.index({ type: 1 });

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

// ============ PRE-SAVE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-save middleware
// تجنباً لتكرار Pre-save hooks

/*
dashboardSchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    if (this.name) this.name = this.name.trim();
    if (this.description) this.description = this.description.trim();
    
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.userId) {
      return next(new Error('User ID is required'));
    }
    
    if (!this.companyId) {
      return next(new Error('Company ID is required'));
    }
    
    if (!this.type) {
      return next(new Error('Type is required'));
    }
    
    if (this.widgets && this.widgets.length > 0) {
      const widgetIds = new Set();
      for (const widget of this.widgets) {
        if (!widget.id) {
          widget.id = uuidv4();
        }
        if (widgetIds.has(widget.id)) {
          return next(new Error(`Duplicate widget ID found: ${widget.id}`));
        }
        widgetIds.add(widget.id);
        
        if (widget.title) widget.title = widget.title.trim();
        if (widget.description) widget.description = widget.description.trim();
      }
    }
    
    if (this.filters && this.filters.length > 0) {
      const filterIds = new Set();
      for (const filter of this.filters) {
        if (!filter.id) {
          return next(new Error('Filter ID is required'));
        }
        if (filterIds.has(filter.id)) {
          return next(new Error(`Duplicate filter ID found: ${filter.id}`));
        }
        filterIds.add(filter.id);
        
        if (filter.name) filter.name = filter.name.trim();
      }
    }
    
    this.lastUpdated = new Date();
    
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-VALIDATE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-validate

/*
dashboardSchema.pre('validate', function(next) {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
    }
    
    if (this.timePeriod) {
      if (this.timePeriod.startDate && this.timePeriod.endDate) {
        if (new Date(this.timePeriod.startDate) > new Date(this.timePeriod.endDate)) {
          return next(new Error('Start date must be before end date'));
        }
      }
      if (this.timePeriod.customRange) {
        if (this.timePeriod.customRange.startDate && this.timePeriod.customRange.endDate) {
          if (new Date(this.timePeriod.customRange.startDate) > new Date(this.timePeriod.customRange.endDate)) {
            return next(new Error('Custom range start date must be before end date'));
          }
        }
      }
    }
    
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-FINDONEANDUPDATE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-findOneAndUpdate

/*
dashboardSchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ lastUpdated: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEONE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateOne

/*
dashboardSchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ lastUpdated: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEMANY MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateMany

/*
dashboardSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ lastUpdated: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ POST-SAVE MIDDLEWARE ============

dashboardSchema.post('save', function(doc) {
  console.log('✅ Dashboard saved successfully:', doc._id);
});

dashboardSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving dashboard:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

dashboardSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Dashboard updated successfully:', doc._id);
  }
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
    description: this.description,
    type: this.type,
    layout: this.layout,
    widgets: this.widgets.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      description: w.description,
      size: w.size,
      position: w.position,
      isVisible: w.isVisible,
      refreshInterval: w.refreshInterval
    })),
    filters: this.filters.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      isActive: f.isActive
    })),
    timePeriod: this.timePeriod,
    preferences: this.preferences,
    settings: this.settings,
    widgetCount: this.widgetCount,
    lastUpdated: this.lastUpdated,
    createdAt: this.createdAt
  };
};

/**
 * البيانات الكاملة للإدارة
 */
dashboardSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    companyId: this.companyId,
    userId: this.userId,
    createdBy: this.createdBy,
    updatedBy: this.updatedBy,
    metricsCache: this.metricsCache,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason,
    status: this.status
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

/**
 * الحصول على إحصائيات لوحات التحكم
 */
dashboardSchema.statics.getStats = async function(userId, companyId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        userId, 
        companyId, 
        deletedAt: null 
      } 
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        },
        archived: {
          $sum: {
            $cond: [{ $eq: ['$status', 'archived'] }, 1, 0]
          }
        },
        default: {
          $sum: {
            $cond: ['$settings.isDefault', 1, 0]
          }
        },
        pinned: {
          $sum: {
            $cond: ['$settings.pinned', 1, 0]
          }
        },
        public: {
          $sum: {
            $cond: ['$settings.isPublic', 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    archived: 0,
    default: 0,
    pinned: 0,
    public: 0
  };
};

/**
 * نسخ لوحة تحكم
 */
dashboardSchema.statics.clone = async function(dashboardId, userId, newName) {
  const original = await this.findById(dashboardId);
  if (!original) {
    throw new Error('Dashboard not found');
  }
  
  const cloned = new this({
    ...original.toObject(),
    _id: uuidv4(),
    name: newName || `${original.name} (Copy)`,
    userId: userId || original.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      ...original.settings,
      isDefault: false,
      pinned: false
    }
  });
  
  // إعادة تعيين معرفات widgets
  cloned.widgets = cloned.widgets.map(w => ({
    ...w,
    id: uuidv4()
  }));
  
  return cloned.save();
};

// ============ EXPORT ============

const Dashboard = mongoose.model('Dashboard', dashboardSchema);

module.exports = Dashboard;