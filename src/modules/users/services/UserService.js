const BaseService = require('../../../core/base/BaseService');
const UserRepository = require('../repositories/UserRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const firebaseService = require('../../../config/firebase');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');
const { PERMISSIONS, hasPermission } = require('../../../core/middleware/permissions');

/**
 * خدمة المستخدمين - مسؤول عن منطق الأعمال المتعلق بالمستخدمين
 */
class UserService extends BaseService {
  constructor() {
    super(new UserRepository(), 'User');
    this.repository = this.repository; // Type cast
  }

  // ============ CREATE ============

  /**
   * إنشاء مستخدم جديد
   */
  async createUser(data, userId, companyId) {
    try {
      // 1. التحقق من الحقول المطلوبة
      this.validateRequiredFields(data, ['email', 'displayName', 'role']);

      // 2. التحقق من صحة البريد الإلكتروني
      if (!this.isValidEmail(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      // 3. التحقق من عدم وجود مستخدم بنفس البريد
      const existingUser = await this.repository.findByEmail(data.email, companyId);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // 4. إنشاء مستخدم في Firebase
      const password = data.password || this.generateTemporaryPassword();
      const firebaseUser = await firebaseService.createUser(
        data.email,
        password,
        data.displayName
      );

      // 5. تحضير بيانات المستخدم
      const userData = {
        ...data,
        firebaseUid: firebaseUser.uid,
        emailVerified: firebaseUser.emailVerified || false,
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      // إزالة كلمة المرور من البيانات
      delete userData.password;

      // 6. إنشاء المستخدم في قاعدة البيانات
      const user = await this.repository.create(userData);

      // 7. ✅ تحديث Firebase Claims تلقائياً
      try {
        await firebaseService.setCustomClaims(firebaseUser.uid, {
          role: data.role || 'employee',
          companyId: companyId,
          permissions: data.permissions || []
        });
        logger.info('Firebase claims updated for new user', {
          userId: user._id,
          role: data.role || 'employee'
        });
      } catch (claimsError) {
        logger.warn('Failed to set Firebase claims:', claimsError.message);
        // مش مشكلة كبيرة، لأن Auth Middleware هيسحب من MongoDB
      }

      // 8. إرسال حدث
      eventEmitter.emit(EventTypes.USER_CREATED, {
        userId: user._id,
        email: user.email,
        companyId,
        createdBy: userId
      });

      // 9. تسجيل العملية
      logger.info('User created successfully', {
        userId: user._id,
        email: user.email,
        companyId
      });

      // 10. إرجاع المستخدم مع كلمة المرور المؤقتة (إذا كانت جديدة)
      const result = user.toJSON ? user.toJSON() : user;
      if (!data.password) {
        result.temporaryPassword = password;
      }

      return result;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // ============ FIND ============

  /**
   * الحصول على مستخدم بالمعرف
   */
  async getUserById(id, companyId) {
    const user = await this.repository.findById(id, companyId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * الحصول على مستخدم بـ Firebase UID
   */
  async getUserByFirebaseUid(firebaseUid) {
    const user = await this.repository.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * الحصول على مستخدم بالإيميل
   */
  async getUserByEmail(email, companyId) {
    const user = await this.repository.findByEmail(email, companyId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * الحصول على قائمة المستخدمين
   */
  async getUsers(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  /**
   * الحصول على قائمة المستخدمين مع Pagination
   */
  async getUsersPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  /**
   * الحصول على مستخدمين حسب الدور
   */
  async getUsersByRole(role, companyId) {
    return this.repository.findByRole(role, companyId);
  }

  /**
   * الحصول على مستخدمين حسب المصنع
   */
  async getUsersByFactory(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  /**
   * الحصول على مستخدمين حسب القسم
   */
  async getUsersByDepartment(departmentId, companyId) {
    return this.repository.findByDepartment(departmentId, companyId);
  }

  /**
   * الحصول على المستخدمين النشطين
   */
  async getActiveUsers(companyId) {
    return this.repository.findActive(companyId);
  }

  /**
   * البحث عن المستخدمين
   */
  async searchUsers(query, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, companyId);
  }

  /**
   * الحصول على مستخدم مع البيانات المرتبطة
   */
  async getUserWithRelations(id, companyId) {
    const user = await this.repository.findWithRelations(id, companyId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  // ============ UPDATE ============

  /**
   * تحديث مستخدم
   */
  async updateUser(id, data, userId, companyId) {
    try {
      // 1. التحقق من وجود المستخدم
      const existingUser = await this.repository.findById(id, companyId);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      // 2. التحقق من الصلاحيات
      if (!this.canManageUser(userId, existingUser, companyId)) {
        throw new ForbiddenError('You do not have permission to update this user');
      }

      // 3. الحقول المسموح بتحديثها
      const allowedUpdates = [
        'displayName', 'firstName', 'lastName', 'profilePicture',
        'phoneNumber', 'bio', 'preferences', 'emailVerified',
        'status', 'role', 'permissions', 'firebaseUid'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      // 4. تحديث البريد الإلكتروني في Firebase (إذا تغير)
      if (data.email && data.email !== existingUser.email) {
        if (!this.isValidEmail(data.email)) {
          throw new ValidationError('Invalid email format');
        }
        
        // التحقق من عدم وجود مستخدم آخر بنفس البريد
        const emailExists = await this.repository.existsByEmail(data.email, id);
        if (emailExists) {
          throw new ConflictError('Email already in use');
        }
        
        await firebaseService.updateUser(existingUser.firebaseUid, { email: data.email });
        updateData.email = data.email;
      }

      // 5. تحديث الاسم في Firebase (إذا تغير)
      if (data.displayName && data.displayName !== existingUser.displayName) {
        await firebaseService.updateUser(existingUser.firebaseUid, {
          displayName: data.displayName
        });
      }

      // 6. إضافة المستخدم الحالي كمحرر
      updateData.updatedBy = userId;

      // 7. تحديث المستخدم
      const updatedUser = await this.repository.update(id, updateData, companyId);

      // 8. ✅ تحديث Firebase Claims إذا تغير الـ Role أو الـ Permissions
      if (data.role || data.permissions) {
        try {
          await firebaseService.setCustomClaims(updatedUser.firebaseUid, {
            role: updatedUser.role || existingUser.role,
            companyId: updatedUser.companyId || existingUser.companyId,
            factoryIds: updatedUser.factoryIds || existingUser.factoryIds || [],
            departmentIds: updatedUser.departmentIds || existingUser.departmentIds || [],
            permissions: updatedUser.permissions || existingUser.permissions || []
          });
          logger.info('Firebase claims updated for user', {
            userId: id,
            role: updatedUser.role || existingUser.role
          });
        } catch (claimsError) {
          logger.warn('Failed to update Firebase claims:', claimsError.message);
        }
      }

      // 9. إرسال حدث
      eventEmitter.emit(EventTypes.USER_UPDATED, {
        userId: updatedUser._id,
        email: updatedUser.email,
        companyId,
        updatedBy: userId
      });

      // 10. تسجيل العملية
      logger.info('User updated successfully', {
        userId: updatedUser._id,
        email: updatedUser.email,
        companyId,
        updatedBy: userId
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * تحديث الملف الشخصي للمستخدم الحالي
   */
  async updateProfile(id, data, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // الحقول المسموح بتحديثها في الملف الشخصي
      const allowedUpdates = [
        'displayName', 'firstName', 'lastName', 'profilePicture',
        'phoneNumber', 'bio', 'preferences'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      // تحديث الاسم في Firebase (إذا تغير)
      if (data.displayName && data.displayName !== user.displayName) {
        await firebaseService.updateUser(user.firebaseUid, {
          displayName: data.displayName
        });
      }

      updateData.updatedBy = id;

      const updatedUser = await this.repository.update(id, updateData, companyId);

      logger.info('Profile updated successfully', {
        userId: updatedUser._id,
        email: updatedUser.email
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * تحديث الدور
   */
  async updateRole(id, role, userId, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من الصلاحيات
      if (userId !== 'system' && !this.canManageUser(userId, user, companyId)) {
        throw new ForbiddenError('You do not have permission to change this user\'s role');
      }

      // لا يمكن تغيير دور Super Admin
      if (user.role === 'super_admin') {
        throw new ForbiddenError('Cannot change Super Admin role');
      }

      const updatedUser = await this.repository.updateRole(id, role, companyId);

      // ✅ تحديث الصلاحيات المخصصة في Firebase
      try {
        await firebaseService.setCustomClaims(user.firebaseUid, {
          role,
          companyId: user.companyId,
          factoryIds: user.factoryIds || [],
          departmentIds: user.departmentIds || [],
          permissions: user.permissions || []
        });
        logger.info('Firebase claims updated for role change', {
          userId: id,
          oldRole: user.role,
          newRole: role
        });
      } catch (claimsError) {
        logger.warn('Failed to update Firebase claims for role:', claimsError.message);
        // مش مشكلة كبيرة، لأن Auth Middleware هيسحب من MongoDB
      }

      logger.info('User role updated', {
        userId: id,
        oldRole: user.role,
        newRole: role,
        updatedBy: userId
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * تحديث الصلاحيات
   */
  async updatePermissions(id, permissions, userId, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من الصلاحيات
      if (userId !== 'system' && !this.canManageUser(userId, user, companyId)) {
        throw new ForbiddenError('You do not have permission to change this user\'s permissions');
      }

      // Super Admin لا يمكن تغيير صلاحياته
      if (user.role === 'super_admin') {
        throw new ForbiddenError('Cannot change Super Admin permissions');
      }

      const updatedUser = await this.repository.updatePermissions(id, permissions, companyId);

      // ✅ تحديث الصلاحيات في Firebase
      try {
        await firebaseService.setCustomClaims(user.firebaseUid, {
          role: user.role,
          companyId: user.companyId,
          factoryIds: user.factoryIds || [],
          departmentIds: user.departmentIds || [],
          permissions
        });
        logger.info('Firebase claims updated for permissions', {
          userId: id,
          permissionsCount: permissions.length
        });
      } catch (claimsError) {
        logger.warn('Failed to update Firebase claims for permissions:', claimsError.message);
      }

      logger.info('User permissions updated', {
        userId: id,
        permissions,
        updatedBy: userId
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating permissions:', error);
      throw error;
    }
  }

  /**
   * تحديث حالة المستخدم
   */
  async updateStatus(id, status, userId, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من الصلاحيات
      if (userId !== 'system' && !this.canManageUser(userId, user, companyId)) {
        throw new ForbiddenError('You do not have permission to change this user\'s status');
      }

      // لا يمكن تغيير حالة Super Admin
      if (user.role === 'super_admin') {
        throw new ForbiddenError('Cannot change Super Admin status');
      }

      const updatedUser = await this.repository.updateStatus(id, status, companyId);

      logger.info('User status updated', {
        userId: id,
        oldStatus: user.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  /**
   * تحديث تفضيلات المستخدم
   */
  async updatePreferences(id, preferences, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // دمج التفضيلات الجديدة مع القديمة
      const mergedPreferences = {
        ...user.preferences,
        ...preferences
      };

      return this.repository.updatePreferences(id, mergedPreferences, companyId);
    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  /**
   * حذف مستخدم (Soft Delete)
   */
  async deleteUser(id, userId, companyId, reason = null) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من الصلاحيات
      if (userId !== 'system' && !this.canManageUser(userId, user, companyId)) {
        throw new ForbiddenError('You do not have permission to delete this user');
      }

      // لا يمكن حذف Super Admin
      if (user.role === 'super_admin') {
        throw new ForbiddenError('Cannot delete Super Admin');
      }

      // لا يمكن حذف نفسه
      if (id === userId) {
        throw new ForbiddenError('Cannot delete your own account');
      }

      // حذف من Firebase
      await firebaseService.deleteUser(user.firebaseUid);

      // حذف من قاعدة البيانات (Soft Delete)
      const deletedUser = await this.repository.softDelete(id, companyId);

      // إضافة سبب الحذف
      if (reason) {
        deletedUser.deletedReason = reason;
        deletedUser.deletedBy = userId;
        await deletedUser.save();
      }

      // إرسال حدث
      eventEmitter.emit(EventTypes.USER_DELETED, {
        userId: id,
        email: user.email,
        companyId,
        deletedBy: userId
      });

      logger.info('User deleted successfully', {
        userId: id,
        email: user.email,
        companyId,
        deletedBy: userId,
        reason
      });

      return { message: 'User deleted successfully' };
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * حذف مستخدم نهائياً (Hard Delete)
   */
  async hardDeleteUser(id, userId, companyId) {
    try {
      const user = await this.repository.findById(id, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من الصلاحيات
      if (userId !== 'system' && !this.canManageUser(userId, user, companyId)) {
        throw new ForbiddenError('You do not have permission to delete this user');
      }

      // لا يمكن حذف Super Admin
      if (user.role === 'super_admin') {
        throw new ForbiddenError('Cannot delete Super Admin');
      }

      // لا يمكن حذف نفسه
      if (id === userId) {
        throw new ForbiddenError('Cannot delete your own account');
      }

      // حذف من Firebase
      await firebaseService.deleteUser(user.firebaseUid);

      // حذف من قاعدة البيانات نهائياً
      await this.repository.delete(id, companyId);

      logger.info('User hard deleted', {
        userId: id,
        email: user.email,
        deletedBy: userId
      });

      return { message: 'User permanently deleted' };
    } catch (error) {
      logger.error('Error hard deleting user:', error);
      throw error;
    }
  }

  // ============ ASSIGNMENT ============

  /**
   * تعيين مستخدم لمصنع
   */
  async assignToFactory(userId, factoryId, companyId) {
    try {
      const user = await this.repository.findById(userId, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return this.repository.addFactory(userId, factoryId, companyId);
    } catch (error) {
      logger.error('Error assigning to factory:', error);
      throw error;
    }
  }

  /**
   * إزالة مستخدم من مصنع
   */
  async removeFromFactory(userId, factoryId, companyId) {
    try {
      const user = await this.repository.findById(userId, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return this.repository.removeFactory(userId, factoryId, companyId);
    } catch (error) {
      logger.error('Error removing from factory:', error);
      throw error;
    }
  }

  /**
   * تعيين مستخدم لقسم
   */
  async assignToDepartment(userId, departmentId, companyId) {
    try {
      const user = await this.repository.findById(userId, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return this.repository.addDepartment(userId, departmentId, companyId);
    } catch (error) {
      logger.error('Error assigning to department:', error);
      throw error;
    }
  }

  /**
   * إزالة مستخدم من قسم
   */
  async removeFromDepartment(userId, departmentId, companyId) {
    try {
      const user = await this.repository.findById(userId, companyId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return this.repository.removeDepartment(userId, departmentId, companyId);
    } catch (error) {
      logger.error('Error removing from department:', error);
      throw error;
    }
  }

  // ============ AUTHENTICATION ============

  /**
   * تسجيل دخول المستخدم
   */
  async recordLogin(userId, ip, userAgent, deviceInfo = {}) {
    try {
      const user = await this.repository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // التحقق من قفل الحساب
      if (user.isLocked) {
        throw new ForbiddenError('Account is locked. Please try again later.');
      }

      // تحديث بيانات تسجيل الدخول
      return this.repository.updateLastLogin(userId, ip, userAgent, deviceInfo);
    } catch (error) {
      logger.error('Error recording login:', error);
      throw error;
    }
  }

  /**
   * تسجيل فشل تسجيل الدخول
   */
  async recordFailedLogin(email, companyId) {
    try {
      const user = await this.repository.findByEmail(email, companyId);
      if (!user) {
        return null;
      }

      return this.repository.recordFailedLogin(user._id);
    } catch (error) {
      logger.error('Error recording failed login:', error);
      throw error;
    }
  }

  /**
   * مزامنة مستخدم مع Firebase
   */
  async syncFirebaseUser(firebaseUid, companyId) {
    try {
      const firebaseUser = await firebaseService.getUser(firebaseUid);
      const user = await this.repository.findByFirebaseUid(firebaseUid);

      if (!user) {
        // إنشاء مستخدم جديد
        const userData = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email,
          firebaseUid: firebaseUser.uid,
          emailVerified: firebaseUser.emailVerified || false,
          companyId,
          role: 'employee'
        };

        return this.repository.create(userData);
      }

      // تحديث البيانات إذا تغيرت
      const updates = {};
      if (firebaseUser.email !== user.email) updates.email = firebaseUser.email;
      if (firebaseUser.displayName !== user.displayName) updates.displayName = firebaseUser.displayName;
      if (firebaseUser.emailVerified !== user.emailVerified) updates.emailVerified = firebaseUser.emailVerified;

      if (Object.keys(updates).length > 0) {
        return this.repository.update(user._id, updates, companyId);
      }

      return user;
    } catch (error) {
      logger.error('Error syncing Firebase user:', error);
      throw error;
    }
  }

  // ============ VALIDATION ============

  /**
   * التحقق من صحة البريد الإلكتروني
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * التحقق من صلاحية إدارة مستخدم
   */
  canManageUser(managerId, targetUser, companyId) {
    // إذا كان المدير هو نفسه المستخدم
    if (managerId === targetUser._id) return true;

    // التحقق من وجود المستخدم المدير
    // TODO: الحصول على المستخدم المدير من قاعدة البيانات
    // هنا نفترض أن المدير لديه صلاحيات كافية
    
    // يمكن إضافة منطق أكثر تعقيداً هنا
    return true;
  }

  /**
   * التحقق من صحة المستخدم
   */
  async validateUser(userId, companyId) {
    const user = await this.repository.findById(userId, companyId);
    if (!user || user.status !== 'active' || user.deletedAt) {
      throw new ForbiddenError('User not found or inactive');
    }
    return user;
  }

  // ============ HELPERS ============

  /**
   * إنشاء كلمة مرور مؤقتة
   */
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * الحصول على إحصائيات المستخدمين
   */
  async getStats(companyId) {
    return this.repository.getStats(companyId);
  }

  /**
   * الحصول على توزيع المستخدمين حسب الدور
   */
  async getRoleDistribution(companyId) {
    return this.repository.getRoleDistribution(companyId);
  }

  /**
   * الحصول على عدد المستخدمين
   */
  async getUserCount(companyId, filter = {}) {
    return this.repository.count(filter, companyId);
  }

  /**
   * تصدير المستخدمين
   */
  async exportUsers(companyId, format = 'json') {
    return this.repository.exportUsers(companyId, format);
  }
}

module.exports = UserService;