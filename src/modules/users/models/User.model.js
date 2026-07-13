const mongoose = require('mongoose');

// ============ USER SCHEMA ============

const userSchema = new mongoose.Schema({
  // ===== Base Fields =====
  companyId: { type: String, required: true, default: 'comp_test_001', index: true },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active',
    index: true
  },

  // ===== Personal Information =====
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  profilePicture: {
    type: String,
    default: null
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: null
  },

  // ===== Firebase Integration =====
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `firebase_${Date.now()}`
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },

  // ===== Role & Permissions =====
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'engineer', 'employee', 'viewer'],
    default: 'employee',
    index: true
  },
  permissions: {
    type: [String],
    default: []
  },

  // ===== Organization =====
  factoryIds: {
    type: [String],
    default: [],
    index: true
  },
  departmentIds: {
    type: [String],
    default: [],
    index: true
  },
  productionLineIds: {
    type: [String],
    default: []
  },
  machineIds: {
    type: [String],
    default: []
  },

  // ===== Preferences =====
  preferences: {
    language: {
      type: String,
      enum: ['en', 'ar', 'fr', 'es', 'de', 'zh'],
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true }
    },
    dashboard: {
      refreshRate: { type: Number, min: 1000, max: 60000, default: 5000 },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      defaultView: { type: String, default: 'overview' },
      widgets: { type: [String], default: [] }
    },
    reports: {
      defaultFormat: { type: String, enum: ['pdf', 'excel', 'csv'], default: 'pdf' },
      autoGenerate: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' }
    }
  },

  // ===== Security =====
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  twoFactorBackupCodes: {
    type: [String],
    default: []
  },
  sessionTokens: {
    type: [String],
    default: []
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  passwordHistory: {
    type: [String],
    default: []
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },

  // ===== Activity =====
  lastLogin: {
    type: Date,
    default: null
  },
  lastLogout: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: null
  },
  lastIP: {
    type: String,
    default: null
  },
  lastUserAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Metadata =====
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ===== Soft Delete =====
  deletedBy: {
    type: String,
    default: null
  },
  deletedReason: {
    type: String,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  },
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      delete ret.twoFactorSecret;
      delete ret.twoFactorBackupCodes;
      delete ret.sessionTokens;
      delete ret.passwordHistory;
      delete ret.failedLoginAttempts;
      delete ret.lockedUntil;
      return ret;
    }
  }
});

// ============ INDEXES ============

userSchema.index({ email: 1, companyId: 1 }, { unique: true });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'preferences.language': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// ============ VIRTUALS ============

userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName;
});

userSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.deletedAt;
});

userSchema.virtual('isLocked').get(function() {
  return this.lockedUntil && this.lockedUntil > new Date();
});

userSchema.virtual('isTwoFactorEnabled').get(function() {
  return this.twoFactorEnabled;
});

// ============ METHODS ============

userSchema.methods.recordLogin = async function(ip, userAgent, deviceInfo = {}) {
  this.lastLogin = new Date();
  this.lastIP = ip;
  this.lastUserAgent = userAgent;
  this.lastActive = new Date();
  this.loginCount += 1;
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;

  if (deviceInfo) {
    this.deviceInfo = {
      ...this.deviceInfo,
      [ip]: {
        userAgent,
        deviceInfo,
        lastSeen: new Date()
      }
    };
  }

  return this.save();
};

userSchema.methods.recordLogout = async function() {
  this.lastLogout = new Date();
  return this.save();
};

userSchema.methods.updateLastActive = async function() {
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.addSessionToken = function(token) {
  if (!this.sessionTokens.includes(token)) {
    this.sessionTokens.push(token);
    if (this.sessionTokens.length > 10) {
      this.sessionTokens.shift();
    }
  }
  return this.save();
};

userSchema.methods.removeSessionToken = function(token) {
  this.sessionTokens = this.sessionTokens.filter(t => t !== token);
  return this.save();
};

userSchema.methods.revokeAllSessions = function() {
  this.sessionTokens = [];
  return this.save();
};

userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;

  if (this.role === 'admin') {
    const restrictedPermissions = ['system:manage', 'system:maintenance'];
    if (restrictedPermissions.includes(permission)) {
      return false;
    }
    return true;
  }

  return this.permissions.includes(permission);
};

userSchema.methods.hasAllPermissions = function(permissions) {
  return permissions.every(p => this.hasPermission(p));
};

userSchema.methods.hasAnyPermission = function(permissions) {
  return permissions.some(p => this.hasPermission(p));
};

