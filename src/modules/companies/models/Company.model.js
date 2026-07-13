const mongoose = require('mongoose');

// ============ COMPANY SCHEMA ============

const companySchema = new mongoose.Schema({
  // ===== Base Fields =====
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
    unique: true,
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
  website: {
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
companySchema.index({ code: 1 }, { unique: true });

// ============ VIRTUALS ============

companySchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

companySchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ METHODS ============

companySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    industry: this.industry,
    description: this.description,
    contactEmail: this.contactEmail,
    address: this.address,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

companySchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), deletedAt: null });
};

companySchema.statics.findByName = function(name) {
  return this.findOne({ name, deletedAt: null });
};

companySchema.statics.findByIndustry = function(industry) {
  return this.find({ industry, deletedAt: null });
};

companySchema.statics.findActiveCompanies = function() {
  return this.find({ status: 'active', deletedAt: null });
};

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
      { 'address.country': searchRegex }
    ]
  });
};

// ============ EXPORT ============

const Company = mongoose.model('Company', companySchema);

module.exports = Company;