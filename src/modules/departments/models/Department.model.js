const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ DEPARTMENT SCHEMA ============
// ✅ تم التحويل لاستخدام BaseModel.createSchema بدل new mongoose.Schema المباشر.
// السبب: الحقول القديمة (status, deletedAt, createdAt, updatedAt) كانت معرّفة يدوياً
// هنا لكن بدون companyId/createdBy/updatedBy/metadata، فكانت هذه الحقول تُحذف بصمت
// عند الحفظ (Mongoose بيشيل أي حقل مش معرّف في الـ schema لما strict: true، الافتراضي).
// النتيجة: أي Query بيفلتر بـ companyId (زي حساب الـ Dashboard metrics) كان بيرجع 0
// دايماً رغم إن الحفظ نفسه كان بينجح.

const departmentSchema = BaseModel.createSchema({
  // ===== Base Fields (مضافة من BaseModel) =====
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
// ✅ status و deletedAt معرّفين بالفعل في BaseModel، فاتشالوا من هنا لتفادي
// "Duplicate schema index" warning

departmentSchema.index({ code: 1, factoryId: 1, companyId: 1 }, { unique: true });
departmentSchema.index({ factoryId: 1 });
departmentSchema.index({ type: 1 });
departmentSchema.index({ name: 1 });
departmentSchema.index({ factoryId: 1, type: 1 });

// ============ VIRTUALS ============

departmentSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

departmentSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// ============ PRE-VALIDATE MIDDLEWARE (async style — no `next` param) ============

departmentSchema.pre('validate', async function() {
  if (this.name) this.name = this.name.trim();
  if (this.code) this.code = this.code.toUpperCase().trim();
  if (this.description) this.description = this.description.trim();

  const codeRegex = /^[A-Z0-9]+$/;
  if (this.code && !codeRegex.test(this.code)) {
    throw new Error('Code must contain only uppercase letters and numbers');
  }
});

// ============ PRE-SAVE MIDDLEWARE (async style — no `next` param) ============

departmentSchema.pre('save', async function() {
  this.updatedAt = new Date();

  if (!this.name) throw new Error('Name is required');
  if (!this.code) throw new Error('Code is required');
  if (!this.factoryId) throw new Error('Factory ID is required');
  if (!this.type) throw new Error('Type is required');
});

// ============ PRE-UPDATE HOOKS (findOneAndUpdate / updateOne / updateMany) ============

departmentSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function() {
  this.set({ updatedAt: new Date() });
});

// ============ POST-SAVE MIDDLEWARE ============

departmentSchema.post('save', function(doc) {
  console.log('✅ Department saved successfully:', doc._id);
});

// ⚠️ هام: error-handling middleware في mongoose/kareem بيتحدد بعدد الـ parameters
// (fn.length). لازم يكون 3 (error, doc, next) عشان يتعرف عليه صح كـ error handler،
// مش hook عادي. لو قللناه لباراميترين هيتعامل معاه كـ (doc, next) عادي، والـ error
// هيبقى فعلياً الـ document المحفوظ (قيمة truthy دايماً) → false alarm بعد نجاح الحفظ.

departmentSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving department:', error.message);
    return next(error);
  }
  next();
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

departmentSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
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
    companyId: this.companyId,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

departmentSchema.statics.findByCode = function(code, factoryId, companyId) {
  const query = { code: code.toUpperCase(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

departmentSchema.statics.findByName = function(name, factoryId, companyId) {
  const query = { name: name.trim(), deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.findOne(query);
};

departmentSchema.statics.findByType = function(type, factoryId, companyId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

departmentSchema.statics.findActive = function(factoryId, companyId) {
  const query = { status: 'active', deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

departmentSchema.statics.search = function(searchTerm, factoryId, companyId) {
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

departmentSchema.statics.findByFactory = async function(factoryId, companyId) {
  const query = { factoryId, deletedAt: null };
  if (companyId) query.companyId = companyId;
  return this.find(query).sort({ name: 1 });
};

// ============ EXPORT ============

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;