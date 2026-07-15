const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
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
      'PZEM004T', 'Current', 'Voltage', 'Power', 'Energy',
      'WaterFlow', 'FuelFlow', 'WaterLevel', 'Pressure',
      'MQ135', 'MQ2', 'MQ7', 'CO2',
      'Temperature', 'Humidity', 'Rain', 'Ultrasonic', 'HeatSensor',
      'Vibration', 'Accelerometer', 'Gyroscope',
      'Light', 'Sound', 'Proximity', 'IR', 'GPS', 'RPM', 'Torque',
      'Force', 'Flow', 'Level', 'pH', 'Conductivity', 'Turbidity',
      'DissolvedOxygen', 'Other'
    ]
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  machineId: {
    type: String,
    required: true,
    index: true
  },
  factoryId: {
    type: String,
    required: true,
    index: true
  },
  departmentId: {
    type: String,
    default: null,
    index: true
  },
  productionLineId: {
    type: String,
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'offline', 'maintenance', 'error', 'archived'],
    default: 'active'
  },
  operationalStatus: {
    type: String,
    enum: ['online', 'offline', 'error', 'calibrating', 'maintenance'],
    default: 'online'
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  manufacturer: {
    type: String,
    default: null
  },
  model: {
    type: String,
    default: null
  },
  serialNumber: {
    type: String,
    default: null
  },
  installationDate: {
    type: Date,
    default: null
  },
  calibrationDate: {
    type: Date,
    default: null
  },
  nextCalibrationDate: {
    type: Date,
    default: null
  },
  calibrationInterval: {
    type: Number,
    default: 365, // أيام
    min: 1
  },
  specifications: {
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    resolution: { type: Number, default: null },
    responseTime: { type: Number, default: null },
    operatingTemperature: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    communicationProtocol: {
      type: String,
      enum: ['MQTT', 'HTTP', 'MODBUS', 'CAN', 'RS485', 'RS232', 'USB', 'BLE', 'ZigBee', 'LoRa', 'WiFi', 'Ethernet', 'Other'],
      default: 'MQTT'
    },
    additional: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  readings: {
    lastValue: { type: Number, default: null },
    lastReadingAt: { type: Date, default: null },
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    averageValue: { type: Number, default: null },
    totalReadings: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  thresholds: {
    warning: { type: Number, default: null },
    critical: { type: Number, default: null },
    minWarning: { type: Number, default: null },
    minCritical: { type: Number, default: null },
    maxWarning: { type: Number, default: null },
    maxCritical: { type: Number, default: null }
  },
  alerts: {
    total: { type: Number, default: 0, min: 0 },
    lastAlertAt: { type: Date, default: null },
    alertHistory: {
      type: [{
        timestamp: { type: Date, default: Date.now },
        type: { type: String, enum: ['warning', 'critical', 'info'] },
        message: { type: String },
        value: { type: Number }
      }],
      default: []
    }
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

sensorSchema.index({ code: 1, machineId: 1 }, { unique: true });
sensorSchema.index({ machineId: 1, type: 1 });
sensorSchema.index({ factoryId: 1, status: 1 });
sensorSchema.index({ departmentId: 1, status: 1 });
sensorSchema.index({ productionLineId: 1 });
sensorSchema.index({ type: 1 });
sensorSchema.index({ status: 1 });
sensorSchema.index({ operationalStatus: 1 });
sensorSchema.index({ tags: 1 });
sensorSchema.index({ createdAt: -1 });
sensorSchema.index({ 'readings.lastReadingAt': -1 });
sensorSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

sensorSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

sensorSchema.virtual('isOnline').get(function() {
  return this.operationalStatus === 'online' && this.isActive;
});

sensorSchema.virtual('needsCalibration').get(function() {
  if (!this.nextCalibrationDate) return false;
  return new Date(this.nextCalibrationDate) <= new Date();
});

sensorSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

sensorSchema.virtual('isThresholdExceeded').get(function() {
  if (this.readings.lastValue === null || this.readings.lastValue === undefined) return false;
  const value = this.readings.lastValue;
  
  // التحقق من الحدود القصوى
  if (this.thresholds.critical !== null && value >= this.thresholds.critical) return true;
  if (this.thresholds.maxCritical !== null && value >= this.thresholds.maxCritical) return true;
  
  // التحقق من الحدود الدنيا
  if (this.thresholds.minCritical !== null && value <= this.thresholds.minCritical) return true;
  
  return false;
});

// ============ PRE-SAVE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-save middleware
// تجنباً لتكرار Pre-save hooks

/*
sensorSchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.unit) this.unit = this.unit.trim();
    if (this.description) this.description = this.description.trim();
    if (this.manufacturer) this.manufacturer = this.manufacturer.trim();
    if (this.model) this.model = this.model.trim();
    if (this.serialNumber) this.serialNumber = this.serialNumber.trim();
    
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.code) {
      return next(new Error('Code is required'));
    }
    
    if (!this.type) {
      return next(new Error('Type is required'));
    }
    
    if (!this.unit) {
      return next(new Error('Unit is required'));
    }
    
    if (!this.machineId) {
      return next(new Error('Machine ID is required'));
    }
    
    if (!this.factoryId) {
      return next(new Error('Factory ID is required'));
    }
    
    const codeRegex = /^[A-Z0-9]+$/;
    if (this.code && !codeRegex.test(this.code)) {
      return next(new Error('Code must contain only uppercase letters and numbers'));
    }
    
    if (this.unit && this.unit.trim().length === 0) {
      return next(new Error('Unit cannot be empty'));
    }
    
    if (this.isModified('calibrationDate') && this.calibrationDate) {
      if (this.calibrationInterval) {
        const nextDate = new Date(this.calibrationDate);
        nextDate.setDate(nextDate.getDate() + this.calibrationInterval);
        this.nextCalibrationDate = nextDate;
      }
    }
    
    this.readings.lastUpdated = new Date();
    
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-VALIDATE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-validate

/*
sensorSchema.pre('validate', function(next) {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    
    if (this.unit) {
      this.unit = this.unit.trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
    }
    
    if (this.manufacturer) {
      this.manufacturer = this.manufacturer.trim();
    }
    
    if (this.model) {
      this.model = this.model.trim();
    }
    
    if (this.serialNumber) {
      this.serialNumber = this.serialNumber.trim();
    }
    
    if (this.installationDate && this.calibrationDate) {
      if (new Date(this.installationDate) > new Date(this.calibrationDate)) {
        return next(new Error('Installation date must be before calibration date'));
      }
    }
    
    if (this.thresholds) {
      if (this.thresholds.minWarning !== null && this.thresholds.maxWarning !== null) {
        if (this.thresholds.minWarning >= this.thresholds.maxWarning) {
          return next(new Error('Min warning must be less than max warning'));
        }
      }
      if (this.thresholds.minCritical !== null && this.thresholds.maxCritical !== null) {
        if (this.thresholds.minCritical >= this.thresholds.maxCritical) {
          return next(new Error('Min critical must be less than max critical'));
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
sensorSchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ 'readings.lastUpdated': new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEONE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateOne

/*
sensorSchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    this.set({ 'readings.lastUpdated': new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEMANY MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateMany

/*
sensorSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ POST-SAVE MIDDLEWARE ============

sensorSchema.post('save', function(doc) {
  console.log('✅ Sensor saved successfully:', doc._id);
});

sensorSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving sensor:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

sensorSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Sensor updated successfully:', doc._id);
  }
});

// ============ METHODS ============

/**
 * تحديث قراءة الحساس
 */
sensorSchema.methods.updateReading = function(value) {
  const currentValue = parseFloat(value);
  
  if (isNaN(currentValue)) {
    throw new Error('Invalid reading value');
  }
  
  // تحديث القراءة الحالية
  this.readings.lastValue = currentValue;
  this.readings.lastReadingAt = new Date();
  this.readings.totalReadings += 1;
  
  // تحديث الحد الأدنى
  if (this.readings.minValue === null || currentValue < this.readings.minValue) {
    this.readings.minValue = currentValue;
  }
  
  // تحديث الحد الأقصى
  if (this.readings.maxValue === null || currentValue > this.readings.maxValue) {
    this.readings.maxValue = currentValue;
  }
  
  // تحديث المتوسط
  if (this.readings.averageValue === null) {
    this.readings.averageValue = currentValue;
  } else {
    // متوسط متحرك
    const weight = 0.1; // وزن القراءة الجديدة
    this.readings.averageValue = (this.readings.averageValue * (1 - weight)) + (currentValue * weight);
  }
  
  this.readings.lastUpdated = new Date();
  
  // التحقق من الحدود وإنشاء تنبيه
  this.checkThresholds(currentValue);
  
  return this.save();
};

/**
 * التحقق من الحدود
 */
sensorSchema.methods.checkThresholds = function(value) {
  // التحقق من الحدود القصوى
  if (this.thresholds.critical !== null && value >= this.thresholds.critical) {
    this.addAlert('critical', `Critical threshold exceeded: ${value} ${this.unit}`, value);
    return;
  }
  
  if (this.thresholds.maxCritical !== null && value >= this.thresholds.maxCritical) {
    this.addAlert('critical', `Maximum critical threshold exceeded: ${value} ${this.unit}`, value);
    return;
  }
  
  if (this.thresholds.maxWarning !== null && value >= this.thresholds.maxWarning) {
    this.addAlert('warning', `Maximum warning threshold exceeded: ${value} ${this.unit}`, value);
    return;
  }
  
  // التحقق من الحدود الدنيا
  if (this.thresholds.minCritical !== null && value <= this.thresholds.minCritical) {
    this.addAlert('critical', `Minimum critical threshold exceeded: ${value} ${this.unit}`, value);
    return;
  }
  
  if (this.thresholds.minWarning !== null && value <= this.thresholds.minWarning) {
    this.addAlert('warning', `Minimum warning threshold exceeded: ${value} ${this.unit}`, value);
    return;
  }
};

/**
 * إضافة تنبيه
 */
sensorSchema.methods.addAlert = function(type, message, value) {
  this.alerts.total += 1;
  this.alerts.lastAlertAt = new Date();
  this.alerts.alertHistory.push({
    timestamp: new Date(),
    type: type,
    message: message,
    value: value
  });
  
  // الحد من عدد التنبيهات المخزنة
  if (this.alerts.alertHistory.length > 100) {
    this.alerts.alertHistory.shift();
  }
};

/**
 * تحديث حالة التشغيل
 */
sensorSchema.methods.updateOperationalStatus = function(status) {
  const validStatuses = ['online', 'offline', 'error', 'calibrating', 'maintenance'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid operational status. Must be one of: ${validStatuses.join(', ')}`);
  }
  this.operationalStatus = status;
  return this.save();
};

/**
 * تحديث حالة الحساس
 */
sensorSchema.methods.updateStatus = function(status) {
  const validStatuses = ['active', 'inactive', 'offline', 'maintenance', 'error', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  this.status = status;
  return this.save();
};

/**
 * معايرة الحساس
 */
sensorSchema.methods.calibrate = function(calibrationDate) {
  this.calibrationDate = calibrationDate || new Date();
  this.operationalStatus = 'calibrating';
  
  // حساب تاريخ المعايرة التالي
  if (this.calibrationInterval) {
    const nextDate = new Date(this.calibrationDate);
    nextDate.setDate(nextDate.getDate() + this.calibrationInterval);
    this.nextCalibrationDate = nextDate;
  }
  
  return this.save();
};

/**
 * إعادة تعيين قراءات الحساس
 */
sensorSchema.methods.resetReadings = function() {
  this.readings.minValue = null;
  this.readings.maxValue = null;
  this.readings.averageValue = null;
  this.readings.totalReadings = 0;
  this.readings.lastUpdated = new Date();
  return this.save();
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
sensorSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    unit: this.unit,
    status: this.status,
    operationalStatus: this.operationalStatus,
    isActive: this.isActive,
    isOnline: this.isOnline,
    needsCalibration: this.needsCalibration,
    readings: this.readings,
    thresholds: this.thresholds,
    lastReadingAt: this.readings.lastReadingAt,
    createdAt: this.createdAt
  };
};

/**
 * البيانات الكاملة للإدارة
 */
sensorSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    machineId: this.machineId,
    factoryId: this.factoryId,
    departmentId: this.departmentId,
    productionLineId: this.productionLineId,
    description: this.description,
    manufacturer: this.manufacturer,
    model: this.model,
    serialNumber: this.serialNumber,
    installationDate: this.installationDate,
    calibrationDate: this.calibrationDate,
    nextCalibrationDate: this.nextCalibrationDate,
    calibrationInterval: this.calibrationInterval,
    specifications: this.specifications,
    alerts: this.alerts,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن حساس بالكود
 */
sensorSchema.statics.findByCode = function(code, machineId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (machineId) query.machineId = machineId;
  return this.findOne(query);
};

/**
 * البحث عن حساسات حسب النوع
 */
sensorSchema.statics.findByType = function(type, factoryId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن حساسات حسب الحالة
 */
sensorSchema.statics.findByStatus = function(status, factoryId) {
  const query = { status, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن حساسات نشطة
 */
sensorSchema.statics.findActive = function(factoryId) {
  const query = {
    status: 'active',
    operationalStatus: 'online',
    deletedAt: null
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * البحث عن حساسات بحاجة معايرة
 */
sensorSchema.statics.findNeedsCalibration = function(factoryId) {
  const query = {
    nextCalibrationDate: { $lte: new Date() },
    deletedAt: null,
    status: { $in: ['active', 'maintenance'] }
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query).sort({ nextCalibrationDate: 1 });
};

/**
 * البحث النصي
 */
sensorSchema.statics.search = function(searchTerm, factoryId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { type: searchRegex },
      { unit: searchRegex },
      { manufacturer: searchRegex },
      { model: searchRegex },
      { serialNumber: searchRegex },
      { description: searchRegex }
    ]
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

/**
 * الحصول على إحصائيات الحساسات
 */
sensorSchema.statics.getStats = async function(factoryId) {
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
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        },
        offline: {
          $sum: {
            $cond: [{ $eq: ['$operationalStatus', 'offline'] }, 1, 0]
          }
        },
        error: {
          $sum: {
            $cond: [{ $eq: ['$operationalStatus', 'error'] }, 1, 0]
          }
        },
        calibrating: {
          $sum: {
            $cond: [{ $eq: ['$operationalStatus', 'calibrating'] }, 1, 0]
          }
        },
        maintenance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0]
          }
        },
        archived: {
          $sum: {
            $cond: [{ $eq: ['$status', 'archived'] }, 1, 0]
          }
        },
        needsCalibration: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$nextCalibrationDate', null] },
                  { $lte: ['$nextCalibrationDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalReadings: { $sum: '$readings.totalReadings' },
        avgValue: { $avg: '$readings.averageValue' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    offline: 0,
    error: 0,
    calibrating: 0,
    maintenance: 0,
    archived: 0,
    needsCalibration: 0,
    totalReadings: 0,
    avgValue: 0
  };
};

/**
 * توزيع الحساسات حسب النوع
 */
sensorSchema.statics.getTypeDistribution = async function(factoryId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        },
        avgReadings: { $avg: '$readings.totalReadings' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

/**
 * الحصول على آخر قراءات الحساسات حسب النوع
 */
sensorSchema.statics.getLatestReadingsByType = async function(type, limit = 10, factoryId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  
  return this.find(query)
    .sort({ 'readings.lastReadingAt': -1 })
    .limit(limit)
    .select('name code unit readings.lastValue readings.lastReadingAt status');
};

// ============ EXPORT ============

const Sensor = mongoose.model('Sensor', sensorSchema);

module.exports = Sensor;