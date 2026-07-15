const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
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
    maxlength: 20
  },
  type: {
    type: String,
    required: true,
    enum: [
      'cnc_machine', 'lathe', 'milling', 'drilling', 'grinding',
      'welding', 'press', 'injection_molding', 'extrusion', 'stamping',
      'laser', 'waterjet', 'plasma', 'packaging', 'labeling',
      'capping', 'filling', 'conveyor', 'forklift', 'crane',
      'generator', 'compressor', 'boiler', 'chiller', 'pump',
      'quality_inspection', 'testing', 'measurement', 'other'
    ]
  },
  factoryId: {
    type: String,
    required: true,
    index: true
  },
  departmentId: {
    type: String,
    required: true,
    index: true
  },
  productionLineId: {
    type: String,
    default: null,
    index: true
  },
  model: {
    type: String,
    default: null
  },
  serialNumber: {
    type: String,
    default: null
  },
  manufacturer: {
    type: String,
    default: null
  },
  yearOfManufacture: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1,
    default: null
  },
  installationDate: {
    type: Date,
    default: null
  },
  warrantyExpiry: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'operational', 'maintenance', 'idle', 'offline', 'error', 'archived'],
    default: 'active'
  },
  operationalStatus: {
    type: String,
    enum: ['running', 'stopped', 'idle', 'maintenance', 'error', 'offline'],
    default: 'idle'
  },
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  performance: {
    oee: { type: Number, min: 0, max: 100, default: 0 },
    availability: { type: Number, min: 0, max: 100, default: 0 },
    performance: { type: Number, min: 0, max: 100, default: 0 },
    quality: { type: Number, min: 0, max: 100, default: 0 },
    throughput: { type: Number, default: 0, min: 0 },
    cycleTime: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
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
    }
  },
  energy: {
    consumption: { type: Number, default: 0, min: 0 },
    efficiency: { type: Number, min: 0, max: 100, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  sensors: {
    sensorIds: { type: [String], default: [] },
    total: { type: Number, default: 0, min: 0 },
    active: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: String,
    default: null
  },
  deletedReason: {
    type: String,
    default: null
  }
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

machineSchema.index({ code: 1, factoryId: 1 }, { unique: true });
machineSchema.index({ factoryId: 1, departmentId: 1 });
machineSchema.index({ factoryId: 1, status: 1 });
machineSchema.index({ departmentId: 1, status: 1 });
machineSchema.index({ productionLineId: 1 });
machineSchema.index({ type: 1 });
machineSchema.index({ status: 1 });
machineSchema.index({ operationalStatus: 1 });
machineSchema.index({ 'performance.oee': 1 });
machineSchema.index({ tags: 1 });
machineSchema.index({ createdAt: -1 });
machineSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

machineSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'operational' && !this.deletedAt;
});

machineSchema.virtual('isOperational').get(function() {
  return this.operationalStatus === 'running' && this.isActive;
});

machineSchema.virtual('isUnderMaintenance').get(function() {
  return this.operationalStatus === 'maintenance' || this.status === 'maintenance';
});

machineSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

machineSchema.virtual('overallOEE').get(function() {
  return this.performance.oee || 0;
});

// ============ PRE-SAVE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-save middleware
// تجنباً لتكرار Pre-save hooks

