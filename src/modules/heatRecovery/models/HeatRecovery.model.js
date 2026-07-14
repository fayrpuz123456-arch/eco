const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ HEAT RECOVERY SCHEMA ============

const heatRecoverySchema = BaseModel.createSchema({
  // ===== Basic Information =====
  companyId: { type: String, required: true, index: true },
  factoryId: { type: String, required: true, index: true },
  machineId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, maxlength: 500, default: null },

  // ===== Heat Source =====
  heatSource: {
    type: {
      type: String,
      enum: [
        'boiler',           // غلاية
        'furnace',          // فرن
        'engine',           // محرك
        'compressor',       // ضاغط
        'pump',             // مضخة
        'exhaust',          // عادم
        'steam_trap',       // مصيدة بخار
        'cooling_tower',    // برج تبريد
        'heat_exchanger',   // مبادل حراري
        'incinerator',      // محرقة
        'other'             // أخرى
      ],
      required: true
    },
    temperature: { type: Number, required: true, min: 0 }, // درجة الحرارة بالدرجة المئوية
    flowRate: { type: Number, default: 0, min: 0 }, // معدل التدفق (kg/s أو m³/s)
    pressure: { type: Number, default: 0, min: 0 }, // الضغط (bar)
    operatingHours: { type: Number, default: 0, min: 0 }, // ساعات التشغيل اليومية
    operatingDays: { type: Number, default: 0, min: 0 }, // أيام التشغيل السنوية
    fuelType: {
      type: String,
      enum: ['natural_gas', 'diesel', 'coal', 'biomass', 'electricity', 'other'],
      default: 'natural_gas'
    }
  },

  // ===== Heat Calculation =====
  heatCalculation: {
    wasteHeat: { type: Number, default: 0, min: 0 }, // الحرارة المهدرة (kWh)
    recoverableHeat: { type: Number, default: 0, min: 0 }, // الحرارة القابلة للاسترجاع (kWh)
    recoveryEfficiency: { type: Number, default: 0, min: 0, max: 100 }, // كفاءة الاسترجاع (%)
    estimatedRecovery: { type: Number, default: 0, min: 0 }, // التقدير الفعلي (kWh)
    unit: { type: String, default: 'kWh' }
  },

  // ===== Solutions =====
  solutions: {
    type: [{
      type: {
        type: String,
        enum: [
          'heat_exchanger',      // مبادل حراري
          'steam_recovery',      // استعادة البخار
          'boiler_feed',         // تغذية الغلاية
          'orc_generator',       // مولد ORC
          'drying_system',       // نظام تجفيف
          'preheating',          // تسخين مسبق
          'district_heating',    // تدفئة المناطق
          'absorption_chiller',  // مبرد امتصاصي
          'heat_pump'            // مضخة حرارية
        ],
        required: true
      },
      name: { type: String, required: true },
      description: { type: String },
      potentialRecovery: { type: Number, default: 0, min: 0 }, // كمية الطاقة المسترجعة (kWh)
      efficiency: { type: Number, default: 0, min: 0, max: 100 },
      cost: { type: Number, default: 0, min: 0 }, // تكلفة التنفيذ (USD)
      savings: { type: Number, default: 0, min: 0 }, // التوفير السنوي (USD)
      carbonReduction: { type: Number, default: 0, min: 0 }, // تقليل الكربون (kgCO2)
      roi: { type: Number, default: 0, min: 0 }, // عائد الاستثمار (%)
      paybackPeriod: { type: Number, default: 0, min: 0 }, // فترة الاسترداد (سنوات)
      status: {
        type: String,
        enum: ['pending', 'recommended', 'approved', 'rejected', 'implemented'],
        default: 'pending'
      },
      implementationTime: { type: Number, default: 0 }, // وقت التنفيذ (أشهر)
      maintenanceCost: { type: Number, default: 0 } // تكلفة الصيانة السنوية
    }],
    default: []
  },

  // ===== Financial Analysis =====
  financialAnalysis: {
    totalInvestment: { type: Number, default: 0, min: 0 },
    annualSavings: { type: Number, default: 0, min: 0 },
    annualCarbonReduction: { type: Number, default: 0, min: 0 },
    paybackPeriod: { type: Number, default: 0, min: 0 },
    roi: { type: Number, default: 0, min: 0 },
    netPresentValue: { type: Number, default: 0 },
    internalRateReturn: { type: Number, default: 0 },
    paybackYears: { type: Number, default: 0, min: 0 }
  },

  // ===== Environmental Impact =====
  environmentalImpact: {
    carbonSaved: { type: Number, default: 0, min: 0 },
    energySaved: { type: Number, default: 0, min: 0 },
    fuelSaved: { type: Number, default: 0, min: 0 },
    treesEquivalent: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'kgCO2' }
  },

  // ===== AI Analysis =====
  aiAnalysis: {
    analyzed: { type: Boolean, default: false },
    analyzedAt: { type: Date },
    recommendations: { type: [String], default: [] },
    feasibilityScore: { type: Number, min: 0, max: 100 },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    optimizedSolutions: { type: [String], default: [] }
  },

  // ===== Implementation =====
  implementation: {
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    actualSavings: { type: Number, default: 0 },
    actualCarbonReduction: { type: Number, default: 0 },
    challenges: { type: [String], default: [] },
    notes: { type: String }
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

heatRecoverySchema.index({ companyId: 1, status: 1 });
heatRecoverySchema.index({ factoryId: 1, machineId: 1 });
heatRecoverySchema.index({ 'aiAnalysis.priority': 1 });
heatRecoverySchema.index({ 'heatSource.type': 1 });
heatRecoverySchema.index({ createdAt: -1 });

// ============ VIRTUALS ============

heatRecoverySchema.virtual('totalRecoverableHeat').get(function() {
  return this.heatCalculation.recoverableHeat || 0;
});

heatRecoverySchema.virtual('bestSolution').get(function() {
  if (!this.solutions || this.solutions.length === 0) return null;
  return this.solutions.reduce((best, current) => 
    (current.roi > best.roi) ? current : best
  );
});

heatRecoverySchema.virtual('isImplemented').get(function() {
  return this.implementation.status === 'completed';
});

// ============ METHODS ============

/**
 * حساب الحرارة المهدرة
 */
heatRecoverySchema.methods.calculateWasteHeat = function() {
  const Q = this.heatSource;
  if (!Q.temperature || !Q.flowRate) return this;

  // حساب الحرارة المهدرة بناءً على درجة الحرارة ومعدل التدفق
  // Q = m * Cp * ΔT
  const Cp = 1.005; // kJ/kg·K (متوسط)
  const deltaT = Q.temperature - 25; // الفرق بين درجة الحرارة ودرجة الحرارة المحيطة
  const massFlow = Q.flowRate * 3600; // تحويل kg/s إلى kg/h

  this.heatCalculation.wasteHeat = (massFlow * Cp * deltaT) / 1000; // kWh
  return this;
};

/**
 * حساب الحرارة القابلة للاسترجاع
 */
heatRecoverySchema.methods.calculateRecoverableHeat = function() {
  const efficiency = this.heatCalculation.recoveryEfficiency || 70; // 70% افتراضياً
  this.heatCalculation.recoverableHeat = 
    (this.heatCalculation.wasteHeat * efficiency) / 100;
  return this;
};

/**
 * حساب الأثر البيئي
 */
heatRecoverySchema.methods.calculateEnvironmentalImpact = function() {
  const CO2_PER_KWH = 0.45; // kg CO2/kWh (متوسط)
  const FUEL_PER_KWH = 0.08; // لتر وقود/kWh (متوسط)

  const energy = this.heatCalculation.recoverableHeat || 0;
  this.environmentalImpact.carbonSaved = energy * CO2_PER_KWH;
  this.environmentalImpact.energySaved = energy;
  this.environmentalImpact.fuelSaved = energy * FUEL_PER_KWH;
  this.environmentalImpact.treesEquivalent = this.environmentalImpact.carbonSaved / 25; // شجرة تمتص 25kg CO2 سنوياً

  return this;
};

/**
 * حساب التحليل المالي
 */
heatRecoverySchema.methods.calculateFinancialAnalysis = function() {
  let totalCost = 0;
  let totalSavings = 0;

  for (const solution of this.solutions) {
    totalCost += solution.cost || 0;
    totalSavings += solution.savings || 0;
  }

  this.financialAnalysis.totalInvestment = totalCost;
  this.financialAnalysis.annualSavings = totalSavings;

  if (totalCost > 0) {
    this.financialAnalysis.paybackPeriod = totalCost / totalSavings;
    this.financialAnalysis.roi = (totalSavings / totalCost) * 100;
  }

  this.financialAnalysis.paybackYears = Math.round(this.financialAnalysis.paybackPeriod * 10) / 10;

  return this;
};

/**
 * إضافة حل
 */
heatRecoverySchema.methods.addSolution = function(solution) {
  // حساب التوفير وتقليل الكربون
  const recovery = solution.potentialRecovery || 0;
  const CO2_PER_KWH = 0.45;
  const ENERGY_PRICE = 0.12; // دولار/kWh

  solution.carbonReduction = recovery * CO2_PER_KWH;
  solution.savings = recovery * ENERGY_PRICE * 8760; // 8760 ساعة في السنة
  solution.roi = solution.cost > 0 ? (solution.savings / solution.cost) * 100 : 0;
  solution.paybackPeriod = solution.cost > 0 ? solution.cost / solution.savings : 0;

  this.solutions.push(solution);
  return this;
};

/**
 * تحديث حالة التنفيذ
 */
heatRecoverySchema.methods.updateImplementation = function(data) {
  this.implementation = {
    ...this.implementation,
    ...data
  };
  return this;
};

/**
 * تحديث تحليل AI
 */
heatRecoverySchema.methods.updateAIAnalysis = function(data) {
  this.aiAnalysis = {
    ...this.aiAnalysis,
    ...data,
    analyzed: true,
    analyzedAt: new Date()
  };
  return this;
};

/**
 * البيانات العامة للـ API
 */
heatRecoverySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    heatSource: this.heatSource,
    heatCalculation: this.heatCalculation,
    solutions: this.solutions.map(s => ({
      type: s.type,
      name: s.name,
      description: s.description,
      potentialRecovery: s.potentialRecovery,
      cost: s.cost,
      savings: s.savings,
      carbonReduction: s.carbonReduction,
      roi: s.roi,
      paybackPeriod: s.paybackPeriod,
      status: s.status
    })),
    financialAnalysis: this.financialAnalysis,
    environmentalImpact: this.environmentalImpact,
    aiAnalysis: {
      priority: this.aiAnalysis.priority,
      feasibilityScore: this.aiAnalysis.feasibilityScore,
      recommendations: this.aiAnalysis.recommendations
    },
    bestSolution: this.bestSolution,
    isImplemented: this.isImplemented,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

/**
 * البحث حسب الأولوية
 */
heatRecoverySchema.statics.findByPriority = async function(companyId, priority) {
  return this.find({
    companyId,
    'aiAnalysis.priority': priority,
    deletedAt: null
  }).sort({ 'aiAnalysis.feasibilityScore': -1 });
};

/**
 * البحث حسب المصنع
 */
heatRecoverySchema.statics.findByFactory = async function(factoryId, companyId) {
  const query = { factoryId, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * البحث حسب الماكينة
 */
heatRecoverySchema.statics.findByMachine = async function(machineId, companyId) {
  const query = { machineId, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * البحث عن الفرص ذات الأولوية العالية
 */
heatRecoverySchema.statics.findHighPriority = async function(companyId) {
  return this.find({
    companyId,
    'aiAnalysis.priority': 'high',
    'aiAnalysis.feasibilityScore': { $gte: 70 },
    deletedAt: null
  }).sort({ 'aiAnalysis.feasibilityScore': -1 });
};

/**
 * الحصول على إحصائيات
 */
heatRecoverySchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    {
      $match: {
        companyId,
        deletedAt: null
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        highPriority: {
          $sum: {
            $cond: [{ $eq: ['$aiAnalysis.priority', 'high'] }, 1, 0]
          }
        },
        mediumPriority: {
          $sum: {
            $cond: [{ $eq: ['$aiAnalysis.priority', 'medium'] }, 1, 0]
          }
        },
        lowPriority: {
          $sum: {
            $cond: [{ $eq: ['$aiAnalysis.priority', 'low'] }, 1, 0]
          }
        },
        implemented: {
          $sum: {
            $cond: [{ $eq: ['$implementation.status', 'completed'] }, 1, 0]
          }
        },
        totalWasteHeat: { $sum: '$heatCalculation.wasteHeat' },
        totalRecoverable: { $sum: '$heatCalculation.recoverableHeat' },
        totalCarbonSaved: { $sum: '$environmentalImpact.carbonSaved' },
        totalSavings: { $sum: '$financialAnalysis.annualSavings' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    implemented: 0,
    totalWasteHeat: 0,
    totalRecoverable: 0,
    totalCarbonSaved: 0,
    totalSavings: 0
  };
};

// ============ PRE-SAVE MIDDLEWARE ============

heatRecoverySchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // تنظيف البيانات
  if (this.name) this.name = this.name.trim();
  if (this.description) this.description = this.description.trim();

  // حساب الحرارة
  this.calculateWasteHeat();
  this.calculateRecoverableHeat();

  // حساب الأثر البيئي
  this.calculateEnvironmentalImpact();

  // حساب التحليل المالي
  this.calculateFinancialAnalysis();

  // تعيين الأولوية الافتراضية إذا لم تكن محددة
  if (!this.aiAnalysis.priority) {
    const recoverable = this.heatCalculation.recoverableHeat || 0;
    if (recoverable > 5000) this.aiAnalysis.priority = 'high';
    else if (recoverable > 2000) this.aiAnalysis.priority = 'medium';
    else this.aiAnalysis.priority = 'low';
  }

  next();
});

// ============ EXPORT ============

const HeatRecovery = mongoose.model('HeatRecovery', heatRecoverySchema);

module.exports = HeatRecovery;