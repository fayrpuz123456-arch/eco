const mongoose = require('mongoose');

// ============ FACTORY SCHEMA ============

const factorySchema = new mongoose.Schema({
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
      'agriculture', 'technology', 'logistics', 'other'
    ]
  },
  companyId: {
    type: String,
    required: true
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
  description: {
    type: String,
    default: null
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
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
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// ============ INDEXES ============
factorySchema.index({ code: 1, companyId: 1 }, { unique: true });

// ============ VIRTUALS ============

factorySchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

factorySchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ METHODS ============

factorySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    industry: this.industry,
    companyId: this.companyId,
    description: this.description,
    contactEmail: this.contactEmail,
    address: this.address,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

factorySchema.statics.findByCode = function(code, companyId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

factorySchema.statics.findByName = function(name, companyId) {
  const query = { name: name.trim(), deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

factorySchema.statics.findByIndustry = function(industry, companyId) {
  const query = { industry, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

factorySchema.statics.findActive = function(companyId) {
  const query = { status: 'active', deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

factorySchema.statics.search = function(searchTerm, companyId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
      { industry: searchRegex },
      { 'address.city': searchRegex },
      { 'address.country': searchRegex }
    ]
  };
  if (companyId) query.companyId = companyId;
  return this.find(query);
};

// ============ EXPORT ============

const Factory = mongoose.model('Factory', factorySchema);

module.exports = Factory;