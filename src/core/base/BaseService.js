const { ValidationError, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * الخدمة الأساسية - توفر منطق الأعمال المشترك
 */
class BaseService {
  constructor(repository, moduleName) {
    this.repository = repository;
    this.moduleName = moduleName || 'Service';
  }

  // ============ CRUD ============

  /**
   * إنشاء مستند جديد
   */
  async create(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['companyId']);
      
      const doc = await this.repository.create({
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId: companyId || data.companyId
      });
      
      logger.info(`${this.moduleName} created successfully`, {
        id: doc._id,
        userId,
        companyId
      });
      
      return doc;
    } catch (error) {
      logger.error(`Error creating ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * البحث عن مستند بالمعرف
   */
  async findById(id, companyId) {
    try {
      const doc = await this.repository.findById(id, companyId);
      if (!doc) {
        throw new AppError(`${this.moduleName} not found`, 404);
      }
      return doc;
    } catch (error) {
      logger.error(`Error finding ${this.moduleName} by id:`, error);
      throw error;
    }
  }

  /**
   * البحث عن مستند واحد
   */
  async findOne(filter, companyId) {
    try {
      return this.repository.findOne(filter, companyId);
    } catch (error) {
      logger.error(`Error finding ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * البحث عن مستندات
   */
  async findAll(filter, companyId, options = {}) {
    try {
      return this.repository.find(filter, companyId, options);
    } catch (error) {
      logger.error(`Error finding ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * الترقيم (Pagination)
   */
  async paginate(filter, companyId, page = 1, limit = 10, sort = { createdAt: -1 }) {
    try {
      return this.repository.paginate(filter, companyId, page, limit, sort);
    } catch (error) {
      logger.error(`Error paginating ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * عد المستندات
   */
  async count(filter, companyId) {
    try {
      return this.repository.count(filter, companyId);
    } catch (error) {
      logger.error(`Error counting ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * تحديث مستند
   */
  async update(id, data, userId, companyId) {
    try {
      const doc = await this.repository.update(id, {
        ...data,
        updatedBy: userId
      }, companyId);
      
      logger.info(`${this.moduleName} updated successfully`, {
        id: doc._id,
        userId,
        companyId
      });
      
      return doc;
    } catch (error) {
      logger.error(`Error updating ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * حذف ناعم
   */
  async softDelete(id, userId, companyId, reason = null) {
    try {
      const doc = await this.repository.softDelete(id, companyId, userId, reason);
      
      logger.info(`${this.moduleName} deleted successfully`, {
        id: doc._id,
        userId,
        companyId
      });
      
      return doc;
    } catch (error) {
      logger.error(`Error deleting ${this.moduleName}:`, error);
      throw error;
    }
  }

  /**
   * حذف نهائي
   */
  async hardDelete(id, userId, companyId) {
    try {
      const doc = await this.repository.delete(id, companyId);
      
      logger.info(`${this.moduleName} permanently deleted`, {
        id: doc._id,
        userId,
        companyId
      });
      
      return doc;
    } catch (error) {
      logger.error(`Error hard deleting ${this.moduleName}:`, error);
      throw error;
    }
  }

  // ============ VALIDATION ============

  /**
   * التحقق من وجود حقول مطلوبة
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field => {
      const value = this.getNestedValue(data, field);
      return value === undefined || value === null || value === '';
    });
    
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    return true;
  }

  /**
   * الحصول على قيمة متداخلة
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * التحقق من صحة البيانات باستخدام Schema
   */
  validateData(data, schema) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));
      throw new ValidationError('Validation failed', errors);
    }

    return value;
  }

  /**
   * تنظيف البيانات من الحقول غير المرغوب فيها
   */
  sanitizeData(data, allowedFields) {
    const sanitized = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    }
    return sanitized;
  }

  // ============ UTILITY ============

  /**
   * إنشاء معرف فريد
   */
  generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * التحقق من وجود قيمة في مصفوفة
   */
  isValueInArray(value, array) {
    return array && array.includes(value);
  }

  /**
   * إزالة القيم المكررة من مصفوفة
   */
  uniqueArray(array) {
    return [...new Set(array)];
  }

  /**
   * تسجيل خطأ
   */
  logError(message, error, context = {}) {
    logger.error(message, {
      error: error.message,
      stack: error.stack,
      module: this.moduleName,
      ...context
    });
  }

  /**
   * تسجيل نجاح
   */
  logSuccess(message, context = {}) {
    logger.info(message, {
      module: this.moduleName,
      ...context
    });
  }
}

module.exports = BaseService; 
