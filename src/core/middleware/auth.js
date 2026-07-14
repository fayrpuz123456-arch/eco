const firebaseService = require('../../config/firebase');
const { sendError, sendUnauthorized } = require('../utils/response');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');
const User = require('../../modules/users/models/User.model'); // ✅ استيراد User Model

// ============ MAIN AUTH MIDDLEWARE ============

/**
 * التحقق من المصادقة - يتحقق من صحة التوكن
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. التحقق من وجود التوكن في الـ Header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return sendUnauthorized(res, 'Authentication required. Please provide a valid token.');
    }

    // 2. استخراج التوكن
    const token = authHeader.split('Bearer ')[1];
    
    if (!token || token.length < 10) {
      logger.warn('Authentication failed: Invalid token format', {
        ip: req.ip,
        path: req.path
      });
      return sendUnauthorized(res, 'Invalid token format.');
    }

    // 3. التحقق من التوكن مع Firebase
    try {
      const decodedToken = await firebaseService.verifyToken(token);
      
      // 4. الحصول على معلومات المستخدم من Firebase
      const firebaseUser = await firebaseService.getUser(decodedToken.uid);
      
      // 🔥 **الجديد: جيب المستخدم من MongoDB**
      let userFromDB = null;
      try {
        userFromDB = await User.findOne({ firebaseUid: decodedToken.uid });
      } catch (dbError) {
        logger.warn('Could not fetch user from MongoDB:', dbError.message);
      }

      // 5. بناء كائن المستخدم
      req.user = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
        emailVerified: firebaseUser.emailVerified || false,
        phoneNumber: firebaseUser.phoneNumber || null,
        photoURL: firebaseUser.photoURL || null,
        // ✅ الأولوية: MongoDB Role > Firebase Claims > default
        role: userFromDB?.role || decodedToken.claims?.role || 'viewer',
        permissions: userFromDB?.permissions || decodedToken.claims?.permissions || [],
        claims: decodedToken.claims || {},
        metadata: {
          lastSignInTime: firebaseUser.metadata?.lastSignInTime || null,
          creationTime: firebaseUser.metadata?.creationTime || null
        },
        // ✅ إضافة data من MongoDB
        mongoData: userFromDB || null
      };

      // 6. استخراج companyId
      req.companyId = req.headers['x-company-id'] || 
                      decodedToken.claims?.companyId || 
                      userFromDB?.companyId ||
                      null;

      // 7. تسجيل نجاح المصادقة
      logger.debug('User authenticated successfully', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        companyId: req.companyId,
        ip: req.ip,
        path: req.path
      });

      next();
      
    } catch (firebaseError) {
      // معالجة أخطاء Firebase
      logger.warn('Firebase authentication failed', {
        error: firebaseError.message,
        code: firebaseError.code,
        ip: req.ip,
        path: req.path
      });

      if (firebaseError.code === 'auth/id-token-expired') {
        return sendUnauthorized(res, 'Your session has expired. Please login again.');
      }
      
      if (firebaseError.code === 'auth/user-not-found') {
        return sendUnauthorized(res, 'User not found. Please check your credentials.');
      }
      
      return sendUnauthorized(res, 'Authentication failed. Invalid or expired token.');
    }

  } catch (error) {
    // معالجة الأخطاء غير المتوقعة
    logger.error('Authentication middleware error', error, {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return sendError(res, 500, 'Authentication error. Please try again later.');
  }
};

// ============ OPTIONAL AUTH MIDDLEWARE ============

/**
 * مصادقة اختيارية - تسمح بالوصول حتى بدون توكن
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await firebaseService.verifyToken(token);
        const firebaseUser = await firebaseService.getUser(decodedToken.uid);
        
        // 🔥 جيب المستخدم من MongoDB (اختياري)
        let userFromDB = null;
        try {
          userFromDB = await User.findOne({ firebaseUid: decodedToken.uid });
        } catch (dbError) {
          // تجاهل
        }
        
        req.user = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email,
          role: userFromDB?.role || decodedToken.claims?.role || 'viewer',
          permissions: userFromDB?.permissions || decodedToken.claims?.permissions || [],
          claims: decodedToken.claims || {},
          mongoData: userFromDB || null
        };
        
        req.companyId = req.headers['x-company-id'] || 
                        decodedToken.claims?.companyId || 
                        userFromDB?.companyId ||
                        null;
        
        logger.debug('Optional auth: User authenticated', {
          userId: req.user.id,
          email: req.user.email,
          role: req.user.role
        });
      } catch (error) {
        // تجاهل أخطاء التوكن في المصادقة الاختيارية
        logger.debug('Optional auth: Token validation failed', {
          error: error.message
        });
      }
    }
    
    next();
  } catch (error) {
    // في حالة الخطأ، نواصل بدون مصادقة
    logger.warn('Optional auth middleware error', { error: error.message });
    next();
  }
};

// ============ PERMISSION MIDDLEWARE ============

/**
 * التحقق من الصلاحيات (Permissions)
 */
const checkPermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      // التأكد من وجود مستخدم
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required to check permissions.');
      }

      // إذا كانت الصلاحيات المطلوبة فارغة، نسمح بالمرور
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }

      // ✅ الحصول على صلاحيات المستخدم من MongoDB أو Firebase Claims
      const userPermissions = req.user.permissions || req.user.claims?.permissions || [];
      const userRole = req.user.role || req.user.claims?.role || 'viewer';

      // التحقق من صلاحيات الإداري
      if (userRole === 'admin' || userRole === 'super_admin') {
        return next();
      }

      // التحقق من الصلاحيات المطلوبة
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.warn('Permission denied', {
          userId: req.user.id,
          userRole,
          requiredPermissions,
          userPermissions,
          path: req.path,
          method: req.method
        });
        
        return sendError(res, 403, 'Insufficient permissions to access this resource.', {
          required: requiredPermissions,
          missing: requiredPermissions.filter(p => !userPermissions.includes(p)),
          role: userRole
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error', error);
      return sendError(res, 500, 'Error checking permissions.');
    }
  };
};

// ============ ROLE MIDDLEWARE ============

/**
 * التحقق من الدور (Role)
 */
const checkRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required.');
      }

      // ✅ الحصول على الدور من MongoDB أو Firebase Claims
      const userRole = req.user.role || req.user.claims?.role || 'viewer';

      if (allowedRoles.includes(userRole)) {
        return next();
      }

      logger.warn('Role access denied', {
        userId: req.user.id,
        userRole,
        allowedRoles,
        path: req.path
      });

      return sendError(res, 403, `Access denied. Required roles: ${allowedRoles.join(', ')}`);
    } catch (error) {
      logger.error('Role check error', error);
      return sendError(res, 500, 'Error checking role.');
    }
  };
};

// ============ COMPANY ACCESS MIDDLEWARE ============

/**
 * التحقق من الوصول للشركة
 */
const checkCompanyAccess = (getCompanyIdFromParams = true) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required.');
      }

      // الحصول على companyId من الـ Request
      let targetCompanyId = req.companyId;
      
      if (getCompanyIdFromParams) {
        targetCompanyId = req.params.companyId || 
                          req.params.company_id || 
                          req.body.companyId || 
                          req.query.companyId || 
                          req.companyId;
      }

      // التحقق من وجود companyId
      if (!targetCompanyId) {
        return sendError(res, 400, 'Company ID is required.');
      }

      // ✅ الحصول على companyId من MongoDB أو Firebase Claims
      const userCompanyId = req.companyId || req.user.claims?.companyId || req.user.mongoData?.companyId;
      const userRole = req.user.role || req.user.claims?.role || 'viewer';

      // الإداري يمكنه الوصول لكل الشركات
      if (userRole === 'admin' || userRole === 'super_admin') {
        req.targetCompanyId = targetCompanyId;
        return next();
      }

      // التحقق من أن المستخدم يتبع نفس الشركة
      if (userCompanyId && userCompanyId !== targetCompanyId) {
        logger.warn('Company access denied', {
          userId: req.user.id,
          userCompanyId,
          targetCompanyId,
          path: req.path
        });
        
        return sendError(res, 403, 'Access denied. You do not have permission to access this company\'s data.');
      }

      req.targetCompanyId = targetCompanyId;
      next();
    } catch (error) {
      logger.error('Company access check error', error);
      return sendError(res, 500, 'Error checking company access.');
    }
  };
};

