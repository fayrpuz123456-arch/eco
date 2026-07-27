const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ============ USER SCHEMA ============

const userSchema = new mongoose.Schema({
  // ===== Base Fields =====
  companyId: { 
    type: String, 
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return v && v.startsWith('comp_');
      },
      message: 'Company ID must start with "comp_"'
    }
  },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },

  // ===== Personal Information =====
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
    default: () => `firebase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
    default: 'employee'
  },
  permissions: {
    type: [String],
    default: []
  },

  // ===== Organization =====
  factoryIds: {
    type: [String],
    default: []
  },
  departmentIds: {
    type: [String],
    default: []
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

// فهارس للبحث
userSchema.index({ companyId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ factoryIds: 1 });
userSchema.index({ departmentIds: 1 });
userSchema.index({ 'preferences.language': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// فهارس فريدة
userSchema.index({ email: 1, companyId: 1 }, { unique: true });
userSchema.index({ firebaseUid: 1 }, { unique: true });

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

userSchema.virtual('isVerified').get(function() {
  return this.emailVerified;
});

userSchema.virtual('isSuspended').get(function() {
  return this.status === 'suspended';
});

userSchema.virtual('isArchived').get(function() {
  return this.status === 'archived';
});

userSchema.virtual('displayNameWithEmail').get(function() {
  return `${this.displayName} (${this.email})`;
});

// ============ PRE-SAVE MIDDLEWARE ============

userSchema.pre('save', function(next) {
  try {
    this.updatedAt = new Date();
    
    // تحديث displayName تلقائياً من firstName + lastName
    if (this.isModified('firstName') || this.isModified('lastName')) {
      if (this.firstName && this.lastName) {
        this.displayName = `${this.firstName} ${this.lastName}`;
      } else if (this.firstName) {
        this.displayName = this.firstName;
      } else if (this.lastName) {
        this.displayName = this.lastName;
      }
    }
    
    // تنظيف البريد الإلكتروني
    if (this.isModified('email') && this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    
    // تنظيف رقم الهاتف
    if (this.isModified('phoneNumber') && this.phoneNumber) {
      this.phoneNumber = this.phoneNumber.trim();
    }
    
    // توليد firebaseUid إذا لم يكن موجوداً
    if (!this.firebaseUid || this.firebaseUid === '') {
      this.firebaseUid = `firebase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // إعادة تعيين محاولات تسجيل الدخول الفاشلة عند إلغاء القفل
    if (this.isModified('lockedUntil') && !this.lockedUntil) {
      this.failedLoginAttempts = 0;
    }
    
    // التحقق من صحة companyId
    if (this.companyId && !this.companyId.startsWith('comp_')) {
      return next(new Error('Company ID must start with "comp_"'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// ============ PRE-VALIDATE MIDDLEWARE ============

userSchema.pre('validate', function(next) {
  try {
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
    
    if (this.phoneNumber) {
      this.phoneNumber = this.phoneNumber.trim();
    }
    
    if (this.bio) {
      this.bio = this.bio.trim();
    }
    
    // التحقق من أن البريد الإلكتروني صحيح
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (this.email && !emailRegex.test(this.email)) {
      return next(new Error('Invalid email format'));
    }
    
    // التحقق من أن displayName ليس فارغاً
    if (this.displayName && this.displayName.length < 2) {
      return next(new Error('Display name must be at least 2 characters'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// ============ PRE-FINDONEANDUPDATE MIDDLEWARE ============

userSchema.pre('findOneAndUpdate', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    next();
  } catch (error) {
    next(error);
  }
});

// ============ PRE-UPDATEONE MIDDLEWARE ============

userSchema.pre('updateOne', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    next();
  } catch (error) {
    next(error);
  }
});

// ============ PRE-UPDATEMANY MIDDLEWARE ============

userSchema.pre('updateMany', function(next) {
  try {
    this.set({ updatedAt: new Date() });
    next();
  } catch (error) {
    next(error);
  }
});

// ============ POST-SAVE MIDDLEWARE ============

userSchema.post('save', function(doc) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ User saved successfully:', doc._id);
  }
});

userSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Error saving user:', error.message);
  }
  next(error);
});

// ============ POST-FINDONEANDUPDATE MIDDLEWARE ============

userSchema.post('findOneAndUpdate', function(doc) {
  if (doc && process.env.NODE_ENV !== 'production') {
    console.log('✅ User updated successfully:', doc._id);
  }
});

// ============ METHODS ============

/**
 * تسجيل دخول المستخدم
 */
