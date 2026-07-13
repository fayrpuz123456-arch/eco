const BaseController = require('../../../core/base/BaseController');
const UserService = require('../services/UserService');
const {
  sendResponse,
  sendError,
  sendPaginatedResponse,
  sendCreated,
  sendDeleted,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError
} = require('../../../core/utils/response');
const { validate } = require('../../../core/middleware/validation');
const {
  createUserSchema,
  updateUserSchema,
  updatePermissionsSchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  idSchema,
  paginationSchema,
  searchSchema,
  generalFilterSchema
} = require('../../../core/middleware/validation');
const { PERMISSIONS, checkPermissions } = require('../../../core/middleware/permissions');
const logger = require('../../../core/utils/logger');

/**
 * متحكم المستخدمين - مسؤول عن معالجة طلبات API المتعلقة بالمستخدمين
 */
class UserController extends BaseController {
  constructor() {
    super(new UserService(), 'User');
    this.service = this.service; // Type cast
  }

  // ============ CREATE ============

  /**
   * إنشاء مستخدم جديد
   * POST /api/v1/users
   */
  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createUser(req.body, user.id, companyId);
      
      // إذا كانت كلمة المرور مؤقتة، نرسلها في الرد
      const responseData = result.temporaryPassword 
        ? { ...result, temporaryPassword: result.temporaryPassword }
        : result;
      
