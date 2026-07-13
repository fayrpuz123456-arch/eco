 
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

// ============ TENANT MIDDLEWARE ============

/**
 * Tenant Middleware - لعزل البيانات بين الشركات
 * @param {boolean} required - هل الـ Tenant مطلوب أم اختياري
 */
const tenantMiddleware = (required = true) => {
  return async (req, res, next) => {
    try {
      // 1. الحصول على companyId من مصادر مختلفة
      const companyId = req.headers['x-company-id'] || 
                        req.headers['company-id'] ||
                        req.headers['x-tenant-id'] ||
                        req.headers['tenant-id'] ||
                        req.query.companyId ||
                        req.query.company_id ||
                        req.body.companyId ||
                        req.body.company_id ||
                        req.params.companyId ||
                        req.params.company_id ||
                        req.user?.claims?.companyId ||
                        req.companyId ||
                        null;

      // 2. التحقق من وجود companyId إذا كان مطلوباً
      if (!companyId && required) {
        logger.warn('Tenant context missing', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          headers: req.headers,
          user: req.user?.id
        });
        
        return sendError(res, 400, 'Company ID is required. Please provide x-company-id header.');
      }

      // 3. إذا لم يكن مطلوباً ولا يوجد companyId، نمرر بدون Tenant
      if (!companyId && !required) {
        req.tenant = {
          companyId: null,
          isRequired: false,
          isIsolated: false
        };
        return next();
      }

      // 4. إضافة Tenant Context إلى الـ Request
      req.tenant = {
        companyId: companyId,
        isRequired: required,
        isIsolated: true
      };

      // 5. إضافة companyId للـ Request للاستخدام السهل
      req.companyId = companyId;

      // 6. إضافة دوال مساعدة لتصفية البيانات
      req.addCompanyFilter = (query = {}) => {
        if (companyId) {
          return { ...query, companyId };
        }
        return query;
      };

      req.addTenantFilter = (query = {}) => {
        if (companyId) {
          return { ...query, companyId };
        }
        return query;
      };

      // 7. إضافة دالة للتحقق من الوصول للشركة
      req.validateCompanyAccess = (targetCompanyId) => {
        if (!companyId) {
          throw new Error('No tenant context available');
        }
        if (companyId !== targetCompanyId) {
          throw new Error('Access denied: Company ID mismatch');
        }
        return true;
      };

      // 8. تسجيل الـ Tenant Context
      logger.debug('Tenant context set', {
        companyId,
        required,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });

      next();

    } catch (error) {
      logger.error('Tenant middleware error', error, {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      return sendError(res, 500, 'Tenant context error. Please try again later.');
    }
  };
};

// ============ TENANT ISOLATION DECORATOR ============

/**
 * Decorator لتأكيد عزل البيانات في الخدمات
 * @param {Function} serviceMethod - دالة الخدمة
 */
const ensureTenantIsolation = (serviceMethod) => {
  return async function(...args) {
    const lastArg = args[args.length - 1];
    
    if (typeof lastArg === 'object' && lastArg !== null) {
      const { companyId, ...rest } = lastArg;
      
      if (!companyId) {
        throw new Error('Company ID required for tenant isolation');
      }
      
      return serviceMethod.apply(this, [...args.slice(0, -1), { companyId, ...rest }]);
    }
    
    return serviceMethod.apply(this, args);
  };
};

// ============ TENANT VALIDATION ============

/**
 * التحقق من صحة الـ Tenant
 * @param {string} companyId - معرف الشركة
 * @param {object} req - Request object
 */
const validateTenant = async (companyId, req) => {
  try {
    // 1. التحقق من وجود companyId
    if (!companyId) {
      return { valid: false, error: 'Company ID is required' };
    }

    // 2. التحقق من أن المستخدم لديه حق الوصول لهذه الشركة
    if (req.user) {
      const userCompanyId = req.user.claims?.companyId || req.companyId;
      const userRole = req.user.claims?.role || 'viewer';
      
      // الإداري يمكنه الوصول لكل الشركات
      if (userRole === 'admin' || userRole === 'super_admin') {
        return { valid: true, companyId };
      }
      
      // التحقق من تطابق الشركة
      if (userCompanyId && userCompanyId !== companyId) {
        logger.warn('Tenant validation failed - company mismatch', {
          userId: req.user.id,
          userCompanyId,
          requestedCompanyId: companyId,
          path: req.path
        });
        
        return { 
          valid: false, 
          error: 'Access denied: You do not have permission to access this company\'s data' 
        };
      }
    }

    // 3. TODO: التحقق من وجود الشركة في قاعدة البيانات
    // const company = await companyService.getCompanyById(companyId);
    // if (!company) {
    //   return { valid: false, error: 'Company not found' };
    // }

    return { valid: true, companyId };
    
  } catch (error) {
    logger.error('Tenant validation error', error);
    return { valid: false, error: 'Tenant validation failed' };
  }
};

// ============ TENANT FILTER HELPERS ============

/**
 * إنشاء فلتر للـ Tenant
 * @param {string} companyId - معرف الشركة
 * @param {object} additionalFilters - فلاتر إضافية
 */
const createTenantFilter = (companyId, additionalFilters = {}) => {
  if (!companyId) {
    throw new Error('Company ID is required to create tenant filter');
  }
  
  return {
    companyId,
    ...additionalFilters
  };
};

/**
 * إضافة فلتر Tenant إلى Query
 * @param {object} query - Query object
 * @param {string} companyId - معرف الشركة
 */
const addTenantFilterToQuery = (query, companyId) => {
  if (!companyId) {
    throw new Error('Company ID is required to add tenant filter');
  }
  
  return {
    ...query,
    companyId
  };
};

/**
 * التحقق من وجود Tenant في Query
 * @param {object} query - Query object
 */
const hasTenantFilter = (query) => {
  return !!(query && query.companyId);
};

// ============ TENANT CONTEXT HELPER ============

/**
 * الحصول على Tenant Context من الـ Request
 * @param {object} req - Request object
 */
const getTenantContext = (req) => {
  return {
    companyId: req.companyId || req.tenant?.companyId || null,
    isRequired: req.tenant?.isRequired || false,
    isIsolated: req.tenant?.isIsolated || false
  };
};

/**
 * التحقق من وجود Tenant Context
 * @param {object} req - Request object
 */
const hasTenantContext = (req) => {
  return !!(req.companyId || req.tenant?.companyId);
};

// ============ MULTI-TENANT QUERY BUILDER ============

/**
 * بناء Query متعدد المستأجرين
 * @param {string} companyId - معرف الشركة
 * @param {object} query - Query
 * @param {boolean} strict - وضع صارم
 */
const buildMultiTenantQuery = (companyId, query = {}, strict = true) => {
  if (!companyId && strict) {
    throw new Error('Company ID is required for multi-tenant query');
  }
  
  if (!companyId) {
    return query;
  }
  
  return {
    ...query,
    companyId
  };
};

/**
 * تطبيق Tenant Filter على Aggregation Pipeline
 * @param {array} pipeline - Aggregation pipeline
 * @param {string} companyId - معرف الشركة
 * @param {string} field - اسم الحقل (افتراضي: companyId)
 */
const applyTenantFilterToPipeline = (pipeline, companyId, field = 'companyId') => {
  if (!companyId) {
    throw new Error('Company ID is required for tenant filter');
  }
  
  return [
    { $match: { [field]: companyId } },
    ...pipeline
  ];
};

// ============ TENANT ISOLATION MIDDLEWARE ============

/**
 * Middleware لتأكيد عزل البيانات
 * يتحقق من أن جميع الاستعلامات تحتوي على companyId
 */
const enforceTenantIsolation = (req, res, next) => {
  try {
    if (!req.companyId && req.tenant?.isRequired) {
      logger.warn('Tenant isolation violation', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        user: req.user?.id
      });
      
      return sendError(res, 403, 'Tenant isolation violated. Company ID is required.');
    }
    
    next();
  } catch (error) {
    logger.error('Tenant isolation middleware error', error);
    return sendError(res, 500, 'Tenant isolation error');
  }
};

// ============ TENANT LOGGING ============

/**
 * تسجيل نشاط الـ Tenant
 * @param {object} req - Request object
 * @param {string} action - الإجراء
 * @param {object} data - بيانات إضافية
 */
const logTenantActivity = (req, action, data = {}) => {
  const tenantContext = getTenantContext(req);
  
  logger.info(`Tenant activity: ${action}`, {
    companyId: tenantContext.companyId,
    userId: req.user?.id,
    ip: req.ip,
    path: req.path,
    method: req.method,
    ...data
  });
};

// ============ EXPORT ============

module.exports = {
  // Main middleware
  tenantMiddleware,
  enforceTenantIsolation,
  
  // Decorator
  ensureTenantIsolation,
  
  // Validation
  validateTenant,
  
  // Helpers
  createTenantFilter,
  addTenantFilterToQuery,
  hasTenantFilter,
  getTenantContext,
  hasTenantContext,
  
  // Query builders
  buildMultiTenantQuery,
  applyTenantFilterToPipeline,
  
  // Logging
  logTenantActivity
};