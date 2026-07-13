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
    required: true
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

// ============ VIRTUALS ============

departmentSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

departmentSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
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
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

departmentSchema.statics.findByCode = function(code, factoryId) {
  return this.findOne({ code: code.toUpperCase(), factoryId, deletedAt: null });
};

departmentSchema.statics.findByName = function(name, factoryId) {
  return this.findOne({ name: name.trim(), factoryId, deletedAt: null });
};

departmentSchema.statics.findByType = function(type, factoryId) {
  const query = { type, deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
};

departmentSchema.statics.findActive = function(factoryId) {
  const query = { status: 'active', deletedAt: null };
  if (factoryId) query.factoryId = factoryId;
  return this.find(query);
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
  return this.find(query);
};

// ============ EXPORT ============

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;