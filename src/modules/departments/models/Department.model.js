const mongoose = require('mongoose');

// ============ DEPARTMENT SCHEMA ============

const departmentSchema = new mongoose.Schema({
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
  factoryId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'production', 'maintenance', 'warehouse', 'packaging',
      'quality', 'energy', 'utilities', 'health_safety',
      'environmental', 'logistics', 'research', 'administration',
      'hr', 'it', 'finance', 'procurement', 'sales', 'marketing', 'other'
    ],
    default: 'production'
  },
  description: {
    type: String,
    default: null
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
departmentSchema.index({ code: 1, factoryId: 1 }, { unique: true });
departmentSchema.index({ factoryId: 1, status: 1 });
departmentSchema.index({ type: 1 });
departmentSchema.index({ name: 1 });
departmentSchema.index({ deletedAt: 1 }, { sparse: true });
departmentSchema.index({ factoryId: 1, type: 1 });

// ============ VIRTUALS ============

departmentSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

departmentSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ PRE-SAVE MIDDLEWARE ============
// ✅ تم التعليق لأن BaseModel يوفر Pre-save middleware
// تجنباً لتكرار Pre-save hooks

/*
departmentSchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    if (this.name) this.name = this.name.trim();
    if (this.code) this.code = this.code.toUpperCase().trim();
    if (this.description) this.description = this.description.trim();
    
    if (!this.name) {
      return next(new Error('Name is required'));
    }
    
    if (!this.code) {
      return next(new Error('Code is required'));
    }
    
    if (!this.factoryId) {
      return next(new Error('Factory ID is required'));
    }
    
    if (!this.type) {
      return next(new Error('Type is required'));
    }
    
    if (this.isNew) {
      // التحقق من التكرار سيتم بواسطة MongoDB unique index
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
departmentSchema.pre('validate', function(next) {
  try {
    if (this.name) {
      this.name = this.name.trim();
    }
    
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    
    if (this.description) {
      this.description = this.description.trim();
    }
    
    const codeRegex = /^[A-Z0-9]+$/;
    if (this.code && !codeRegex.test(this.code)) {
      return next(new Error('Code must contain only uppercase letters and numbers'));
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
departmentSchema.pre('findOneAndUpdate', function(next) {
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
departmentSchema.pre('updateOne', function(next) {
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
departmentSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    return next();
  } catch (error) {
    return next(error);
  }
});
*/

// ============ POST-SAVE MIDDLEWARE ============

departmentSchema.post('save', function(doc) {
  console.log('✅ Department saved successfully:', doc._id);
});

departmentSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving department:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

departmentSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('✅ Department updated successfully:', doc._id);
  }
});

// ============ METHODS ============

departmentSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    type: this.type,
    factoryId: this.factoryId,
    description: this.description,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

departmentSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    deletedAt: this.deletedAt
  };
};

// ============ STATIC METHODS ============

departmentSchema.statics.findByCode = function(code, factoryId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.findOne(query);
};

departmentSchema.statics.findByName = function(name, factoryId) {
  const query = { name: name.trim(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.findOne(query);
};

departmentSchema.statics.findByType = function(type, factoryId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query).sort({ name: 1 });
};

departmentSchema.statics.findActive = function(factoryId) {
  const query = { status: 'active', deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query).sort({ name: 1 });
};

departmentSchema.statics.search = function(searchTerm, factoryId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
      { type: searchRegex }
    ]
  };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query).sort({ name: 1 });
};

departmentSchema.statics.getStats = async function(factoryId) {
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

departmentSchema.statics.getTypeDistribution = async function(factoryId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

departmentSchema.statics.findByFactory = async function(factoryId) {
  return this.find({
    factoryId,
    deletedAt: null
  }).sort({ name: 1 });
};

// ============ EXPORT ============

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;