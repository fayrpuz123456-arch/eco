const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const BaseModel = require('../../../core/base/BaseModel');

// ============ PRODUCTION LINE SCHEMA ============

// استخدام BaseModel لإضافة الحقول الأساسية مع الاحتفاظ بالمخصصات
const productionLineSchema = BaseModel.createSchema({
  // ===== Base Fields (مضافة من BaseModel) =====
  // companyId, createdBy, updatedBy, createdAt, updatedAt, deletedAt, status, metadata
  
  // ===== Additional Fields =====
  factoryId: { type: String, required: true, index: true },
  departmentId: { type: String, required: true, index: true },

  // ===== Basic Information =====
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
    index: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 10,
    index: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  type: {
    type: String,
    enum: [
      'assembly', 'packaging', 'processing', 'manufacturing',
      'filling', 'cutting', 'welding', 'painting',
      'quality_control', 'testing', 'maintenance', 'material_handling', 'other'
    ],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['manual', 'semi_automated', 'fully_automated', 'robotic', 'hybrid'],
    default: 'semi_automated'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // ===== Production Details =====
  productionDetails: {
    capacityPerHour: { type: Number, default: 0, min: 0 },
    capacityPerShift: { type: Number, default: 0, min: 0 },
    capacityPerDay: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'units' },
    currentProduction: { type: Number, default: 0, min: 0 },
    targetProduction: { type: Number, default: 0, min: 0 },
    efficiency: { type: Number, min: 0, max: 100, default: 0 },
    utilization: { type: Number, min: 0, max: 100, default: 0 },
    qualityRate: { type: Number, min: 0, max: 100, default: 0 },
    scrapRate: { type: Number, min: 0, max: 100, default: 0 },
    reworkRate: { type: Number, min: 0, max: 100, default: 0 }
  },

  // ===== Operating Details =====
  operatingDetails: {
    shiftCount: { type: Number, min: 1, max: 5, default: 1 },
    operatingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '17:00' }
    },
    workingDays: {
      type: [String],
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    breaks: {
      type: [{
        start: { type: String },
        end: { type: String },
        duration: { type: Number, min: 0 }
      }],
      default: []
    },
    lastStartTime: { type: Date, default: null },
    lastStopTime: { type: Date, default: null },
    totalRunTime: { type: Number, default: 0, min: 0 },
    totalDowntime: { type: Number, default: 0, min: 0 }
  },

  // ===== Performance Metrics =====
  performance: {
    oee: { type: Number, min: 0, max: 100, default: 0 },
    availability: { type: Number, min: 0, max: 100, default: 0 },
    performance: { type: Number, min: 0, max: 100, default: 0 },
    quality: { type: Number, min: 0, max: 100, default: 0 },
    throughput: { type: Number, default: 0, min: 0 },
    cycleTime: { type: Number, default: 0, min: 0 },
    changeoverTime: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Quality Metrics =====
  quality: {
    totalProduced: { type: Number, default: 0, min: 0 },
    totalDefects: { type: Number, default: 0, min: 0 },
    totalScrap: { type: Number, default: 0, min: 0 },
    totalRework: { type: Number, default: 0, min: 0 },
    defectRate: { type: Number, min: 0, max: 100, default: 0 },
    qualityScore: { type: Number, min: 0, max: 100, default: 0 },
    lastInspection: { type: Date, default: null },
    nextInspection: { type: Date, default: null }
  },

  // ===== Machines =====
  machines: {
    total: { type: Number, default: 0, min: 0 },
    active: { type: Number, default: 0, min: 0 },
    idle: { type: Number, default: 0, min: 0 },
    maintenance: { type: Number, default: 0, min: 0 },
    offline: { type: Number, default: 0, min: 0 },
    machineIds: { type: [String], default: [] },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Employees =====
  employees: {
    total: { type: Number, default: 0, min: 0 },
    operators: { type: Number, default: 0, min: 0 },
    technicians: { type: Number, default: 0, min: 0 },
    supervisors: { type: Number, default: 0, min: 0 },
    currentShift: { type: Number, default: 1 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Sensors =====
  sensors: {
    total: { type: Number, default: 0, min: 0 },
    active: { type: Number, default: 0, min: 0 },
    offline: { type: Number, default: 0, min: 0 },
    sensorIds: { type: [String], default: [] },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Maintenance =====
  maintenance: {
    type: {
      type: String,
      enum: ['preventive', 'predictive', 'reactive', 'scheduled'],
      default: 'preventive'
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    lastMaintenance: { type: Date, default: null },
    nextMaintenance: { type: Date, default: null },
    maintenanceHistory: {
      type: [{
        date: { type: Date, default: Date.now },
        type: { type: String },
        description: { type: String },
        duration: { type: Number },
        performedBy: { type: String },
        cost: { type: Number }
      }],
      default: []
    },
    upcomingMaintenance: { type: Date, default: null }
  },

  // ===== Materials =====
  materials: {
    rawMaterials: {
      type: [{
        name: { type: String, trim: true },
        code: { type: String, trim: true },
        quantity: { type: Number, default: 0 },
        unit: { type: String, default: 'kg' },
        threshold: { type: Number, default: 0 }
      }],
      default: []
    },
    finishedGoods: {
      type: [{
        name: { type: String, trim: true },
        code: { type: String, trim: true },
        quantity: { type: Number, default: 0 },
        unit: { type: String, default: 'units' }
      }],
      default: []
    },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Energy & Environment =====
  environmental: {
    energyConsumption: { type: Number, default: 0, min: 0 },
    waterConsumption: { type: Number, default: 0, min: 0 },
    wasteProduction: { type: Number, default: 0, min: 0 },
    carbonFootprint: { type: Number, default: 0, min: 0 },
    greenScore: { type: Number, min: 0, max: 100, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Cost =====
  cost: {
    laborCost: { type: Number, default: 0, min: 0 },
    materialCost: { type: Number, default: 0, min: 0 },
    energyCost: { type: Number, default: 0, min: 0 },
    maintenanceCost: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== AI Insights =====
  insights: {
    type: [{
      title: { type: String },
      description: { type: String },
      type: { type: String, enum: ['insight', 'warning', 'opportunity'] },
      confidence: { type: Number, min: 0, max: 1 },
      recommendation: { type: String }
    }],
    default: []
  },

  // ===== Settings =====
  settings: {
    autoStart: { type: Boolean, default: false },
    autoStop: { type: Boolean, default: false },
    alertThresholds: {
      efficiency: { type: Number, min: 0, max: 100, default: 70 },
      quality: { type: Number, min: 0, max: 100, default: 80 },
      production: { type: Number, min: 0, default: 100 }
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true }
    }
  },

  // ===== Tags =====
  tags: {
    type: [String],
    default: [],
    index: true
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
  // خيارات إضافية
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

// فهارس فريدة
productionLineSchema.index({ name: 1, departmentId: 1, companyId: 1 }, { unique: true });
productionLineSchema.index({ code: 1, departmentId: 1, companyId: 1 }, { unique: true });

// فهارس للبحث
productionLineSchema.index({ factoryId: 1 });
productionLineSchema.index({ departmentId: 1 });
productionLineSchema.index({ type: 1 });
productionLineSchema.index({ category: 1 });
productionLineSchema.index({ priority: 1 });
productionLineSchema.index({ 'performance.oee': 1 });
productionLineSchema.index({ 'environmental.greenScore': 1 });
productionLineSchema.index({ tags: 1 });
productionLineSchema.index({ createdAt: -1 });

// ✅ تم إزالة indexes التالية لأنها معرفة بالفعل في BaseModel:
// - status (معرف في BaseModel)
// - deletedAt (معرف في BaseModel مع sparse: true)

// ============ VIRTUALS ============

productionLineSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

productionLineSchema.virtual('isRunning').get(function() {
  return this.status === 'active' && this.operatingDetails.lastStartTime && 
         (!this.operatingDetails.lastStopTime || this.operatingDetails.lastStartTime > this.operatingDetails.lastStopTime);
});

productionLineSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

productionLineSchema.virtual('totalMachineCount').get(function() {
  return this.machines.total || 0;
});

productionLineSchema.virtual('overallEfficiency').get(function() {
  return this.performance.oee || 0;
});

// ============ PRE-SAVE MIDDLEWARE (تم التعديل النهائي) ============

productionLineSchema.pre('save', function(next) {
  try {
    // تحديث updatedAt تلقائياً
    this.updatedAt = new Date();
    
    // تنظيف البيانات
    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.description) this.description = this.description.trim();
    
    // تنظيف بيانات المواد الخام
    if (this.materials && this.materials.rawMaterials) {
      for (const material of this.materials.rawMaterials) {
        if (material.name) material.name = material.name.trim();
        if (material.code) material.code = material.code.trim();
      }
    }
    
    // تنظيف بيانات المنتجات النهائية
    if (this.materials && this.materials.finishedGoods) {
      for (const good of this.materials.finishedGoods) {
        if (good.name) good.name = good.name.trim();
        if (good.code) good.code = good.code.trim();
      }
    }
    
    // التحقق من البيانات المطلوبة
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.code) {
      return next(new Error('Code is required'));
    }
    
    if (!this.factoryId) {
      return next(new Error('Factory ID is required'));
    }
    
    if (!this.departmentId) {
      return next(new Error('Department ID is required'));
    }
    
    if (!this.type) {
      return next(new Error('Type is required'));
    }
    
    // التحقق من صحة الكود
    const codeRegex = /^[A-Z0-9]+$/;
    if (this.code && !codeRegex.test(this.code)) {
      return next(new Error('Code must contain only uppercase letters and numbers'));
    }
    
    // حساب OEE تلقائياً إذا كانت البيانات متوفرة
    if (this.performance && this.performance.availability && 
        this.performance.performance && this.performance.quality) {
      this.calculateOEE();
    }
    
    // تحديث lastUpdated للحقول الفرعية
    this.performance.lastUpdated = new Date();
    this.quality.lastUpdated = new Date();
    this.machines.lastUpdated = new Date();
    this.sensors.lastUpdated = new Date();
    this.employees.lastUpdated = new Date();
    this.environmental.lastUpdated = new Date();
    this.cost.lastUpdated = new Date();
    this.materials.lastUpdated = new Date();
    
    // ✅ استدعاء next() في النهاية
    return next();
  } catch (error) {
    // ✅ في حالة الخطأ، مرر الخطأ لـ next
    return next(error);
  }
});

// ============ PRE-VALIDATE MIDDLEWARE ============

productionLineSchema.pre('validate', function(next) {
  try {
    // التحقق من صحة البيانات قبل الحفظ
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
    }
    
    // التحقق من أن أوقات التشغيل صحيحة
    if (this.operatingDetails && this.operatingDetails.operatingHours) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (this.operatingDetails.operatingHours.start && 
          !timeRegex.test(this.operatingDetails.operatingHours.start)) {
        return next(new Error('Invalid start time format. Use HH:MM'));
      }
      if (this.operatingDetails.operatingHours.end && 
          !timeRegex.test(this.operatingDetails.operatingHours.end)) {
        return next(new Error('Invalid end time format. Use HH:MM'));
      }
    }
    
    return next();
  } catch (error) {
    return next(error);
  }
});

// ============ PRE-FINDONEANDUPDATE MIDDLEWARE ============

productionLineSchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});

// ============ PRE-UPDATEONE MIDDLEWARE ============

productionLineSchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});

// ============ PRE-UPDATEMANY MIDDLEWARE ============

productionLineSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});

// ============ POST-SAVE MIDDLEWARE ============

productionLineSchema.post('save', function(doc) {
  console.log('✅ Production line saved successfully:', doc._id);
});

productionLineSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving production line:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

productionLineSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Production line updated successfully:', doc._id);
  }
});

