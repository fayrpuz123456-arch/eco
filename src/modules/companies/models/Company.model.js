const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ COMPANY SCHEMA ============

// استخدام BaseModel لإضافة الحقول الأساسية (companyId, deletedAt, createdBy, updatedBy, status, metadata)
const companySchema = BaseModel.createSchema({
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
    maxlength: 10
  },
  industry: {
    type: String,
    required: true,
    enum: [
      'manufacturing', 'energy', 'chemical', 'pharmaceutical',
      'food_beverage', 'automotive', 'aerospace', 'electronics',
      'textile', 'steel', 'mining', 'construction',
      'agriculture', 'technology', 'logistics', 'healthcare',
      'education', 'other'
    ]
  },
  industrySubtype: {
    type: String,
    maxlength: 50,
    default: null
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contactPhone: {
    type: String,
    trim: true,
    default: null
  },
  contactPerson: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    position: { type: String }
  },
  description: {
    type: String,
    maxlength: 500,
    default: null
  },
  website: {
    type: String,
    default: null
  },
  logo: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    formattedAddress: { type: String }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  language: {
    type: String,
    enum: ['en', 'ar', 'fr', 'es', 'de', 'zh'],
    default: 'en'
  },

  // ===== Subscription =====
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise', 'custom'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'expired', 'cancelled', 'suspended'],
      default: 'active'
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    features: {
      maxUsers: { type: Number, default: 5 },
      maxFactories: { type: Number, default: 1 },
      maxDepartments: { type: Number, default: 5 },
      maxMachines: { type: Number, default: 10 },
      maxSensors: { type: Number, default: 20 },
      maxStorage: { type: Number, default: 1024 }, // MB
      maxApiCalls: { type: Number, default: 10000 },
      dataRetentionDays: { type: Number, default: 90 },
      analyticsEnabled: { type: Boolean, default: false },
      aiEnabled: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      advancedReports: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      ssoEnabled: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      dataExport: { type: Boolean, default: false }
    },
    lastPaymentDate: { type: Date },
    nextPaymentDate: { type: Date }
  },

  // ===== ESG (Environmental, Social, Governance) =====
  esg: {
    carbonReductionGoal: { type: Number, min: 0, max: 100, default: 0 },
    waterReductionGoal: { type: Number, min: 0, max: 100, default: 0 },
    wasteReductionGoal: { type: Number, min: 0, max: 100, default: 0 },
    energyEfficiencyGoal: { type: Number, min: 0, max: 100, default: 0 },
    renewableEnergyTarget: { type: Number, min: 0, max: 100, default: 0 },
    employeeCount: { type: Number, min: 0, default: 0 },
    safetyScore: { type: Number, min: 0, max: 100, default: 0 },
    communityEngagement: { type: Number, min: 0, max: 100, default: 0 },
    sustainabilityScore: { type: Number, min: 0, max: 100, default: 0 },
    esgRating: {
      type: String,
      enum: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'],
      default: 'BBB'
    },
    lastUpdated: { type: Date, default: Date.now },
    certifications: {
      type: [{
        name: { type: String, required: true },
        issuer: { type: String, required: true },
        dateIssued: { type: Date },
        dateExpires: { type: Date },
        verificationUrl: { type: String },
        status: {
          type: String,
          enum: ['active', 'expired', 'pending'],
          default: 'active'
        }
      }],
      default: []
    },
    compliance: {
      type: [{
        standard: { type: String, required: true },
        status: {
          type: String,
          enum: ['compliant', 'non-compliant', 'pending'],
          default: 'pending'
        },
        lastAuditDate: { type: Date },
        nextAuditDate: { type: Date },
        notes: { type: String }
      }],
      default: []
    }
  },

  // ===== Branding =====
  branding: {
    primaryColor: { type: String, default: '#2E7D32' },
    secondaryColor: { type: String, default: '#1B5E20' },
    accentColor: { type: String, default: '#4CAF50' },
    fontFamily: { type: String, default: 'Roboto' },
    logoUrl: { type: String },
    faviconUrl: { type: String }
  },

  // ===== Settings =====
  settings: {
    defaultLanguage: { type: String, default: 'en' },
    defaultTimezone: { type: String, default: 'UTC' },
    defaultCurrency: { type: String, default: 'USD' },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true }
    },
    reportingSettings: {
      reportFormat: { type: String, enum: ['pdf', 'excel', 'csv'], default: 'pdf' },
      autoGenerateReports: { type: Boolean, default: false },
      reportFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
      reportRecipients: { type: [String], default: [] }
    },
    dataRetention: {
      sensorDataDays: { type: Number, default: 365 },
      auditLogDays: { type: Number, default: 180 },
      reportDays: { type: Number, default: 730 },
      alertDays: { type: Number, default: 90 }
    },
    securitySettings: {
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: true },
        expiryDays: { type: Number, default: 90 }
      },
      sessionTimeout: { type: Number, default: 480 }, // دقائق
      maxLoginAttempts: { type: Number, default: 5 },
      twoFactorRequired: { type: Boolean, default: false }
    }
  },

  // ===== Verification =====
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: String,
    default: null
  },

  // ===== Active Plugins =====
  activePlugins: {
    type: [String],
    default: [],
    enum: [
      'carbon', 'heatRecovery', 'industrialExchange', 'solar',
      'rainWater', 'digitalTwin', 'esg', 'gamification'
    ]
  },

  // ===== Tags =====
  tags: {
    type: [String],
    default: []
  },

  // ===== Statistics Cache =====
  statistics: {
    totalFactories: { type: Number, default: 0 },
    totalDepartments: { type: Number, default: 0 },
    totalProductionLines: { type: Number, default: 0 },
    totalMachines: { type: Number, default: 0 },
    totalSensors: { type: Number, default: 0 },
    totalUsers: { type: Number, default: 0 },
    totalReadings: { type: Number, default: 0 },
    totalAlerts: { type: Number, default: 0 },
    totalReports: { type: Number, default: 0 },
    totalCarbonSaved: { type: Number, default: 0 },
    totalEnergySaved: { type: Number, default: 0 },
    totalWaterSaved: { type: Number, default: 0 },
    totalWasteReduced: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // ===== Verification Documents =====
  verificationDocuments: {
    type: [{
      type: { type: String, enum: ['license', 'certificate', 'registration', 'other'] },
      name: { type: String },
      url: { type: String },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      uploadedAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  // ===== AI Recommendations =====
  recommendations: {
    type: [{
      title: { type: String },
      description: { type: String },
      category: { type: String, enum: ['carbon', 'energy', 'water', 'waste', 'general'] },
      potentialSavings: { type: Number, default: 0 },
      potentialCarbonReduction: { type: Number, default: 0 },
      priority: { type: String, enum: ['high', 'medium', 'low'] },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'implemented', 'rejected'],
        default: 'pending'
      },
      cost: { type: Number, default: 0 },
      roi: { type: Number, default: 0 },
      paybackPeriod: { type: Number, default: 0 }
    }],
    default: []
  },

  // ===== Metadata =====
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  // خيارات إضافية
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// ============ INDEXES ============
// ✅ كل فهرس معرف مرة واحدة فقط

// ✅ فهارس فريدة
companySchema.index({ code: 1 }, { unique: true });

// ✅ فهارس للبحث
companySchema.index({ name: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ 'address.city': 1 });
companySchema.index({ 'address.country': 1 });
companySchema.index({ 'subscription.plan': 1 });
companySchema.index({ 'subscription.status': 1 });
companySchema.index({ 'subscription.endDate': 1 });
companySchema.index({ 'esg.sustainabilityScore': -1 });
companySchema.index({ 'esg.esgRating': 1 });
companySchema.index({ verified: 1 });
companySchema.index({ activePlugins: 1 });
companySchema.index({ tags: 1 });
companySchema.index({ createdAt: -1 });

// ✅ تم إزالة indexes التالية لأنها معرفة بالفعل في BaseModel:
// - status (معرف في BaseModel)
// - deletedAt (معرف في BaseModel مع sparse: true)

// ✅ فهرس مركب للبحث السريع
companySchema.index({ companyId: 1, status: 1, deletedAt: 1 });

// ============ VIRTUALS ============

companySchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

companySchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

companySchema.virtual('isVerified').get(function() {
  return this.verified === true;
});

companySchema.virtual('hasValidSubscription').get(function() {
  return this.isSubscriptionValid();
});

companySchema.virtual('esgScoreLevel').get(function() {
  const score = this.esg?.sustainabilityScore || 0;
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
});

// ============ METHODS ============

/**
 * التحقق من صحة الاشتراك
 */
companySchema.methods.isSubscriptionValid = function() {
  if (!this.subscription) return false;
  if (this.subscription.status !== 'active' && this.subscription.status !== 'trial') return false;
  if (this.subscription.endDate && new Date(this.subscription.endDate) < new Date()) return false;
  return true;
};

/**
 * حساب تصنيف ESG تلقائياً
 */
companySchema.methods.calculateESGRating = function(score) {
  if (score >= 95) return 'AAA';
  if (score >= 85) return 'AA';
  if (score >= 75) return 'A';
  if (score >= 65) return 'BBB';
  if (score >= 55) return 'BB';
  if (score >= 45) return 'B';
  if (score >= 35) return 'CCC';
  if (score >= 25) return 'CC';
  if (score >= 15) return 'C';
  return 'D';
};

/**
 * تحديث تصنيف ESG
 */
companySchema.methods.updateESGRating = function() {
  this.esg.esgRating = this.calculateESGRating(this.esg.sustainabilityScore || 0);
  this.esg.lastUpdated = new Date();
  return this;
};

/**
 * تحديث الإحصائيات
 */
companySchema.methods.updateStatistics = function(stats) {
  for (const key of Object.keys(stats)) {
    if (this.statistics[key] !== undefined) {
      this.statistics[key] = stats[key];
    }
  }
  this.statistics.lastUpdated = new Date();
  return this;
};

/**
 * إضافة شهادة ESG
 */
companySchema.methods.addCertification = function(certification) {
  this.esg.certifications.push(certification);
  return this;
};

/**
 * إضافة وثيقة تحقق
 */
companySchema.methods.addVerificationDocument = function(document) {
  this.verificationDocuments.push(document);
  return this;
};

/**
 * تفعيل إضافة
 */
companySchema.methods.enablePlugin = function(pluginName) {
  if (!this.activePlugins.includes(pluginName)) {
    this.activePlugins.push(pluginName);
  }
  return this;
};

/**
 * تعطيل إضافة
 */
companySchema.methods.disablePlugin = function(pluginName) {
  this.activePlugins = this.activePlugins.filter(p => p !== pluginName);
  return this;
};

/**
 * التحقق من تفعيل إضافة
 */
companySchema.methods.hasPlugin = function(pluginName) {
  return this.activePlugins.includes(pluginName);
};

/**
 * إضافة توصية
 */
companySchema.methods.addRecommendation = function(recommendation) {
  this.recommendations.push(recommendation);
  return this;
};

/**
 * تحديث حالة توصية
 */
companySchema.methods.updateRecommendationStatus = function(index, status) {
  if (this.recommendations[index]) {
    this.recommendations[index].status = status;
  }
  return this;
};

/**
 * البيانات العامة للـ API
 */
companySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    industry: this.industry,
    industrySubtype: this.industrySubtype,
    description: this.description,
    contactEmail: this.contactEmail,
    contactPhone: this.contactPhone,
    address: this.address,
    timezone: this.timezone,
    currency: this.currency,
    status: this.status,
    isActive: this.isActive,
    verified: this.verified,
    isVerified: this.isVerified,
    subscription: {
      plan: this.subscription?.plan,
      status: this.subscription?.status,
      endDate: this.subscription?.endDate
    },
    esg: {
      sustainabilityScore: this.esg?.sustainabilityScore,
      esgRating: this.esg?.esgRating,
      esgScoreLevel: this.esgScoreLevel
    },
    activePlugins: this.activePlugins,
    createdAt: this.createdAt
  };
};