userSchema.methods.hasRole = function(role) {
  if (this.role === 'super_admin') return true;
  if (Array.isArray(role)) {
    return role.includes(this.role);
  }
  return this.role === role;
};

userSchema.methods.hasFactoryAccess = function(factoryId) {
  if (this.role === 'super_admin' || this.role === 'admin') return true;
  return this.factoryIds.includes(factoryId);
};

userSchema.methods.hasDepartmentAccess = function(departmentId) {
  if (this.role === 'super_admin' || this.role === 'admin') return true;
  return this.departmentIds.includes(departmentId);
};

userSchema.methods.recordFailedLogin = async function() {
  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }

  return this.save();
};

userSchema.methods.resetFailedLoginAttempts = function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  return this.save();
};

userSchema.methods.changePassword = async function(newPasswordHash) {
  if (this.passwordHistory.length >= 5) {
    this.passwordHistory.shift();
  }
  this.passwordHistory.push(newPasswordHash);
  this.lastPasswordChange = new Date();
  return this.save();
};

userSchema.methods.canManageUser = function(targetUser) {
  if (this.role === 'super_admin') return true;

  if (this.role === 'admin') {
    return this.companyId === targetUser.companyId && targetUser.role !== 'admin';
  }

  if (this.role === 'manager') {
    return this.companyId === targetUser.companyId &&
           ['engineer', 'employee', 'viewer'].includes(targetUser.role) &&
           this.departmentIds.some(id => targetUser.departmentIds.includes(id));
  }

  return this.id === targetUser.id;
};

userSchema.methods.getFullName = function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName;
};

userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    displayName: this.displayName,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.fullName,
    profilePicture: this.profilePicture,
    role: this.role,
    permissions: this.permissions,
    factoryIds: this.factoryIds,
    departmentIds: this.departmentIds,
    preferences: this.preferences,
    isActive: this.isActive,
    isLocked: this.isLocked,
    emailVerified: this.emailVerified,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============

userSchema.statics.findByEmail = function(email, companyId) {
  const query = { email: email.toLowerCase(), deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.findOne(query);
};

userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid, deletedAt: null });
};

userSchema.statics.findByRole = function(role, companyId) {
  const query = { role, deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.findActive = function(companyId) {
  const query = { status: 'active', deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.findByFactory = function(factoryId, companyId) {
  const query = {
    factoryIds: factoryId,
    deletedAt: null
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.findByDepartment = function(departmentId, companyId) {
  const query = {
    departmentIds: departmentId,
    deletedAt: null
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.findByPermission = function(permission, companyId) {
  const query = {
    deletedAt: null,
    $or: [
      { role: 'super_admin' },
      { role: 'admin' },
      { permissions: permission }
    ]
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.search = function(searchTerm, companyId) {
  const searchRegex = new RegExp(searchTerm, 'i');
  const query = {
    deletedAt: null,
    $or: [
      { email: searchRegex },
      { displayName: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { phoneNumber: searchRegex }
    ]
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

userSchema.statics.getStats = async function(companyId) {
  const match = { deletedAt: null };
  if (companyId) {
    match.companyId = companyId;
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        managers: { $sum: { $cond: [{ $eq: ['$role', 'manager'] }, 1, 0] } },
        engineers: { $sum: { $cond: [{ $eq: ['$role', 'engineer'] }, 1, 0] } },
        employees: { $sum: { $cond: [{ $eq: ['$role', 'employee'] }, 1, 0] } },
        viewers: { $sum: { $cond: [{ $eq: ['$role', 'viewer'] }, 1, 0] } },
        verified: { $sum: { $cond: ['$emailVerified', 1, 0] } },
        twoFactor: { $sum: { $cond: ['$twoFactorEnabled', 1, 0] } },
        activeToday: {
          $sum: {
            $cond: [
              { $gte: ['$lastActive', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
              1, 0
            ]
          }
        }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    admins: 0,
    managers: 0,
    engineers: 0,
    employees: 0,
    viewers: 0,
    verified: 0,
    twoFactor: 0,
    activeToday: 0
  };
};

// ============ MIDDLEWARE ============

userSchema.pre('save', function() {
  this.updatedAt = new Date();
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.displayName) {
    this.displayName = this.displayName.trim();
  }
  if (this.firstName) {
    this.firstName = this.firstName.trim();
  }
  if (this.lastName) {
    this.lastName = this.lastName.trim();
  }
  // مفيش next() خالص - في Mongoose 9 أي throw هنا كافي إن الـ hook يوقف السيف بـ error
});

// ============ EXPORT ============

const User = mongoose.model('User', userSchema);

module.exports = User;