// ============ METHODS ============

/**
 * تحديث أداء خط الإنتاج
 */
productionLineSchema.methods.updatePerformance = function(performance) {
  if (performance.oee !== undefined) this.performance.oee = Math.min(100, Math.max(0, performance.oee));
  if (performance.availability !== undefined) this.performance.availability = Math.min(100, Math.max(0, performance.availability));
  if (performance.performance !== undefined) this.performance.performance = Math.min(100, Math.max(0, performance.performance));
  if (performance.quality !== undefined) this.performance.quality = Math.min(100, Math.max(0, performance.quality));
  if (performance.throughput !== undefined) this.performance.throughput = Math.max(0, performance.throughput);
  if (performance.cycleTime !== undefined) this.performance.cycleTime = Math.max(0, performance.cycleTime);
  if (performance.changeoverTime !== undefined) this.performance.changeoverTime = Math.max(0, performance.changeoverTime);
  this.performance.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث إحصائيات الآلات
 */
productionLineSchema.methods.updateMachines = function(machines) {
  if (machines.total !== undefined) this.machines.total = machines.total;
  if (machines.active !== undefined) this.machines.active = machines.active;
  if (machines.idle !== undefined) this.machines.idle = machines.idle;
  if (machines.maintenance !== undefined) this.machines.maintenance = machines.maintenance;
  if (machines.offline !== undefined) this.machines.offline = machines.offline;
  if (machines.machineIds !== undefined) this.machines.machineIds = machines.machineIds;
  this.machines.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث إحصائيات الحساسات
 */
productionLineSchema.methods.updateSensors = function(sensors) {
  if (sensors.total !== undefined) this.sensors.total = sensors.total;
  if (sensors.active !== undefined) this.sensors.active = sensors.active;
  if (sensors.offline !== undefined) this.sensors.offline = sensors.offline;
  if (sensors.sensorIds !== undefined) this.sensors.sensorIds = sensors.sensorIds;
  this.sensors.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث الجودة
 */
productionLineSchema.methods.updateQuality = function(quality) {
  if (quality.totalProduced !== undefined) this.quality.totalProduced = quality.totalProduced;
  if (quality.totalDefects !== undefined) this.quality.totalDefects = quality.totalDefects;
  if (quality.totalScrap !== undefined) this.quality.totalScrap = quality.totalScrap;
  if (quality.totalRework !== undefined) this.quality.totalRework = quality.totalRework;
  if (quality.defectRate !== undefined) this.quality.defectRate = Math.min(100, Math.max(0, quality.defectRate));
  if (quality.qualityScore !== undefined) this.quality.qualityScore = Math.min(100, Math.max(0, quality.qualityScore));
  if (quality.lastInspection !== undefined) this.quality.lastInspection = quality.lastInspection;
  if (quality.nextInspection !== undefined) this.quality.nextInspection = quality.nextInspection;
  this.quality.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث درجة الخضرة
 */
productionLineSchema.methods.updateGreenScore = function(score) {
  this.environmental.greenScore = Math.min(100, Math.max(0, score));
  this.environmental.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث التكاليف
 */
productionLineSchema.methods.updateCost = function(cost) {
  if (cost.laborCost !== undefined) this.cost.laborCost = cost.laborCost;
  if (cost.materialCost !== undefined) this.cost.materialCost = cost.materialCost;
  if (cost.energyCost !== undefined) this.cost.energyCost = cost.energyCost;
  if (cost.maintenanceCost !== undefined) this.cost.maintenanceCost = cost.maintenanceCost;
  if (cost.totalCost !== undefined) this.cost.totalCost = cost.totalCost;
  if (cost.costPerUnit !== undefined) this.cost.costPerUnit = cost.costPerUnit;
  if (cost.currency !== undefined) this.cost.currency = cost.currency;
  this.cost.lastUpdated = new Date();
  return this.save();
};

/**
 * إضافة سجل صيانة
 */
productionLineSchema.methods.addMaintenanceRecord = function(record) {
  this.maintenance.maintenanceHistory.push({
    ...record,
    date: record.date || new Date()
  });
  this.maintenance.lastMaintenance = new Date();
  if (record.nextMaintenance) {
    this.maintenance.nextMaintenance = record.nextMaintenance;
  }
  return this.save();
};

/**
 * إضافة Insight
 */
productionLineSchema.methods.addInsight = function(insight) {
  this.insights.push(insight);
  return this.save();
};

/**
 * بدء التشغيل
 */
productionLineSchema.methods.start = function() {
  this.status = 'active';
  this.operatingDetails.lastStartTime = new Date();
  this.operatingDetails.lastStopTime = null;
  return this.save();
};

/**
 * إيقاف التشغيل
 */
productionLineSchema.methods.stop = function() {
  this.status = 'stopped';
  this.operatingDetails.lastStopTime = new Date();
  return this.save();
};

/**
 * حساب OEE تلقائياً - (بدون save لتجنب ParallelSaveError)
 */
productionLineSchema.methods.calculateOEE = function() {
  const availability = this.performance.availability / 100;
  const performance = this.performance.performance / 100;
  const quality = this.performance.quality / 100;
  this.performance.oee = Math.round((availability * performance * quality) * 100);
  return this; // ✅ فقط يرجع الـ document من غير save
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
productionLineSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    description: this.description,
    type: this.type,
    category: this.category,
    priority: this.priority,
    status: this.status,
    isActive: this.isActive,
    isRunning: this.isRunning,
    productionDetails: this.productionDetails,
    performance: this.performance,
    quality: this.quality,
    environmental: {
      greenScore: this.environmental.greenScore,
      energyConsumption: this.environmental.energyConsumption
    },
    createdAt: this.createdAt
  };
};

/**
 * البيانات الكاملة للإدارة
 */
productionLineSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    factoryId: this.factoryId,
    departmentId: this.departmentId,
    operatingDetails: this.operatingDetails,
    machines: this.machines,
    employees: this.employees,
    sensors: this.sensors,
    maintenance: this.maintenance,
    materials: this.materials,
    cost: this.cost,
    insights: this.insights,
    settings: this.settings,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن خط إنتاج بالكود
 */
productionLineSchema.statics.findByCode = function(code, departmentId, companyId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

/**
 * البحث عن خط إنتاج بالاسم
 */
productionLineSchema.statics.findByName = function(name, departmentId, companyId) {
  const query = { name: name.trim(), deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

/**
 * البحث عن خطوط إنتاج حسب النوع
 */
productionLineSchema.statics.findByType = function(type, departmentId, companyId) {
  const query = { type, deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

/**
 * البحث عن خطوط إنتاج حسب الفئة
 */
productionLineSchema.statics.findByCategory = function(category, departmentId, companyId) {
  const query = { category, deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

/**
 * البحث عن خطوط إنتاج نشطة
 */
productionLineSchema.statics.findActive = function(departmentId, companyId) {
  const query = { status: 'active', deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

/**
 * البحث عن خطوط إنتاج ذات أداء عالي (OEE)
 */
productionLineSchema.statics.findHighPerformance = function(minOEE = 80, departmentId, companyId) {
  const query = {
    'performance.oee': { $gte: minOEE },
    deletedAt: null
  };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ 'performance.oee': -1 });
};

/**
 * البحث النصي
 */
productionLineSchema.statics.search = function(searchTerm, departmentId, companyId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
      { type: searchRegex }
    ]
  };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

/**
 * الحصول على إحصائيات خط الإنتاج
 */
productionLineSchema.statics.getProductionLineStats = async function(productionLineId) {
  const stats = await this.aggregate([
    { $match: { _id: productionLineId, deletedAt: null } },
    {
      $lookup: {
        from: 'machines',
        localField: '_id',
        foreignField: 'productionLineId',
        as: 'machines'
      }
    },
    {
      $lookup: {
        from: 'sensors',
        localField: '_id',
        foreignField: 'productionLineId',
        as: 'sensors'
      }
    },
    {
      $lookup: {
        from: 'sensorreadings',
        localField: '_id',
        foreignField: 'productionLineId',
        as: 'readings'
      }
    },
    {
      $project: {
        productionLineId: '$_id',
        name: 1,
        code: 1,
        type: 1,
        status: 1,
        performance: 1,
        quality: 1,
        statistics: {
          totalMachines: { $size: '$machines' },
          totalSensors: { $size: '$sensors' },
          totalReadings: { $size: '$readings' }
        },
        createdAt: 1
      }
    }
  ]);
  
  return stats[0] || null;
};

/**
 * الحصول على إحصائيات القسم
 */
productionLineSchema.statics.getDepartmentProductionLineStats = async function(departmentId) {
  const stats = await this.aggregate([
    { $match: { departmentId, deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
        stopped: { $sum: { $cond: [{ $eq: ['$status', 'stopped'] }, 1, 0] } },
        avgOEE: { $avg: '$performance.oee' },
        avgQuality: { $avg: '$quality.qualityScore' },
        totalCapacity: { $sum: '$productionDetails.capacityPerDay' },
        totalMachines: { $sum: '$machines.total' },
        totalSensors: { $sum: '$sensors.total' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    maintenance: 0,
    stopped: 0,
    avgOEE: 0,
    avgQuality: 0,
    totalCapacity: 0,
    totalMachines: 0,
    totalSensors: 0
  };
};

/**
 * توزيع خطوط الإنتاج حسب النوع
 */
productionLineSchema.statics.getTypeDistribution = async function(departmentId, companyId) {
  const query = { deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  
  return this.aggregate([
    { $match: query },
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
 * توزيع خطوط الإنتاج حسب الفئة
 */
productionLineSchema.statics.getCategoryDistribution = async function(departmentId, companyId) {
  const query = { deletedAt: null };
  if (departmentId) query.departmentId = departmentId;
  if (companyId) query.companyId = companyId;
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// ============ EXPORT ============

const ProductionLine = mongoose.model('ProductionLine', productionLineSchema);

module.exports = ProductionLine;