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
  sendValidationError,
  sendServerError
} = require('../utils/response');

/**
 * المتحكم الأساسي - يوفر معالجة مشتركة للطلبات
 */
class BaseController {
  constructor(service, moduleName) {
    this.service = service;
    this.moduleName = moduleName || 'Controller';
  }

  // ============ CRUD ============

  /**
   * إنشاء مستند جديد
   * POST /api/v1/:resource
   */
  async create(req, res) {
    try {
      const { user, companyId } = req;
      const result = await this.service.create(req.body, user?.id, companyId);
      return sendCreated(res, `${this.moduleName} created successfully`, result);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على مستند بالمعرف
   * GET /api/v1/:resource/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.findById(id, companyId);
      return sendResponse(res, 200, `${this.moduleName} retrieved successfully`, result);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على قائمة المستندات
   * GET /api/v1/:resource
   */
  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, sort, ...filter } = req.query;
      
      const result = await this.service.paginate(
        filter,
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        sort || { createdAt: -1 }
      );
      
      return sendPaginatedResponse(
        res,
        `${this.moduleName} retrieved successfully`,
        result.data,
        result.meta
      );
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث مستند
   * PUT /api/v1/:resource/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.update(id, req.body, user?.id, companyId);
      return sendResponse(res, 200, `${this.moduleName} updated successfully`, result);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  /**
   * حذف مستند
   * DELETE /api/v1/:resource/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const { reason } = req.body;
      const result = await this.service.softDelete(id, user?.id, companyId, reason);
      return sendDeleted(res, `${this.moduleName} deleted successfully`);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // ============ VALIDATION ============

  /**
   * التحقق من صحة الطلب
   */
  validateRequest(req, schema, property = 'body') {
    try {
      return this.service.validateData(req[property], schema);
    } catch (error) {
      return null;
    }
  }

  // ============ ERROR HANDLING ============

  /**
   * معالجة الأخطاء بشكل موحد
   */
  handleError(res, error) {
    const statusCode = error.statusCode || 500;
    
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
      
      case 'BadRequestError':
        return sendError(res, 400, error.message);
      
      default:
        // لا نعرض تفاصيل الخطأ في بيئة الإنتاج
        if (process.env.NODE_ENV === 'production' && statusCode === 500) {
          return sendServerError(res, 'Internal server error');
        }
        return sendServerError(res, error.message, error.stack);
    }
  }

  // ============ RESPONSE HELPERS ============

  /**
   * إرسال رد نجاح
   */
  sendSuccess(res, data, message = null) {
    return sendResponse(
      res,
      200,
      message || `${this.moduleName} operation successful`,
      data
    );
  }

  /**
   * إرسال رد إنشاء
   */
  sendCreated(res, data, message = null) {
    return sendCreated(
      res,
      message || `${this.moduleName} created successfully`,
      data
    );
  }

  /**
   * إرسال رد حذف
   */
  sendDeleted(res, message = null) {
    return sendDeleted(
      res,
      message || `${this.moduleName} deleted successfully`
    );
  }

  /**
   * إرسال رد Paginated
   */
  sendPaginated(res, data, meta, message = null) {
    return sendPaginatedResponse(
      res,
      message || `${this.moduleName} retrieved successfully`,
      data,
      meta
    );
  }

  /**
   * إرسال رد خطأ
   */
  sendError(res, statusCode, message, errors = null) {
    return sendError(res, statusCode, message, errors);
  }
}

module.exports = BaseController; 