userSchema.methods.recordLogin = async function(ip, userAgent, deviceInfo = {}) {
  this.lastLogin = new Date();
  this.lastIP = ip;
  this.lastUserAgent = userAgent;
  this.lastActive = new Date();
  this.loginCount += 1;
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;

  if (deviceInfo && Object.keys(deviceInfo).length > 0) {
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

/**
 * تسجيل خروج المستخدم
 */
userSchema.methods.recordLogout = async function() {
  this.lastLogout = new Date();
  return this.save();
};

/**
 * تحديث آخر نشاط
 */
userSchema.methods.updateLastActive = async function() {
  this.lastActive = new Date();
  return this.save();
};

/**
 * إضافة توكن جلسة
 */
userSchema.methods.addSessionToken = function(token) {
  if (!token) return this;
  
  if (!this.sessionTokens.includes(token)) {
    this.sessionTokens.push(token);
    if (this.sessionTokens.length > 10) {
      this.sessionTokens.shift();
    }
  }
  return this.save();
};

/**
 * إزالة توكن جلسة
 */
userSchema.methods.removeSessionToken = function(token) {
  if (!token) return this;
  this.sessionTokens = this.sessionTokens.filter(t => t !== token);
  return this.save();
};

/**
 * إبطال جميع الجلسات
 */
userSchema.methods.revokeAllSessions = function() {
  this.sessionTokens = [];
  return this.save();
};

/**
 * التحقق من وجود صلاحية معينة
 */
userSchema.methods.hasPermission = function(permission) {
  if (!permission) return true;
  
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

/**
 * التحقق من وجود جميع الصلاحيات المطلوبة
 */
userSchema.methods.hasAllPermissions = function(permissions) {
  if (!permissions || permissions.length === 0) return true;
  return permissions.every(p => this.hasPermission(p));
};

/**
 * التحقق من وجود أي صلاحية من المطلوبة
 */
userSchema.methods.hasAnyPermission = function(permissions) {
  if (!permissions || permissions.length === 0) return true;
  return permissions.some(p => this.hasPermission(p));
};

/**
 * التحقق من الدور
 */
userSchema.methods.hasRole = function(role) {
  if (!role) return true;
  if (this.role === 'super_admin') return true;
  if (Array.isArray(role)) {
    return role.includes(this.role);
  }
  return this.role === role;
};

/**
 * التحقق من الوصول للمصنع
 */
userSchema.methods.hasFactoryAccess = function(factoryId) {
  if (!factoryId) return true;
  if (this.role === 'super_admin' || this.role === 'admin') return true;
  return this.factoryIds.includes(factoryId);
};

/**
 * التحقق من الوصول للقسم
 */
userSchema.methods.hasDepartmentAccess = function(departmentId) {
  if (!departmentId) return true;
  if (this.role === 'super_admin' || this.role === 'admin') return true;
  return this.departmentIds.includes(departmentId);
};

/**
 * تسجيل محاولة تسجيل دخول فاشلة
 */
userSchema.methods.recordFailedLogin = async function() {
  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }

  return this.save();
};

/**
 * إعادة تعيين محاولات تسجيل الدخول الفاشلة
 */
userSchema.methods.resetFailedLoginAttempts = function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  return this.save();
};

/**
 * تغيير كلمة المرور
 */
userSchema.methods.changePassword = async function(newPasswordHash) {
  if (!newPasswordHash) return this;
  
  if (this.passwordHistory.length >= 5) {
    this.passwordHistory.shift();
  }
  this.passwordHistory.push(newPasswordHash);
  this.lastPasswordChange = new Date();
  return this.save();
};

/**
 * التحقق من إمكانية إدارة مستخدم آخر
 */
userSchema.methods.canManageUser = function(targetUser) {
  if (!targetUser) return false;
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

/**
 * الحصول على الاسم الكامل
 */
userSchema.methods.getFullName = function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName || this.email || 'User';
};

/**
 * البيانات العامة للـ API
 */
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

/**
 * البيانات الكاملة للإدارة
 */
userSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    phoneNumber: this.phoneNumber,
    bio: this.bio,
    firebaseUid: this.firebaseUid,
    twoFactorEnabled: this.twoFactorEnabled,
    loginCount: this.loginCount,
    lastActive: this.lastActive,
    lastIP: this.lastIP,
    lastUserAgent: this.lastUserAgent,
    metadata: this.metadata,
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletedReason: this.deletedReason
  };
};

// ============ STATIC METHODS ============

/**
 * البحث عن مستخدم بالإيميل
 */
userSchema.statics.findByEmail = function(email, companyId) {
  if (!email) return null;
  
  const query = { email: email.toLowerCase(), deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.findOne(query);
};

/**
 * البحث عن مستخدم بـ Firebase UID
 */
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  if (!firebaseUid) return null;
  return this.findOne({ firebaseUid, deletedAt: null });
};

/**
 * البحث عن مستخدمين حسب الدور
 */
userSchema.statics.findByRole = function(role, companyId) {
  if (!role) return [];
  
  const query = { role, deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

/**
 * البحث عن مستخدمين نشطين
 */
userSchema.statics.findActive = function(companyId) {
  const query = { status: 'active', deletedAt: null };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

/**
 * البحث عن مستخدمين حسب المصنع
 */
userSchema.statics.findByFactory = function(factoryId, companyId) {
  if (!factoryId) return [];
  
  const query = {
    factoryIds: factoryId,
    deletedAt: null
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

/**
 * البحث عن مستخدمين حسب القسم
 */
userSchema.statics.findByDepartment = function(departmentId, companyId) {
  if (!departmentId) return [];
  
  const query = {
    departmentIds: departmentId,
    deletedAt: null
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

/**
 * البحث عن مستخدمين حسب الصلاحية
 */
userSchema.statics.findByPermission = function(permission, companyId) {
  if (!permission) return [];
  
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

/**
 * البحث النصي
 */
userSchema.statics.search = function(searchTerm, companyId) {
  if (!searchTerm || searchTerm.length < 2) return [];
  
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
  return this.find(query).limit(50);
};

/**
 * الحصول على إحصائيات المستخدمين
 */
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

/**
 * الحصول على المستخدمين الذين لم يسجلوا دخول منذ فترة
 */
userSchema.statics.findInactiveSince = async function(days, companyId) {
  if (!days || days < 1) return [];
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const query = {
    lastLogin: { $lt: cutoffDate },
    deletedAt: null,
    status: 'active'
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

/**
 * الحصول على المستخدمين الذين لديهم جلسات نشطة
 */
userSchema.statics.findWithActiveSessions = async function(companyId) {
  const query = {
    sessionTokens: { $exists: true, $ne: [] },
    deletedAt: null,
    status: 'active'
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return this.find(query);
};

// ============ EXPORT ============

const User = mongoose.model('User', userSchema);

module.exports = User;