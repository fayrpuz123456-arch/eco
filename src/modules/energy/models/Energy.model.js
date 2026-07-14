const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ ENERGY SCHEMA ============

const energySchema = BaseModel.createSchema({
  // ===== Basic Information =====
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 20 },
  description: { type: String, maxlength: 500, default: null },
  
  type: {
    type: String,
    required: true,
    enum: ['electricity', 'natural_gas', 'diesel', 'petrol', 'kerosene', 'coal', 'biomass', 'solar', 'wind', 'geothermal', 'hydro', 'total']
  },
  source: {
    type: String,
    enum: ['grid', 'generator', 'solar', 'wind', 'battery', 'other'],
    default: 'grid'
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

  // ===== Consumption =====
  consumption: {
    total: { type: Number, default: 0, min: 0 },
    electricity: {
      total: { type: Number, default: 0, min: 0 },
      peak: { type: Number, default: 0, min: 0 },
      offPeak: { type: Number, default: 0, min: 0 },
      demand: { type: Number, default: 0, min: 0 },
      powerFactor: { type: Number, min: 0, max: 1, default: 0 }
    },
    fuel: {
      total: { type: Number, default: 0, min: 0 },
      type: { type: String },
      consumption: { type: Number, default: 0, min: 0 }
    },
    gas: {
      total: { type: Number, default: 0, min: 0 },
      consumption: { type: Number, default: 0, min: 0 }
    },
    renewable: {
      total: { type: Number, default: 0, min: 0 },
      solar: { type: Number, default: 0, min: 0 },
      wind: { type: Number, default: 0, min: 0 },
      biomass: { type: Number, default: 0, min: 0 }
    }
  },

  // ===== Cost =====
  cost: {
    total: { type: Number, default: 0, min: 0 },
    electricity: { type: Number, default: 0, min: 0 },
    fuel: { type: Number, default: 0, min: 0 },
    gas: { type: Number, default: 0, min: 0 },
    renewable: { type: Number, default: 0, min: 0 },
    rate: { type: Number, default: 0, min: 0 },
    savings: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' }
  },

  // ===== Efficiency =====
  efficiency: {
    overall: { type: Number, min: 0, max: 100, default: 0 },
    electricity: { type: Number, min: 0, max: 100, default: 0 },
    fuel: { type: Number, min: 0, max: 100, default: 0 },
    gas: { type: Number, min: 0, max: 100, default: 0 },
    renewable: { type: Number, min: 0, max: 100, default: 0 },
    target: { type: Number, min: 0, max: 100, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== KPIs =====
  kpis: {
    intensity: { type: Number, default: 0, min: 0 },
    renewablePercentage: { type: Number, min: 0, max: 100, default: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    energyIntensity: { type: Number, default: 0, min: 0 },
    carbonIntensity: { type: Number, default: 0, min: 0 }
  },

  // ===== Targets =====
  targets: {
    consumptionReduction: { type: Number, min: 0, max: 100, default: 0 },
    efficiencyImprovement: { type: Number, min: 0, max: 100, default: 0 },
    renewableTarget: { type: Number, min: 0, max: 100, default: 0 },
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

  // ===== Carbon Impact =====
  carbonImpact: {
    total: { type: Number, default: 0, min: 0 },
    scope1: { type: Number, default: 0, min: 0 },
    scope2: { type: Number, default: 0, min: 0 },
    saved: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'kgCO2' }
  },

  // ===== AI Predictions =====
  prediction: {
    predictedConsumption: { type: Number },
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
      potentialSavings: { type: Number, default: 0 },
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

  // ===== Heat Recovery =====
  heatRecovery: {
    wasteHeat: { type: Number, default: 0, min: 0 },
    recoverableHeat: { type: Number, default: 0, min: 0 },
    temperature: { type: Number, default: 0 },
    solutions: {
      type: [{
        type: { type: String, enum: ['heat_exchanger', 'steam_recovery', 'boiler_feed', 'orc_generator', 'drying_system'] },
        description: { type: String },
        potentialRecovery: { type: Number, default: 0 },
        cost: { type: Number, default: 0 },
        savings: { type: Number, default: 0 },
        carbonReduction: { type: Number, default: 0 },
        roi: { type: Number, default: 0 },
        paybackPeriod: { type: Number, default: 0 }
      }],
      default: []
    },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Tags =====
  tags: { type: [String], default: [] },

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
energySchema.index({ code: 1 }, { unique: true });

// ✅ فهارس للبحث (تم إزالة المكرر)
energySchema.index({ factoryId: 1, 'period.startDate': -1 });
energySchema.index({ companyId: 1, type: 1, 'period.startDate': -1 });
energySchema.index({ companyId: 1, 'period.startDate': -1 });

// ✅ تم إزالة indexes التالية لأنها معرفة بالفعل في BaseModel:
// - status (معرف في BaseModel)
// - deletedAt (معرف في BaseModel مع sparse: true)

// ============ VIRTUALS ============

energySchema.virtual('totalConsumptionReduction').get(function() {
  if (!this.targets || !this.targets.consumptionReduction) return 0;
  return Math.min(100, (this.targets.progress / this.targets.consumptionReduction) * 100);
});

energySchema.virtual('renewablePercentage').get(function() {
  const total = this.consumption?.total || 0;
  const renewable = this.consumption?.renewable?.total || 0;
  if (total === 0) return 0;
  return Math.round((renewable / total) * 100);
});

// ============ METHODS ============

energySchema.methods.calculateTotalConsumption = function() {
  let total = 0;
  if (this.consumption.electricity) total += this.consumption.electricity.total || 0;
  if (this.consumption.fuel) total += this.consumption.fuel.total || 0;
  if (this.consumption.gas) total += this.consumption.gas.total || 0;
  if (this.consumption.renewable) total += this.consumption.renewable.total || 0;
  this.consumption.total = total;
  return this;
};

energySchema.methods.calculateCost = function() {
  const total = this.consumption.total || 0;
  const rate = this.cost.rate || 0.15;
  this.cost.total = total * rate;
  return this;
};

energySchema.methods.calculateEfficiency = function() {
  const target = this.targets.renewableTarget || 0;
  const current = this.kpis.renewablePercentage || 0;
  this.efficiency.overall = current;
  this.efficiency.target = target;
  this.efficiency.lastUpdated = new Date();
  return this;
};

energySchema.methods.updateTargetStatus = function() {
  const progress = this.targets.progress || 0;
  const target = this.targets.consumptionReduction || 0;
  
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

energySchema.methods.calculateCarbonImpact = function() {
  const total = this.consumption.total || 0;
  const electricity = this.consumption.electricity?.total || 0;
  const fuel = this.consumption.fuel?.total || 0;
  const gas = this.consumption.gas?.total || 0;

  // متوسط انبعاثات الكربون لكل وحدة
  const EMISSION_FACTORS = {
    electricity: 0.5, // kg CO2/kWh
    fuel: 2.5,        // kg CO2/liter
    gas: 2.0          // kg CO2/m3
  };

  this.carbonImpact.scope2 = electricity * EMISSION_FACTORS.electricity;
  this.carbonImpact.scope1 = (fuel * EMISSION_FACTORS.fuel) + (gas * EMISSION_FACTORS.gas);
  this.carbonImpact.total = this.carbonImpact.scope1 + this.carbonImpact.scope2;

  return this;
};

energySchema.methods.savePrediction = function(prediction) {
  this.prediction = {
    predictedConsumption: prediction.predictedConsumption || prediction.prediction,
    confidence: prediction.confidence || 0,
    trend: prediction.trend || 'stable',
    timestamp: new Date(),
    recommendation: prediction.recommendation || null
  };
  return this;
};

energySchema.methods.addHeatRecoverySolution = function(solution) {
  this.heatRecovery.solutions.push(solution);
  this.heatRecovery.lastUpdated = new Date();
  return this;
};

energySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    source: this.source,
    period: this.period,
    consumption: this.consumption,
    cost: this.cost,
    efficiency: this.efficiency,
    kpis: this.kpis,
    targets: this.targets,
    carbonImpact: this.carbonImpact,
    prediction: this.prediction,
    heatRecovery: {
      wasteHeat: this.heatRecovery.wasteHeat,
      recoverableHeat: this.heatRecovery.recoverableHeat,
      solutions: this.heatRecovery.solutions
    },
    tags: this.tags,
    createdAt: this.createdAt
  };
};

energySchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    recommendations: this.recommendations,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

energySchema.statics.getCompanyTotalConsumption = async function(companyId, startDate, endDate) {
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
        total: { $sum: '$consumption.total' },
        electricity: { $sum: '$consumption.electricity.total' },
        fuel: { $sum: '$consumption.fuel.total' },
        gas: { $sum: '$consumption.gas.total' },
        renewable: { $sum: '$consumption.renewable.total' },
        totalCost: { $sum: '$cost.total' }
      }
    }
  ]);

  return stats[0] || { total: 0, electricity: 0, fuel: 0, gas: 0, renewable: 0, totalCost: 0 };
};

energySchema.statics.getConsumptionDistribution = async function(companyId, startDate, endDate) {
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
        total: { $sum: '$consumption.total' },
        cost: { $sum: '$cost.total' }
      }
    },
    { $sort: { total: -1 } }
  ]);
};

energySchema.statics.getConsumptionTrend = async function(companyId, months = 12) {
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
        total: { $sum: '$consumption.total' },
        cost: { $sum: '$cost.total' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
};

energySchema.statics.findByFactory = async function(factoryId, companyId, startDate, endDate) {
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

energySchema.pre('save', function(next) {
  // تحديث updatedAt
  this.updatedAt = new Date();

  // تنظيف البيانات
  if (this.name) this.name = this.name.trim();
  if (this.code) this.code = this.code.toUpperCase().trim();
  if (this.description) this.description = this.description.trim();

  // حساب الإجمالي تلقائياً
  this.calculateTotalConsumption();
  this.calculateCost();
  this.calculateEfficiency();
  this.calculateCarbonImpact();

  // تحديث النسبة المئوية للطاقة المتجددة
  const total = this.consumption.total || 0;
  const renewable = this.consumption.renewable?.total || 0;
  if (total > 0) {
    this.kpis.renewablePercentage = Math.round((renewable / total) * 100);
  }

  // تحديث حالة الأهداف
  this.updateTargetStatus();

  next();
});

// ============ EXPORT ============

const Energy = mongoose.model('Energy', energySchema);

module.exports = Energy;