/**
 * البيانات الكاملة للإدارة
 */
companySchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    contactPerson: this.contactPerson,
    website: this.website,
    logo: this.logo,
    coverImage: this.coverImage,
    branding: this.branding,
    settings: this.settings,
    statistics: this.statistics,
    esg: this.esg,
    subscription: this.subscription,
    verificationDocuments: this.verificationDocuments,
    recommendations: this.recommendations,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن شركة بالكود
 */
companySchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), deletedAt: null });
};

/**
 * البحث عن شركة بالاسم
 */
companySchema.statics.findByName = function(name) {
  return this.findOne({ name: name.trim(), deletedAt: null });
};

/**
 * البحث عن شركات حسب الصناعة
 */
companySchema.statics.findByIndustry = function(industry) {
  return this.find({ industry, deletedAt: null });
};

/**
 * البحث عن شركات حسب البلد
 */
companySchema.statics.findByCountry = function(country) {
  return this.find({ 'address.country': country, deletedAt: null });
};

/**
 * البحث عن شركات نشطة
 */
companySchema.statics.findActiveCompanies = function() {
  return this.find({ status: 'active', deletedAt: null });
};

/**
 * البحث عن شركات مفعلة
 */
companySchema.statics.findVerified = function() {
  return this.find({ verified: true, deletedAt: null });
};

