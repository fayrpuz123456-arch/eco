const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ EXCHANGE SCHEMA ============

const exchangeSchema = BaseModel.createSchema({
  // ===== Basic Information =====
  companyId: { type: String, required: true, index: true },
  factoryId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, maxlength: 500, default: null },
  
  // ===== Resource Type =====
  resourceType: {
    type: String,
    required: true,
    enum: [
      'heat',           // حرارة
      'steam',          // بخار
      'plastic',        // بلاستيك
      'metal',          // معادن
      'paper',          // ورق
      'glass',          // زجاج
      'wood',           // أخشاب
      'treated_water',  // مياه معالجة
      'chemicals',      // كيماويات قابلة لإعادة الاستخدام
      'waste_oil',      // زيت مستعمل
      'biomass',        // كتلة حيوية
      'other'           // أخرى
    ],
    index: true
  },
  
  // ===== Resource Details =====
  resourceDetails: {
    quantity: { type: Number, default: 0, min: 0 },
    unit: { 
      type: String, 
      enum: ['kg', 'ton', 'm3', 'liter', 'kWh', 'MW', 'GJ', 'units', 'other'],
      default: 'kg'
    },
    quality: { type: String, default: 'standard' },
    purity: { type: Number, min: 0, max: 100, default: 0 },
    temperature: { type: Number, default: 0 }, // للحرارة والبخار
    pressure: { type: Number, default: 0 }, // للحرارة والبخار
    composition: { type: String, default: null }, // للمواد الكيميائية
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // ===== Availability =====
  availability: {
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'expired', 'archived'],
      default: 'available',
      index: true
    },
    quantityAvailable: { type: Number, default: 0, min: 0 },
    quantityReserved: { type: Number, default: 0, min: 0 },
    quantitySold: { type: Number, default: 0, min: 0 },
    availableFrom: { type: Date, default: Date.now },
    availableUntil: { type: Date },
    expiryDate: { type: Date },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    }
  },

  // ===== Pricing =====
  pricing: {
    pricePerUnit: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    negotiable: { type: Boolean, default: true },
    totalValue: { type: Number, default: 0, min: 0 }
  },

  // ===== Logistics =====
  logistics: {
    pickupLocation: {
      address: { type: String },
      city: { type: String },
      country: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number }
      }
    },
    deliveryAvailable: { type: Boolean, default: false },
    deliveryRadius: { type: Number, default: 0 }, // km
    pickupRequired: { type: Boolean, default: true },
    packaging: { type: String, default: null }
  },

  // ===== Environmental Impact =====
  environmentalImpact: {
    carbonSaved: { type: Number, default: 0, min: 0 },
    waterSaved: { type: Number, default: 0, min: 0 },
    energySaved: { type: Number, default: 0, min: 0 },
    wasteReduced: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'kgCO2' }
  },

  // ===== AI Matching =====
  aiMatching: {
    matched: { type: Boolean, default: false },
    matchedCompanyId: { type: String },
    matchedFactoryId: { type: String },
    matchScore: { type: Number, min: 0, max: 100 },
    matchedAt: { type: Date },
    recommendations: { type: [String], default: [] },
    alternativeUses: { type: [String], default: [] }
  },

  // ===== Listing =====
  listing: {
    published: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
    viewCount: { type: Number, default: 0 },
    interestCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false }
  },

  // ===== Tags =====
  tags: { type: [String], default: [] },

  // ===== Certifications =====
  certifications: {
    type: [{
      name: { type: String },
      issuer: { type: String },
      dateIssued: { type: Date },
      dateExpires: { type: Date },
      verificationUrl: { type: String }
    }],
    default: []
  },

  // ===== Interests =====
  interests: {
    type: [{
      companyId: { type: String, required: true },
      factoryId: { type: String },
      userEmail: { type: String },
      message: { type: String },
      quantity: { type: Number },
      priceOffer: { type: Number },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'negotiating'],
        default: 'pending'
      },
      createdAt: { type: Date, default: Date.now }
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

exchangeSchema.index({ companyId: 1, status: 1 });
exchangeSchema.index({ resourceType: 1, 'availability.status': 1 });
exchangeSchema.index({ 'aiMatching.matched': 1 });
exchangeSchema.index({ 'availability.availableFrom': 1, 'availability.availableUntil': 1 });
exchangeSchema.index({ createdAt: -1 });

// ✅ تم إزالة فهرس deletedAt المكرر لأنه معرف بالفعل في BaseModel
// exchangeSchema.index({ deletedAt: 1 }, { sparse: true }); // ❌ مكرر - محذوف

// ============ VIRTUALS ============

exchangeSchema.virtual('isAvailable').get(function() {
  return this.availability.status === 'available' && 
         this.availability.quantityAvailable > 0 &&
         !this.deletedAt;
});

exchangeSchema.virtual('isMatched').get(function() {
  return this.aiMatching.matched === true;
});

exchangeSchema.virtual('totalQuantity').get(function() {
  return this.resourceDetails.quantity || 0;
});

// ============ METHODS ============

exchangeSchema.methods.reserveQuantity = function(quantity) {
  if (quantity > this.availability.quantityAvailable) {
    throw new Error('Insufficient quantity available');
  }
  this.availability.quantityAvailable -= quantity;
  this.availability.quantityReserved += quantity;
  this.availability.status = 'reserved';
  return this;
};

exchangeSchema.methods.sellQuantity = function(quantity) {
  if (quantity > this.availability.quantityReserved) {
    throw new Error('Insufficient reserved quantity');
  }
  this.availability.quantityReserved -= quantity;
  this.availability.quantitySold += quantity;
  this.availability.status = quantity > 0 ? 'sold' : 'available';
  return this;
};

exchangeSchema.methods.addInterest = function(interest) {
  this.interests.push(interest);
  this.listing.interestCount += 1;
  return this;
};

exchangeSchema.methods.updateMatch = function(matchData) {
  this.aiMatching = {
    ...this.aiMatching,
    ...matchData,
    matched: true,
    matchedAt: new Date()
  };
  return this;
};

exchangeSchema.methods.calculateTotalValue = function() {
  this.pricing.totalValue = this.resourceDetails.quantity * this.pricing.pricePerUnit;
  return this;
};

exchangeSchema.methods.calculateEnvironmentalImpact = function() {
  // حساب التوفير البيئي حسب نوع المورد
  const factors = {
    heat: { carbon: 0.5, energy: 1.0 },
    steam: { carbon: 0.4, energy: 0.8 },
    plastic: { carbon: 1.2, waste: 1.0 },
    metal: { carbon: 2.0, waste: 1.5 },
    paper: { carbon: 0.8, waste: 0.5 },
    glass: { carbon: 0.6, waste: 0.4 },
    wood: { carbon: 0.3, waste: 0.3 },
    treated_water: { carbon: 0.2, water: 1.0 },
    chemicals: { carbon: 1.5, waste: 0.7 },
    waste_oil: { carbon: 0.9, energy: 0.5 },
    biomass: { carbon: 0.4, energy: 0.3 }
  };

  const factor = factors[this.resourceType] || { carbon: 0.5, waste: 0.5 };
  const quantity = this.resourceDetails.quantity || 0;

  this.environmentalImpact.carbonSaved = quantity * factor.carbon;
  this.environmentalImpact.energySaved = quantity * (factor.energy || 0);
  this.environmentalImpact.wasteReduced = quantity * (factor.waste || 0);
  
  return this;
};

exchangeSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    resourceType: this.resourceType,
    resourceDetails: this.resourceDetails,
    availability: {
      status: this.availability.status,
      quantityAvailable: this.availability.quantityAvailable,
      availableFrom: this.availability.availableFrom,
      availableUntil: this.availability.availableUntil
    },
    pricing: {
      pricePerUnit: this.pricing.pricePerUnit,
      currency: this.pricing.currency,
      negotiable: this.pricing.negotiable,
      totalValue: this.pricing.totalValue
    },
    logistics: this.logistics,
    environmentalImpact: this.environmentalImpact,
    isAvailable: this.isAvailable,
    isMatched: this.isMatched,
    createdAt: this.createdAt
  };
};

exchangeSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    companyId: this.companyId,
    factoryId: this.factoryId,
    availability: this.availability,
    pricing: this.pricing,
    aiMatching: this.aiMatching,
    listing: this.listing,
    interests: this.interests,
    certifications: this.certifications,
    tags: this.tags,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

exchangeSchema.statics.findAvailable = async function(companyId) {
  return this.find({
    companyId,
    'availability.status': 'available',
    'availability.quantityAvailable': { $gt: 0 },
    deletedAt: null
  }).sort({ createdAt: -1 });
};

exchangeSchema.statics.findByResourceType = async function(resourceType, companyId) {
  const query = { resourceType, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ createdAt: -1 });
};

exchangeSchema.statics.findMatched = async function(companyId) {
  return this.find({
    companyId,
    'aiMatching.matched': true,
    deletedAt: null
  }).sort({ 'aiMatching.matchScore': -1 });
};

exchangeSchema.statics.findByFactory = async function(factoryId, companyId) {
  const query = { factoryId, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ createdAt: -1 });
};

exchangeSchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    {
      $match: {
        companyId,
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$resourceType',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$resourceDetails.quantity' },
        totalValue: { $sum: { $multiply: ['$resourceDetails.quantity', '$pricing.pricePerUnit'] } },
        available: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$availability.status', 'available'] },
                { $gt: ['$availability.quantityAvailable', 0] }
              ]},
              1,
              0
            ]
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return stats;
};

// ============ PRE-SAVE MIDDLEWARE ============

exchangeSchema.pre('save', function(next) {
  // تحديث updatedAt
  this.updatedAt = new Date();
  
  // تنظيف البيانات
  if (this.name) this.name = this.name.trim();
  if (this.description) this.description = this.description.trim();
  
  // حساب القيمة الإجمالية
  this.calculateTotalValue();
  
  // حساب الأثر البيئي
  this.calculateEnvironmentalImpact();
  
  next();
});

// ============ EXPORT ============

const Exchange = mongoose.model('Exchange', exchangeSchema);

module.exports = Exchange;