/*
machineSchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.model) this.model = this.model.trim();
    if (this.serialNumber) this.serialNumber = this.serialNumber.trim();
    if (this.manufacturer) this.manufacturer = this.manufacturer.trim();
    if (this.description) this.description = this.description.trim();
    
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.code) {
      return next(new Error('Code is required'));
    }
    
    if (!this.type) {
      return next(new Error('Type is required'));
    }
    
    if (!this.factoryId) {
      return next(new Error('Factory ID is required'));
    }
    
    if (!this.departmentId) {
      return next(new Error('Department ID is required'));
    }
    
    const codeRegex = /^[A-Z0-9]+$/;
    if (this.code && !codeRegex.test(this.code)) {
      return next(new Error('Code must contain only uppercase letters and numbers'));
    }
    
    if (this.yearOfManufacture) {
      const currentYear = new Date().getFullYear();
      if (this.yearOfManufacture < 1900 || this.yearOfManufacture > currentYear + 1) {
        return next(new Error(`Year of manufacture must be between 1900 and ${currentYear + 1}`));
      }
    }
    
    this.performance.lastUpdated = new Date();
    this.energy.lastUpdated = new Date();
    this.sensors.lastUpdated = new Date();
    
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-VALIDATE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-validate

/*
machineSchema.pre('validate', function(next) {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    
    if (this.model) {
      this.model = this.model.trim();
    }
    
    if (this.serialNumber) {
      this.serialNumber = this.serialNumber.trim();
    }
    
    if (this.manufacturer) {
      this.manufacturer = this.manufacturer.trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
    }
    
    if (this.installationDate && this.warrantyExpiry) {
      if (new Date(this.installationDate) > new Date(this.warrantyExpiry)) {
        return next(new Error('Installation date must be before warranty expiry date'));
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
machineSchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ 'performance.lastUpdated': new Date() });
    this.set({ 'energy.lastUpdated': new Date() });
    this.set({ 'sensors.lastUpdated': new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEONE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateOne

/*
machineSchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ 'performance.lastUpdated': new Date() });
    this.set({ 'energy.lastUpdated': new Date() });
    this.set({ 'sensors.lastUpdated': new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEMANY MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateMany

/*
machineSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ POST-SAVE MIDDLEWARE ============

machineSchema.post('save', function(doc) {
  console.log('✅ Machine saved successfully:', doc._id);
});

machineSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving machine:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

machineSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Machine updated successfully:', doc._id);
  }
});

// ============ METHODS ============

/**
 * تحديث أداء الماكينة
 */
machineSchema.methods.updatePerformance = function(performance) {
  if (performance.oee !== undefined) this.performance.oee = Math.min(100, Math.max(0, performance.oee));
  if (performance.availability !== undefined) this.performance.availability = Math.min(100, Math.max(0, performance.availability));
  if (performance.performance !== undefined) this.performance.performance = Math.min(100, Math.max(0, performance.performance));
  if (performance.quality !== undefined) this.performance.quality = Math.min(100, Math.max(0, performance.quality));
  if (performance.throughput !== undefined) this.performance.throughput = Math.max(0, performance.throughput);
  if (performance.cycleTime !== undefined) this.performance.cycleTime = Math.max(0, performance.cycleTime);
  this.performance.lastUpdated = new Date();
  return this.save();
};

/**
 * تحديث حالة التشغيل
 */
