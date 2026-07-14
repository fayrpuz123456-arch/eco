const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ CARBON SCHEMA ============

const carbonSchema = BaseModel.createSchema({
  // ===== Basic Information =====
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 20 },
  description: { type: String, maxlength: 500, default: null },
  
  type: {
    type: String,
    required: true,
    enum: ['direct_emissions', 'indirect_energy', 'indirect_other', 'total']
  },
  factoryId: { type: String, required: true, index: true },

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
    month: { type: Number, min: 1, max: 12 }
  },

  // ===== Emissions =====
  emissions: {
    scope1: {
      stationaryCombustion: { type: Number, default: 0, min: 0 },
      mobileCombustion: { type: Number, default: 0, min: 0 },
      fugitiveEmissions: { type: Number, default: 0, min: 0 },
      processEmissions: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 }
    },
    scope2: {
      electricity: { type: Number, default: 0, min: 0 },
      steam: { type: Number, default: 0, min: 0 },
      heating: { type: Number, default: 0, min: 0 },
      cooling: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 }
    },
    scope3: {
      purchasedGoods: { type: Number, default: 0, min: 0 },
      transportation: { type: Number, default: 0, min: 0 },
      waste: { type: Number, default: 0, min: 0 },
      businessTravel: { type: Number, default: 0, min: 0 },
      employeeCommuting: { type: Number, default: 0, min: 0 },
      leasedAssets: { type: Number, default: 0, min: 0 },
      investments: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 }
    },
    totalEmissions: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'tCO2e' }
  },

  // ===== Intensity =====
  intensity: {
    perUnit: { type: Number, default: 0 },
    perEmployee: { type: Number, default: 0 },
    perRevenue: { type: Number, default: 0 },
    unit: { type: String, default: 'tCO2e/unit' }
  },

  // ===== Targets =====
  targets: {
    reductionTarget: { type: Number, min: 0, max: 100, default: 0 },
    targetYear: { type: Number, default: 2025 },
    baseline: { type: Number, default: 0, min: 0 },
    baselineYear: { type: Number, default: 2024 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'on_track', 'behind', 'achieved'],
      default: 'pending'
    }
  },

  // ===== Verification =====
  verification: {
    verified: { type: Boolean, default: false },
    verifiedBy: { type: String },
    verifiedDate: { type: Date },
    verificationBody: { type: String },
    reportUrl: { type: String },
    comments: { type: String }
  },

  // ===== Offsets =====
  offsets: {
    total: { type: Number, default: 0, min: 0 },
    type: {
      type: String,
      enum: ['renewable_energy', 'forestry', 'technology', 'other'],
      default: 'forestry'
    },
    trees: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'tCO2e' }
  },

  // ===== Reduction Actions =====
  reductionActions: {
    type: [{
      name: { type: String },
      description: { type: String },
      estimatedReduction: { type: Number, default: 0 },
      cost: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['planned', 'in_progress', 'completed', 'cancelled'],
        default: 'planned'
      },
      startDate: { type: Date },
      endDate: { type: Date }
    }],
    default: []
  },

  // ===== Energy Data =====
  energyData: {
    electricityConsumption: { type: Number, default: 0, min: 0 },
    fuelConsumption: { type: Number, default: 0, min: 0 },
    naturalGasConsumption: { type: Number, default: 0, min: 0 },
    renewableEnergy: { type: Number, default: 0, min: 0 },
    renewablePercentage: { type: Number, min: 0, max: 100, default: 0 },
    unit: { type: String, default: 'MWh' }
  },

  // ===== Tags =====
  tags: { type: [String], default: [] },

  // ===== AI Predictions =====
  prediction: {
    predictedEmissions: { type: Number },
    confidence: { type: Number, min: 0, max: 1 },
    trend: { type: String, enum: ['increasing', 'decreasing', 'stable'] },
    timestamp: { type: Date },
    recommendation: { type: String }
  },

  // ===== Recommendations (AI Generated) =====
  recommendations: {
    type: [{
      title: { type: String },
      description: { type: String },
      potentialReduction: { type: Number, default: 0 },
      potentialCostSaving: { type: Number, default: 0 },
      priority: { type: String, enum: ['high', 'medium', 'low'] },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'implemented', 'rejected'],
        default: 'pending'
      }
    }],
    default: []
  },

  // ===== Metadata =====
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// ============ INDEXES ============
// ✅ كل فهرس معرف مرة واحدة فقط

// ✅ فهرس فريد لـ code
carbonSchema.index({ code: 1 }, { unique: true });

// ✅ فهارس للبحث (تم إزالة المكرر)
carbonSchema.index({ factoryId: 1, 'period.startDate': -1 });
carbonSchema.index({ companyId: 1, type: 1 });
carbonSchema.index({ companyId: 1, 'period.startDate': -1 });

// ✅ تم إزالة indexes التالية لأنها معرفة بالفعل في BaseModel:
// - status (معرف في BaseModel)
// - deletedAt (معرف في BaseModel مع sparse: true)

// ============ VIRTUALS ============

carbonSchema.virtual('totalReductionProgress').get(function() {
  if (!this.targets || !this.targets.reductionTarget) return 0;
  return Math.min(100, (this.targets.progress / this.targets.reductionTarget) * 100);
});