      return sendCreated(res, 'User created successfully', responseData);
    } catch (error) {
      logger.error('Create user error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  /**
   * الحصول على قائمة المستخدمين
   * GET /api/v1/users
   */
  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getUsersPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(
        res,
        'Users retrieved successfully',
        result.data,
        result.meta
      );
    } catch (error) {
      logger.error('Get users list error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على مستخدم بالمعرف
   * GET /api/v1/users/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      
      const result = await this.service.getUserById(id, companyId);
      return sendResponse(res, 200, 'User retrieved successfully', result);
    } catch (error) {
      logger.error('Get user by id error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على الملف الشخصي للمستخدم الحالي
   * GET /api/v1/users/me
   */
  async getProfile(req, res) {
    try {
      const { user, companyId } = req;
      
      const result = await this.service.getUserById(user.id, companyId);
      return sendResponse(res, 200, 'Profile retrieved successfully', result);
    } catch (error) {
      logger.error('Get profile error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على مستخدمين حسب الدور
   * GET /api/v1/users/role/:role
   */
  async getByRole(req, res) {
    try {
      const { role } = req.params;
      const { companyId } = req;
      
      const result = await this.service.getUsersByRole(role, companyId);
      return sendResponse(res, 200, 'Users retrieved successfully', result);
    } catch (error) {
      logger.error('Get users by role error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على مستخدمين حسب المصنع
   * GET /api/v1/users/factory/:factoryId
   */
  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      
      const result = await this.service.getUsersByFactory(factoryId, companyId);
      return sendResponse(res, 200, 'Users retrieved successfully', result);
    } catch (error) {
      logger.error('Get users by factory error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على مستخدمين حسب القسم
   * GET /api/v1/users/department/:departmentId
   */
  async getByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      
      const result = await this.service.getUsersByDepartment(departmentId, companyId);
      return sendResponse(res, 200, 'Users retrieved successfully', result);
    } catch (error) {
      logger.error('Get users by department error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على المستخدمين النشطين
   * GET /api/v1/users/active
   */
  async getActive(req, res) {
    try {
      const { companyId } = req;
      
      const result = await this.service.getActiveUsers(companyId);
      return sendResponse(res, 200, 'Active users retrieved successfully', result);
    } catch (error) {
      logger.error('Get active users error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * البحث عن المستخدمين
   * GET /api/v1/users/search
   */
  async search(req, res) {
    try {
      const { query } = req.query;
      const { companyId } = req;
      
      const result = await this.service.searchUsers(query, companyId);
      return sendResponse(res, 200, 'Users found successfully', result);
    } catch (error) {
      logger.error('Search users error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  /**
   * تحديث مستخدم
   * PUT /api/v1/users/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      
      const result = await this.service.updateUser(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'User updated successfully', result);
    } catch (error) {
      logger.error('Update user error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث الملف الشخصي للمستخدم الحالي
   * PUT /api/v1/users/me
   */
  async updateProfile(req, res) {
    try {
      const { user, companyId } = req;
      
      const result = await this.service.updateProfile(user.id, req.body, companyId);
      return sendResponse(res, 200, 'Profile updated successfully', result);
    } catch (error) {
      logger.error('Update profile error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث دور المستخدم
   * PUT /api/v1/users/:id/role
   */
  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const { companyId, user } = req;
      
      const result = await this.service.updateRole(id, role, user.id, companyId);
      return sendResponse(res, 200, 'User role updated successfully', result);
    } catch (error) {
      logger.error('Update role error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث صلاحيات المستخدم
   * PUT /api/v1/users/:id/permissions
   */
  async updatePermissions(req, res) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      const { companyId, user } = req;
      
      const result = await this.service.updatePermissions(id, permissions, user.id, companyId);
      return sendResponse(res, 200, 'User permissions updated successfully', result);
    } catch (error) {
      logger.error('Update permissions error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث حالة المستخدم
   * PUT /api/v1/users/:id/status
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { companyId, user } = req;
      
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'User status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث تفضيلات المستخدم
   * PUT /api/v1/users/:id/preferences
   */
  async updatePreferences(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      
      const result = await this.service.updatePreferences(id, req.body, companyId);
      return sendResponse(res, 200, 'User preferences updated successfully', result);
    } catch (error) {
      logger.error('Update preferences error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ ASSIGNMENT ============

  /**
   * تعيين مستخدم لمصنع
   * POST /api/v1/users/:id/factories
   */
  async assignToFactory(req, res) {
    try {
      const { id } = req.params;
      const { factoryId } = req.body;
      const { companyId } = req;
      
      const result = await this.service.assignToFactory(id, factoryId, companyId);
      return sendResponse(res, 200, 'User assigned to factory successfully', result);
    } catch (error) {
      logger.error('Assign to factory error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إزالة مستخدم من مصنع
   * DELETE /api/v1/users/:id/factories/:factoryId
   */
  async removeFromFactory(req, res) {
    try {
      const { id, factoryId } = req.params;
      const { companyId } = req;
      
      const result = await this.service.removeFromFactory(id, factoryId, companyId);
      return sendResponse(res, 200, 'User removed from factory successfully', result);
    } catch (error) {
      logger.error('Remove from factory error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تعيين مستخدم لقسم
   * POST /api/v1/users/:id/departments
   */
  async assignToDepartment(req, res) {
    try {
      const { id } = req.params;
      const { departmentId } = req.body;
      const { companyId } = req;
      
      const result = await this.service.assignToDepartment(id, departmentId, companyId);
      return sendResponse(res, 200, 'User assigned to department successfully', result);
    } catch (error) {
      logger.error('Assign to department error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إزالة مستخدم من قسم
   * DELETE /api/v1/users/:id/departments/:departmentId
   */
  async removeFromDepartment(req, res) {
    try {
      const { id, departmentId } = req.params;
      const { companyId } = req;
      
      const result = await this.service.removeFromDepartment(id, departmentId, companyId);
      return sendResponse(res, 200, 'User removed from department successfully', result);
    } catch (error) {
      logger.error('Remove from department error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  /**
   * حذف مستخدم (Soft Delete)
   * DELETE /api/v1/users/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      
      const result = await this.service.deleteUser(id, user.id, companyId, reason);
      return sendDeleted(res, 'User deleted successfully');
    } catch (error) {
      logger.error('Delete user error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * حذف مستخدم نهائياً (Hard Delete)
   * DELETE /api/v1/users/:id/permanent
   */
  async hardDelete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      
      const result = await this.service.hardDeleteUser(id, user.id, companyId);
      return sendDeleted(res, 'User permanently deleted');
    } catch (error) {
      logger.error('Hard delete user error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  /**
   * الحصول على إحصائيات المستخدمين
   * GET /api/v1/users/stats
   */
  async getStats(req, res) {
    try {
      const { companyId } = req;
      
      const stats = await this.service.getStats(companyId);
      return sendResponse(res, 200, 'User statistics retrieved successfully', stats);
    } catch (error) {
      logger.error('Get stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على توزيع المستخدمين حسب الدور
   * GET /api/v1/users/distribution/roles
   */
  async getRoleDistribution(req, res) {
    try {
      const { companyId } = req;
      
      const distribution = await this.service.getRoleDistribution(companyId);
      return sendResponse(res, 200, 'Role distribution retrieved successfully', distribution);
    } catch (error) {
      logger.error('Get role distribution error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  /**
   * تصدير المستخدمين
   * GET /api/v1/users/export
   */
  async export(req, res) {
    try {
      const { companyId } = req;
      const { format = 'json' } = req.query;
      
      const data = await this.service.exportUsers(companyId, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Users exported successfully', data);
    } catch (error) {
      logger.error('Export users error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ ERROR HANDLER ============

  /**
   * معالجة الأخطاء بشكل موحد
   */
  handleError(res, error) {
    switch (error.constructor.name) {
      case 'ValidationError':
        return sendValidationError(res, error.message, error.errors);
      case 'NotFoundError':
        return sendNotFound(res, error.message);
      case 'ConflictError':
        return sendConflict(res, error.message);
      case 'UnauthorizedError':
        return sendUnauthorized(res, error.message);
      case 'ForbiddenError':
        return sendForbidden(res, error.message);
      default:
        return sendError(res, error.statusCode || 500, error.message);
    }
  }
}

// ============ EXPORT ============

module.exports = UserController; 
