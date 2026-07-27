const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ DEPARTMENT SCHEMA ============

const departmentSchema = BaseModel.createSchema({
  // ===== Base Fields (من BaseModel) =====
  // companyId, createdBy, updatedBy, createdAt, updatedAt, deletedAt, status, metadata

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

  // ===== Soft Delete =====
  deletedBy: { type: String, default: null },
  deletedReason: { type: String, default: null }
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

departmentSchema.index({ code: 1, factoryId: 1, companyId: 1 }, { unique: true });
departmentSchema.index({ factoryId: 1, type: 1 });
departmentSchema.index({ name: 1 });

// ============ VIRTUALS ============

departmentSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

departmentSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ PRE-VALIDATE MIDDLEWARE ============
// ملاحظة: تم إزالة next() نهائيًا. Mongoose يلتقط أي throw هنا تلقائيًا
// ويحوّله لخطأ validation، وده أضمن ومش مرتبط بمشاكل توقيع الـ callback.

departmentSchema.pre('validate', function() {
  if (this.name) this.name = this.name.trim();
  if (this.code) this.code = this.code.toUpperCase().trim();
  if (this.description) this.description = this.description.trim();

  const codeRegex = /^[A-Z0-9]+$/;
  if (this.code && !codeRegex.test(this.code)) {
    throw new Error('Code must contain only uppercase letters and numbers');
  }

  if (!this.factoryId) {
    throw new Error('Factory ID is required');
  }
});

// ============ PRE-SAVE MIDDLEWARE ============

departmentSchema.pre('save', function() {
  this.updatedAt = new Date();

  if (!this.name) {
    throw new Error('Name is required');
  }
  if (!this.code) {
    throw new Error('Code is required');
  }
  if (!this.factoryId) {
    throw new Error('Factory ID is required');
  }
  if (!this.type) {
    throw new Error('Type is required');
  }

  const codeRegex = /^[A-Z0-9]+$/;
  if (this.code && !codeRegex.test(this.code)) {
    throw new Error('Code must contain only uppercase letters and numbers');
  }
});

// ============ PRE-UPDATE HOOKS ============

departmentSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function() {
  this.set({ updatedAt: new Date() });
});

// ============ POST-SAVE MIDDLEWARE ============

departmentSchema.post('save', function(doc) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Department saved successfully:', doc._id);
  }
});

// error-handling middleware (لازم تاخد 3 params بالظبط عشان Mongoose يتعرف عليها)
departmentSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving department:', error.message);
    return next(error);
  }
  next();
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

departmentSchema.post('findOneAndUpdate', function(doc) {
  if (doc && process.env.NODE_ENV !== 'production') {
    console.log('✅ Department updated successfully:', doc._id);
  }
});

departmentSchema.post('findOneAndUpdate', function(error, doc, next) {
  if (error) {
    console.error('❌ Error updating department:', error.message);
    return next(error);
  }
  next();
});

// ============ METHODS ============

/**
 * التحقق من صحة القسم
 */
departmentSchema.methods.isValid = function() {
  return !!(this.name && this.code && this.factoryId && this.type);
};

/**
 * الحصول على معلومات عامة (للـ API)
 */
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

/**
 * البيانات الكاملة للإدارة
 */
departmentSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    companyId: this.companyId,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن قسم بالكود
 */
departmentSchema.statics.findByCode = function(code, factoryId, companyId) {
  if (!code) return null;

  const query = { code: code.toUpperCase(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

/**
 * البحث عن قسم بالاسم
 */
departmentSchema.statics.findByName = function(name, factoryId, companyId) {
  if (!name) return null;

  const query = { name: name.trim(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

/**
 * البحث عن أقسام حسب النوع
 */
departmentSchema.statics.findByType = function(type, factoryId, companyId) {
  if (!type) return [];

  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

/**
 * البحث عن الأقسام النشطة
 */
departmentSchema.statics.findActive = function(factoryId, companyId) {
  const query = { status: 'active', deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

/**
 * البحث النصي في الأقسام
 */
departmentSchema.statics.search = function(searchTerm, factoryId, companyId) {
  if (!searchTerm || searchTerm.length < 2) return [];

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
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

/**
 * الحصول على إحصائيات الأقسام
 */
departmentSchema.statics.getStats = async function(factoryId, companyId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
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
        maintenance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0]
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

  return stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    maintenance: 0,
    archived: 0
  };
};

/**
 * توزيع الأقسام حسب النوع
 */
departmentSchema.statics.getTypeDistribution = async function(factoryId, companyId) {
  const match = { deletedAt: null };
  if (factoryId) match.factoryId = factoryId;
  if (companyId) match.companyId = companyId;

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

/**
 * الحصول على أقسام المصنع
 */
departmentSchema.statics.findByFactory = async function(factoryId, companyId) {
  if (!factoryId) return [];

  const query = { factoryId, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

/**
 * الحصول على الأقسام حسب الحالة
 */
departmentSchema.statics.findByStatus = async function(status, factoryId, companyId) {
  if (!status) return [];

  const query = { status, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

// ============ EXPORT ============

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;