carbonSchema.virtual('isVerified').get(function() {
  return this.verification && this.verification.verified === true;
});

// ============ METHODS ============

carbonSchema.methods.calculateTotalEmissions = function() {
  const scope1 = this.emissions.scope1 || {};
  const scope2 = this.emissions.scope2 || {};
  const scope3 = this.emissions.scope3 || {};

  this.emissions.scope1.total = Object.values(scope1).reduce((a, b) => a + (b || 0), 0);
  this.emissions.scope2.total = Object.values(scope2).reduce((a, b) => a + (b || 0), 0);
  this.emissions.scope3.total = Object.values(scope3).reduce((a, b) => a + (b || 0), 0);

  this.emissions.totalEmissions = 
    this.emissions.scope1.total +
    this.emissions.scope2.total +
    this.emissions.scope3.total;

  return this;
};

carbonSchema.methods.calculateIntensity = function(productionUnits) {
  if (productionUnits && productionUnits > 0) {
    this.intensity.perUnit = this.emissions.totalEmissions / productionUnits;
  }
  return this;
};

carbonSchema.methods.updateTargetStatus = function() {
  const progress = this.targets.progress || 0;
  const target = this.targets.reductionTarget || 0;
  
  if (target === 0) {
    this.targets.status = 'pending';
  } else if (progress >= target) {
    this.targets.status = 'achieved';
  } else if (progress >= target * 0.7) {
    this.targets.status = 'on_track';
  } else if (progress >= target * 0.3) {
    this.targets.status = 'behind';
  } else {
    this.targets.status = 'pending';
  }
  return this;
};

carbonSchema.methods.calculateCarbonOffset = function(trees) {
  const CO2_PER_TREE = 0.021; // 21 kg CO2 per tree per year
  const totalOffset = trees * CO2_PER_TREE;
  this.offsets.total = totalOffset;
  this.offsets.trees = trees;
  return this;
};

carbonSchema.methods.addReductionAction = function(action) {
  this.reductionActions.push(action);
  return this;
};

carbonSchema.methods.updateReductionAction = function(index, data) {
  if (this.reductionActions[index]) {
    Object.assign(this.reductionActions[index], data);
  }
  return this;
};

carbonSchema.methods.savePrediction = function(prediction) {
  this.prediction = {
    predictedEmissions: prediction.predictedEmissions || prediction.prediction,
    confidence: prediction.confidence || 0,
    trend: prediction.trend || 'stable',
    timestamp: new Date(),
    recommendation: prediction.recommendation || null
  };
  return this;
};

carbonSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    period: this.period,
    emissions: this.emissions,
    intensity: this.intensity,
    targets: this.targets,
    verification: this.verification,
    offsets: this.offsets,
    reductionActions: this.reductionActions,
    prediction: this.prediction,
    tags: this.tags,
    createdAt: this.createdAt
  };
};

carbonSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    energyData: this.energyData,
    recommendations: this.recommendations,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

carbonSchema.statics.getCompanyTotalEmissions = async function(companyId, startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        companyId,
        'period.startDate': { $gte: new Date(startDate) },
        'period.endDate': { $lte: new Date(endDate) },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$emissions.totalEmissions' },
        scope1: { $sum: '$emissions.scope1.total' },
        scope2: { $sum: '$emissions.scope2.total' },
        scope3: { $sum: '$emissions.scope3.total' }
      }
    }
  ]);

  return stats[0] || { total: 0, scope1: 0, scope2: 0, scope3: 0 };
};

carbonSchema.statics.getEmissionsDistribution = async function(companyId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        companyId,
        'period.startDate': { $gte: new Date(startDate) },
        'period.endDate': { $lte: new Date(endDate) },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$emissions.totalEmissions' }
      }
    },
    { $sort: { total: -1 } }
  ]);
};

carbonSchema.statics.getEmissionsTrend = async function(companyId, months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return this.aggregate([
    {
      $match: {
        companyId,
        'period.startDate': { $gte: startDate },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: {
          year: '$period.year',
          month: '$period.month'
        },
        total: { $sum: '$emissions.totalEmissions' },
        scope1: { $sum: '$emissions.scope1.total' },
        scope2: { $sum: '$emissions.scope2.total' },
        scope3: { $sum: '$emissions.scope3.total' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
};

carbonSchema.statics.findByFactory = async function(factoryId, companyId, startDate, endDate) {
  const query = {
    factoryId,
    companyId,
    deletedAt: null
  };
  if (startDate && endDate) {
    query['period.startDate'] = { $gte: new Date(startDate) };
    query['period.endDate'] = { $lte: new Date(endDate) };
  }
  return this.find(query).sort({ 'period.startDate': -1 });
};

// ============ PRE-SAVE MIDDLEWARE ============

carbonSchema.pre('save', function(next) {
  // تحديث updatedAt
  this.updatedAt = new Date();

  // تنظيف البيانات
  if (this.name) this.name = this.name.trim();
  if (this.code) this.code = this.code.toUpperCase().trim();
  if (this.description) this.description = this.description.trim();

  // حساب الإجمالي تلقائياً
  this.calculateTotalEmissions();

  // تحديث حالة الأهداف
  this.updateTargetStatus();

  next();
});

// ============ EXPORT ============

const Carbon = mongoose.model('Carbon', carbonSchema);

module.exports = Carbon;