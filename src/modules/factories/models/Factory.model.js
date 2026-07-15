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
factorySchema.index({ companyId: 1, status: 1 });
factorySchema.index({ industry: 1 });
factorySchema.index({ name: 1 });
factorySchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

factorySchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

factorySchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ PRE-SAVE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-save middleware
// تجنباً لتكرار Pre-save hooks

/*
factorySchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.contactEmail) this.contactEmail = this.contactEmail.toLowerCase().trim();
    if (this.description) this.description = this.description.trim();
    
    if (this.address) {
      if (this.address.street) this.address.street = this.address.street.trim();
      if (this.address.city) this.address.city = this.address.city.trim();
      if (this.address.state) this.address.state = this.address.state.trim();
      if (this.address.country) this.address.country = this.address.country.trim();
      if (this.address.postalCode) this.address.postalCode = this.address.postalCode.trim();
    }
    
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.code) {
      return next(new Error('Code is required'));
    }
    
    if (!this.industry) {
      return next(new Error('Industry is required'));
    }
    
    if (!this.companyId) {
      return next(new Error('Company ID is required'));
    }
    
    if (!this.contactEmail) {
      return next(new Error('Contact email is required'));
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.contactEmail)) {
      return next(new Error('Invalid email format'));
    }
    
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-VALIDATE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-validate

/*
factorySchema.pre('validate', function(next) {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    
    if (this.contactEmail) {
      this.contactEmail = this.contactEmail.toLowerCase().trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
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
factorySchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEONE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateOne

/*
factorySchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ PRE-UPDATEMANY MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-updateMany

/*
factorySchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ POST-SAVE MIDDLEWARE ============

factorySchema.post('save', function(doc) {
  console.log('✅ Factory saved successfully:', doc._id);
});

factorySchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving factory:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

factorySchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Factory updated successfully:', doc._id);
  }
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
    contactPhone: this.contactPhone,
    address: this.address,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

factorySchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    deletedAt: this.deletedAt
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

factorySchema.statics.getStats = async function(companyId) {
  const match = { deletedAt: null };
  if (companyId) match.companyId = companyId;
  
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
        inactive: {
          $sum: {
            $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0]
          }
        },
        archived: {
          $sum: {
            $cond: [{ $eq: ['$status', 'archived'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, active: 0, inactive: 0, archived: 0 };
};

factorySchema.statics.getIndustryDistribution = async function(companyId) {
  const match = { deletedAt: null };
  if (companyId) match.companyId = companyId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$industry',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// ============ EXPORT ============

const Factory = mongoose.model('Factory', factorySchema);

module.exports = Factory;