/**
 * البحث عن شركات حسب خطة الاشتراك
 */
companySchema.statics.findBySubscriptionPlan = function(plan) {
  return this.find({ 'subscription.plan': plan, deletedAt: null });
};

/**
 * البحث عن شركات ذات ESG عالية
 */
companySchema.statics.findHighESG = function(minScore = 70) {
  return this.find({
    'esg.sustainabilityScore': { $gte: minScore },
    deletedAt: null
  }).sort({ 'esg.sustainabilityScore': -1 });
};

/**
 * البحث عن شركات تستخدم إضافة معينة
 */
companySchema.statics.findByPlugin = function(pluginName) {
  return this.find({ activePlugins: pluginName, deletedAt: null });
};

/**
 * البحث النصي المتقدم
 */
companySchema.statics.search = function(searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  return this.find({
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
      { industry: searchRegex },
      { 'address.city': searchRegex },
      { 'address.country': searchRegex },
      { contactEmail: searchRegex },
      { 'address.formattedAddress': searchRegex }
    ]
  });
};

/**
 * الحصول على إحصائيات الشركة (Aggregation)
 */
companySchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    { $match: { _id: companyId, deletedAt: null } },
    {
      $lookup: {
        from: 'factories',
        localField: '_id',
        foreignField: 'companyId',
        as: 'factories'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'companyId',
        as: 'users'
      }
    },
    {
      $lookup: {
        from: 'sensors',
        localField: '_id',
        foreignField: 'companyId',
        as: 'sensors'
      }
    },
    {
      $lookup: {
        from: 'sensorreadings',
        localField: '_id',
        foreignField: 'companyId',
        as: 'readings'
      }
    },
    {
      $project: {
        companyId: '$_id',
        name: 1,
        code: 1,
        industry: 1,
        esg: 1,
        subscription: 1,
        verified: 1,
        statistics: {
          totalFactories: { $size: '$factories' },
          totalUsers: { $size: '$users' },
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
 * الحصول على إحصائيات عامة للشركات
 */
companySchema.statics.getGlobalStats = async function() {
  const stats = await this.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        verified: { $sum: { $cond: ['$verified', 1, 0] } },
        unverified: { $sum: { $cond: [{ $not: ['$verified'] }, 1, 0] } },
        avgESGScore: { $avg: '$esg.sustainabilityScore' },
        avgCarbonGoal: { $avg: '$esg.carbonReductionGoal' },
        avgWaterGoal: { $avg: '$esg.waterReductionGoal' },
        avgWasteGoal: { $avg: '$esg.wasteReductionGoal' },
        avgRenewableTarget: { $avg: '$esg.renewableEnergyTarget' },
        avgSafetyScore: { $avg: '$esg.safetyScore' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    verified: 0,
    unverified: 0,
    avgESGScore: 0,
    avgCarbonGoal: 0,
    avgWaterGoal: 0,
    avgWasteGoal: 0,
    avgRenewableTarget: 0,
    avgSafetyScore: 0
  };
};

// ============ PRE-SAVE MIDDLEWARE (محذوف - BaseModel بيتعامل مع updatedAt) ============

// ============ EXPORT ============

const Company = mongoose.model('Company', companySchema);

module.exports = Company;