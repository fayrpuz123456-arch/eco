const BaseRepository = require('../../../core/base/BaseRepository');
const User = require('../models/User.model');
const { NotFoundError } = require('../../../core/middleware/errorHandler');
const logger = require('../../../core/utils/logger');

/**
 * مستودع المستخدمين - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالمستخدمين
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(User);
    this.model = User;
  }

  // ============ FIND METHODS ============

  /**
   * البحث عن مستخدم بالإيميل
   */
  async findByEmail(email, companyId = null) {
    const query = { email: email.toLowerCase(), deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOne(query);
  }

  /**
   * البحث عن مستخدم بـ Firebase UID
   */
  async findByFirebaseUid(firebaseUid) {
    return this.model.findOne({ firebaseUid, deletedAt: null });
  }

  /**
   * البحث عن مستخدمين حسب الدور
   */
  async findByRole(role, companyId = null) {
    const query = { role, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن مستخدمين حسب الصلاحية
   */
  async findByPermission(permission, companyId = null) {
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
    return this.model.find(query);
  }

  /**
   * البحث عن مستخدمين حسب المصنع
   */
  async findByFactory(factoryId, companyId = null) {
    const query = {
      factoryIds: factoryId,
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن مستخدمين حسب القسم
   */
  async findByDepartment(departmentId, companyId = null) {
    const query = {
      departmentIds: departmentId,
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن مستخدمين نشطين
   */
  async findActive(companyId = null) {
    const query = { status: 'active', deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن مستخدمين غير نشطين
   */
  async findInactive(companyId = null) {
    const query = {
      status: { $in: ['inactive', 'suspended'] },
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن المستخدمين الذين لديهم صلاحية معينة
   */
  async findUsersWithPermission(permission, companyId = null) {
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
    return this.model.find(query);
  }

  /**
   * البحث عن المستخدمين النشطين اليوم
   */
  async findActiveToday(companyId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const query = {
      lastActive: { $gte: today },
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث عن المستخدمين الذين لم يسجلوا دخول منذ فترة
   */
  async findInactiveSince(days, companyId = null) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    const query = {
      $or: [
        { lastLogin: { $lt: date } },
        { lastLogin: null }
      ],
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  /**
   * البحث النصي
   */
  async search(searchTerm, companyId = null) {
    const searchRegex = new RegExp(searchTerm, 'i');
    const query = {
      deletedAt: null,
      $or: [
        { email: searchRegex },
        { displayName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phoneNumber: searchRegex },
        { bio: searchRegex }
      ]
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.find(query);
  }

  // ============ COUNT METHODS ============

  /**
   * حساب عدد المستخدمين حسب الدور
   */
  async countByRole(role, companyId = null) {
    const query = { role, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.countDocuments(query);
  }

  /**
   * حساب عدد المستخدمين النشطين
   */
  async countActive(companyId = null) {
    const query = { status: 'active', deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.countDocuments(query);
  }

  /**
   * حساب عدد المستخدمين حسب المصنع
   */
  async countByFactory(factoryId, companyId = null) {
    const query = {
      factoryIds: factoryId,
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.countDocuments(query);
  }

  /**
   * حساب عدد المستخدمين حسب القسم
   */
  async countByDepartment(departmentId, companyId = null) {
    const query = {
      departmentIds: departmentId,
      deletedAt: null
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.countDocuments(query);
  }

  // ============ UPDATE METHODS ============

  /**
   * تحديث آخر تسجيل دخول
   */
  async updateLastLogin(userId) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      {
        lastLogin: new Date(),
        $inc: { loginCount: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null
      },
      { new: true }
    );
  }

  /**
   * تحديث آخر نشاط
   */
  async updateLastActive(userId) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { lastActive: new Date() },
      { new: true }
    );
  }

  /**
   * إضافة جلسة جديدة
   */
  async addSessionToken(userId, token) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $addToSet: { sessionTokens: token } },
      { new: true }
    );
  }

  /**
   * إزالة جلسة
   */
  async removeSessionToken(userId, token) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $pull: { sessionTokens: token } },
      { new: true }
    );
  }

  /**
   * إبطال جميع الجلسات
   */
  async revokeAllSessions(userId) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { sessionTokens: [] },
      { new: true }
    );
  }

  /**
   * إضافة مصنع للمستخدم
   */
  async addFactory(userId, factoryId, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { $addToSet: { factoryIds: factoryId } },
      { new: true }
    );
  }

  /**
   * إزالة مصنع من المستخدم
   */
  async removeFactory(userId, factoryId, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { $pull: { factoryIds: factoryId } },
      { new: true }
    );
  }

  /**
   * إضافة قسم للمستخدم
   */
  async addDepartment(userId, departmentId, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { $addToSet: { departmentIds: departmentId } },
      { new: true }
    );
  }

  /**
   * إزالة قسم من المستخدم
   */
  async removeDepartment(userId, departmentId, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { $pull: { departmentIds: departmentId } },
      { new: true }
    );
  }

  /**
   * تحديث الصلاحيات
   */
  async updatePermissions(userId, permissions, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { permissions },
      { new: true }
    );
  }

  /**
   * تحديث الدور
   */
  async updateRole(userId, role, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { role },
      { new: true }
    );
  }

  /**
   * تحديث حالة المستخدم
   */
  async updateStatus(userId, status, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { status },
      { new: true }
    );
  }

  /**
   * تحديث تفضيلات المستخدم
   */
  async updatePreferences(userId, preferences, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.findOneAndUpdate(
      query,
      { preferences },
      { new: true }
    );
  }

  /**
   * تسجيل فشل تسجيل الدخول
   */
  async recordFailedLogin(userId) {
    const user = await this.model.findOne({ _id: userId, deletedAt: null });
    if (!user) return null;
    
    user.failedLoginAttempts += 1;
    
    // قفل الحساب بعد 5 محاولات فاشلة
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة
    }
    
    return user.save();
  }

  /**
   * إعادة تعيين محاولات تسجيل الدخول الفاشلة
   */
  async resetFailedLoginAttempts(userId) {
    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      {
        failedLoginAttempts: 0,
        lockedUntil: null
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  /**
   * إضافة مصنع لعدة مستخدمين
   */
  async bulkAddFactory(userIds, factoryId, companyId = null) {
    const query = { _id: { $in: userIds }, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.updateMany(
      query,
      { $addToSet: { factoryIds: factoryId } }
    );
  }

  /**
   * إزالة مصنع من عدة مستخدمين
   */
  async bulkRemoveFactory(userIds, factoryId, companyId = null) {
    const query = { _id: { $in: userIds }, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.updateMany(
      query,
      { $pull: { factoryIds: factoryId } }
    );
  }

  /**
   * تحديث حالة عدة مستخدمين
   */
  async bulkUpdateStatus(userIds, status, companyId = null) {
    const query = { _id: { $in: userIds }, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.updateMany(
      query,
      { status }
    );
  }

  /**
   * حذف عدة مستخدمين (Soft Delete)
   */
  async bulkSoftDelete(userIds, deletedBy, companyId = null) {
    const query = { _id: { $in: userIds }, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    return this.model.updateMany(
      query,
      {
        deletedAt: new Date(),
        status: 'archived',
        deletedBy
      }
    );
  }

  // ============ AGGREGATION METHODS ============

  /**
   * الحصول على إحصائيات المستخدمين
   */
  async getStats(companyId = null) {
    const match = { deletedAt: null };
    if (companyId) {
      match.companyId = companyId;
    }
    
    const stats = await this.model.aggregate([
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
  }

  /**
   * الحصول على توزيع المستخدمين حسب الدور
   */
  async getRoleDistribution(companyId = null) {
    const match = { deletedAt: null };
    if (companyId) {
      match.companyId = companyId;
    }
    
    return this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * الحصول على توزيع المستخدمين حسب المصنع
   */
  async getFactoryDistribution(companyId = null) {
    const match = { deletedAt: null };
    if (companyId) {
      match.companyId = companyId;
    }
    
    return this.model.aggregate([
      { $match: match },
      { $unwind: '$factoryIds' },
      {
        $group: {
          _id: '$factoryIds',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * الحصول على نشاط المستخدمين
   */
  async getUserActivity(startDate, endDate, companyId = null) {
    const match = { deletedAt: null };
    if (companyId) {
      match.companyId = companyId;
    }
    if (startDate && endDate) {
      match.lastActive = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    return this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$lastActive' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  // ============ VALIDATION METHODS ============

  /**
   * التحقق من وجود مستخدم بالإيميل
   */
  async existsByEmail(email, excludeUserId = null) {
    const query = { email: email.toLowerCase(), deletedAt: null };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }
    const count = await this.model.countDocuments(query);
    return count > 0;
  }

  /**
   * التحقق من وجود مستخدم بـ Firebase UID
   */
  async existsByFirebaseUid(firebaseUid) {
    const count = await this.model.countDocuments({ firebaseUid, deletedAt: null });
    return count > 0;
  }

  // ============ COMPLEX QUERIES ============

  /**
   * الحصول على المستخدمين مع التصفية المتقدمة
   */
  async findWithFilters(filters = {}, companyId = null) {
    const query = { deletedAt: null };
    
    if (companyId) {
      query.companyId = companyId;
    }
    
    // تصفية حسب الحالة
    if (filters.status) {
      query.status = filters.status;
    }
    
    // تصفية حسب الدور
    if (filters.role) {
      query.role = filters.role;
    }
    
    // تصفية حسب المصنع
    if (filters.factoryId) {
      query.factoryIds = filters.factoryId;
    }
    
    // تصفية حسب القسم
    if (filters.departmentId) {
      query.departmentIds = filters.departmentId;
    }
    
    // تصفية حسب التحقق من البريد
    if (filters.emailVerified !== undefined) {
      query.emailVerified = filters.emailVerified;
    }
    
    // تصفية حسب التوثيق الثنائي
    if (filters.twoFactorEnabled !== undefined) {
      query.twoFactorEnabled = filters.twoFactorEnabled;
    }
    
    // بحث نصي
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { email: searchRegex },
        { displayName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex }
      ];
    }
    
    // تصفية حسب التاريخ
    if (filters.fromDate) {
      query.createdAt = { $gte: new Date(filters.fromDate) };
    }
    if (filters.toDate) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.toDate) };
    }
    
    // خيارات الفرز
    const sort = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }
    
    // خيارات الصفحات
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(query)
    ]);
    
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * الحصول على المستخدمين مع البيانات المرتبطة
   */
  async findWithRelations(userId, companyId = null) {
    const query = { _id: userId, deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    
    return this.model.findOne(query)
      .populate('factoryIds', 'name code')
      .populate('departmentIds', 'name code')
      .lean();
  }

  // ============ EXPORT ============

  /**
   * تصدير المستخدمين بتنسيق معين
   */
  async exportUsers(companyId = null, format = 'json') {
    const query = { deletedAt: null };
    if (companyId) {
      query.companyId = companyId;
    }
    
    const users = await this.model.find(query).lean();
    
    if (format === 'csv') {
      return this.convertToCSV(users);
    }
    
    return users;
  }

  /**
   * تحويل المستخدمين إلى CSV
   */
  convertToCSV(users) {
    if (users.length === 0) return '';
    
    const headers = [
      'id', 'email', 'displayName', 'firstName', 'lastName',
      'role', 'status', 'emailVerified', 'phoneNumber',
      'loginCount', 'lastLogin', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const user of users) {
      const row = headers.map(header => {
        let value = user[header] || '';
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = UserRepository; 