machineSchema.methods.updateOperationalStatus = function(status) {
  const validStatuses = ['running', 'stopped', 'idle', 'maintenance', 'error', 'offline'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid operational status. Must be one of: ${validStatuses.join(', ')}`);
  }
  this.operationalStatus = status;
  return this.save();
};

/**
 * تحديث حالة الماكينة
 */
machineSchema.methods.updateStatus = function(status) {
  const validStatuses = ['active', 'inactive', 'operational', 'maintenance', 'idle', 'offline', 'error', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  this.status = status;
  return this.save();
};

/**
 * تحديث إحصائيات الحساسات
 */
machineSchema.methods.updateSensors = function(sensors) {
  if (sensors.sensorIds !== undefined) this.sensors.sensorIds = sensors.sensorIds;
  if (sensors.total !== undefined) this.sensors.total = sensors.total;
  if (sensors.active !== undefined) this.sensors.active = sensors.active;
  this.sensors.lastUpdated = new Date();
  return this.save();
};

/**
 * إضافة سجل صيانة
 */
machineSchema.methods.addMaintenanceRecord = function(record) {
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
 * تحديث استهلاك الطاقة
 */
machineSchema.methods.updateEnergy = function(consumption, efficiency) {
  if (consumption !== undefined) this.energy.consumption = Math.max(0, consumption);
  if (efficiency !== undefined) this.energy.efficiency = Math.min(100, Math.max(0, efficiency));
  this.energy.lastUpdated = new Date();
  return this.save();
};

/**
 * حساب OEE تلقائياً
 */
machineSchema.methods.calculateOEE = function() {
  const availability = this.performance.availability / 100;
  const performance = this.performance.performance / 100;
  const quality = this.performance.quality / 100;
  this.performance.oee = Math.round((availability * performance * quality) * 100);
  return this;
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
machineSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    model: this.model,
    serialNumber: this.serialNumber,
    manufacturer: this.manufacturer,
    yearOfManufacture: this.yearOfManufacture,
    status: this.status,
    operationalStatus: this.operationalStatus,
    isActive: this.isActive,
    isOperational: this.isOperational,
    isUnderMaintenance: this.isUnderMaintenance,
    performance: this.performance,
    energy: this.energy,
    createdAt: this.createdAt
  };
};

/**
 * البيانات الكاملة للإدارة
 */
machineSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    factoryId: this.factoryId,
    departmentId: this.departmentId,
    productionLineId: this.productionLineId,
    installationDate: this.installationDate,
    warrantyExpiry: this.warrantyExpiry,
    specifications: this.specifications,
    maintenance: this.maintenance,
    sensors: this.sensors,
    description: this.description,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن ماكينة بالكود
 */
machineSchema.statics.findByCode = function(code, factoryId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.findOne(query);
};

/**
 * البحث عن ماكينات حسب النوع
 */
machineSchema.statics.findByType = function(type, factoryId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن ماكينات حسب الحالة
 */
machineSchema.statics.findByStatus = function(status, factoryId) {
  const query = { status, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن ماكينات نشطة
 */
machineSchema.statics.findActive = function(factoryId) {
  const query = {
    status: { $in: ['active', 'operational'] },
    deletedAt: null
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن ماكينات تحت الصيانة
 */
machineSchema.statics.findUnderMaintenance = function(factoryId) {
  const query = {
    status: 'maintenance',
    deletedAt: null
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن ماكينات ذات OEE عالي
 */
machineSchema.statics.findHighPerformance = function(minOEE = 80, factoryId) {
  const query = {
    'performance.oee': { $gte: minOEE },
    deletedAt: null
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query).sort({ 'performance.oee': -1 });
};

/**
 * البحث النصي
 */
machineSchema.statics.search = function(searchTerm, factoryId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { type: searchRegex },
      { model: searchRegex },
      { serialNumber: searchRegex },
      { manufacturer: searchRegex },
      { description: searchRegex }
    ]
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * الحصول على إحصائيات الماكينات
 */
machineSchema.statics.getStats = async function(factoryId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $in: ['$status', ['active', 'operational']] }, 1, 0]
          }
        },
        operational: {
          $sum: {
            $cond: [{ $eq: ['$operationalStatus', 'running'] }, 1, 0]
          }
        },
        maintenance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0]
          }
        },
        idle: {
          $sum: {
            $cond: [{ $eq: ['$operationalStatus', 'idle'] }, 1, 0]
          }
        },
        offline: {
          $sum: {
            $cond: [{ $eq: ['$status', 'offline'] }, 1, 0]
          }
        },
        archived: {
          $sum: {
            $cond: [{ $eq: ['$status', 'archived'] }, 1, 0]
          }
        },
        avgOEE: { $avg: '$performance.oee' },
        avgAvailability: { $avg: '$performance.availability' },
        avgQuality: { $avg: '$performance.quality' },
        totalEnergy: { $sum: '$energy.consumption' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    operational: 0,
    maintenance: 0,
    idle: 0,
    offline: 0,
    archived: 0,
    avgOEE: 0,
    avgAvailability: 0,
    avgQuality: 0,
    totalEnergy: 0
  };
};

/**
 * توزيع الماكينات حسب النوع
 */
machineSchema.statics.getTypeDistribution = async function(factoryId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgOEE: { $avg: '$performance.oee' },
        totalEnergy: { $sum: '$energy.consumption' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

/**
 * الحصول على الماكينات التي تحتاج صيانة
 */
machineSchema.statics.findDueForMaintenance = async function(daysThreshold = 7, factoryId) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  
  const query = {
    'maintenance.nextMaintenance': { $lte: thresholdDate },
    deletedAt: null,
    status: { $in: ['active', 'operational'] }
  };
  if (factoryId) query.factoryId = factoryId;
  
  return this.find(query).sort({ 'maintenance.nextMaintenance': 1 });
};

// ============ EXPORT ============

const Machine = mongoose.model('Machine', machineSchema);

module.exports = Machine;