// ============ FACTORY ACCESS MIDDLEWARE ============

/**
 * التحقق من الوصول للمصنع
 */
const checkFactoryAccess = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required.');
      }

      const factoryId = req.params.factoryId || 
                        req.params.factory_id || 
                        req.body.factoryId || 
                        req.query.factoryId;

      if (!factoryId) {
        return next(); // لا يوجد مصنع محدد، نسمح بالمرور
      }

      const userRole = req.user.role || req.user.claims?.role || 'viewer';
      
      // الإداري يمكنه الوصول لكل المصانع
      if (userRole === 'admin' || userRole === 'super_admin') {
        req.targetFactoryId = factoryId;
        return next();
      }

      // التحقق من أن المستخدم لديه حق الوصول لهذا المصنع
      const userFactoryIds = req.user.factoryIds || req.user.claims?.factoryIds || [];
      
      if (userFactoryIds.includes(factoryId)) {
        req.targetFactoryId = factoryId;
        return next();
      }

      logger.warn('Factory access denied', {
        userId: req.user.id,
        factoryId,
        userFactoryIds,
        path: req.path
      });

      return sendError(res, 403, 'Access denied. You do not have permission to access this factory.');
    } catch (error) {
      logger.error('Factory access check error', error);
      return sendError(res, 500, 'Error checking factory access.');
    }
  };
};

// ============ USER ID VALIDATION ============

/**
 * التحقق من أن المستخدم يصلح لبياناته فقط
 */
const checkOwnUser = () => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required.');
      }

      const userId = req.params.id || 
                     req.params.userId || 
                     req.params.user_id;

      if (!userId) {
        return next();
      }

      const userRole = req.user.role || req.user.claims?.role || 'viewer';
      
      // الإداري يمكنه الوصول لكل المستخدمين
      if (userRole === 'admin' || userRole === 'super_admin') {
        return next();
      }

      // التحقق من أن المستخدم يصلح لبياناته فقط
      if (req.user.id !== userId) {
        logger.warn('User access denied - not own user', {
          userId: req.user.id,
          targetUserId: userId,
          path: req.path
        });
        
        return sendError(res, 403, 'Access denied. You can only access your own data.');
      }

      next();
    } catch (error) {
      logger.error('Own user check error', error);
      return sendError(res, 500, 'Error checking user access.');
    }
  };
};

// ============ API KEY MIDDLEWARE ============

/**
 * التحقق من API Key (للخدمات الخارجية)
 */
const apiKeyMiddleware = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      logger.warn('API Key missing', {
        ip: req.ip,
        path: req.path
      });
      return sendUnauthorized(res, 'API Key is required.');
    }

    // TODO: التحقق من API Key من قاعدة البيانات
    // const isValid = await apiKeyService.validateApiKey(apiKey);
    // if (!isValid) {
    //   return sendUnauthorized(res, 'Invalid API Key.');
    // }

    // مؤقتاً: نسمح بالمرور
    req.apiKey = apiKey;
    next();
  } catch (error) {
    logger.error('API Key middleware error', error);
    return sendError(res, 500, 'Error validating API Key.');
  }
};

// ============ EXPORT ============

module.exports = {
  // Main
  authMiddleware,
  optionalAuthMiddleware,
  
  // Permission & Role
  checkPermissions,
  checkRole,
  
  // Access Control
  checkCompanyAccess,
  checkFactoryAccess,
  checkOwnUser,
  
  // API Key
  apiKeyMiddleware
};