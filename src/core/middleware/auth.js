const firebaseService = require('../../config/firebase');
const { sendError, sendUnauthorized } = require('../utils/response');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');
const User = require('../../modules/users/models/User.model');

// ============ MAIN AUTH MIDDLEWARE ============

/**
 * التحقق من المصادقة - يتحقق من صحة التوكن
 */
const authMiddleware = async (req, res, next) => {
  try {
    // ✅ DEBUG: طباعة كل الـ Headers (للتشخيص)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📋 ALL HEADERS:', JSON.stringify(req.headers, null, 2));
    }

    // 1. التحقق من وجود التوكن في الـ Header
    const authHeader = req.headers.authorization;
    
    // ✅ DEBUG: طباعة الـ Authorization Header
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 Authorization Header:', authHeader);
      console.log('🔑 Authorization Header Length:', authHeader?.length || 0);
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers
      });
      return sendUnauthorized(res, 'Authentication required. Please provide a valid token.');
    }

    // 2. استخراج التوكن
    const token = authHeader.split('Bearer ')[1];
    
    // ✅ DEBUG: طباعة الـ Token
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 Token:', token);
      console.log('🔑 Token Length:', token?.length || 0);
      console.log('🔑 Token First 20 chars:', token?.substring(0, 20) || 'empty');
    }
    
    if (!token || token.length < 10) {
      logger.warn('Authentication failed: Invalid token format', {
        ip: req.ip,
        path: req.path,
        tokenLength: token?.length || 0
      });
      return sendUnauthorized(res, 'Invalid token format.');
    }

    // 3. التحقق من التوكن مع Firebase
    try {
      const decodedToken = await firebaseService.verifyToken(token);
      
      // 4. الحصول على معلومات المستخدم من Firebase
      const firebaseUser = await firebaseService.getUser(decodedToken.uid);
      
      // جيب المستخدم من MongoDB
      let userFromDB = null;
      try {
        userFromDB = await User.findOne({ firebaseUid: decodedToken.uid });
      } catch (dbError) {
        logger.warn('Could not fetch user from MongoDB:', dbError.message);
      }

      // لو المستخدم مش موجود في MongoDB، أنشئه تلقائياً
      if (!userFromDB) {
        try {
          // ✅ توليد companyId ديناميكياً من الـ Request
          const companyId = req.headers['x-company-id'] || 
                           decodedToken.claims?.companyId || 
                           `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

          const newUser = new User({
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email || 'User',
            firebaseUid: firebaseUser.uid,
            emailVerified: firebaseUser.emailVerified || false,
            role: 'viewer',
            permissions: [],
            companyId: companyId,
            status: 'active'
          });
          userFromDB = await newUser.save();
          logger.info('✅ User auto-created from Firebase:', { 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            companyId: companyId
          });
        } catch (createError) {
          logger.error('❌ Failed to auto-create user:', createError.message);
          return sendError(res, 500, 'Failed to create user profile. Please contact support.');
        }
      }

      // تحديد الـ Role والـ Permissions من MongoDB
      let userRole = 'viewer';
      let userPermissions = [];

      if (userFromDB) {
        userRole = userFromDB.role || 'viewer';
        userPermissions = userFromDB.permissions || [];
        
        // لو الـ role admin ومفيش permissions، أضفهم تلقائياً
        if (userRole === 'admin' && userPermissions.length === 0) {
          userPermissions = ['*'];
          await User.updateOne(
            { _id: userFromDB._id },
            { $set: { permissions: ['*'] } }
          );
          logger.info('✅ Auto-added permissions for admin:', userFromDB.email);
        }
        
        // لو super_admin، أضف كل الصلاحيات
        if (userRole === 'super_admin') {
          userPermissions = ['*'];
        }
      }

      // 5. بناء كائن المستخدم
      req.user = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
        emailVerified: firebaseUser.emailVerified || false,
        phoneNumber: firebaseUser.phoneNumber || null,
        photoURL: firebaseUser.photoURL || null,
        role: userRole,
        permissions: userPermissions,
        claims: decodedToken.claims || {},
        metadata: {
          lastSignInTime: firebaseUser.metadata?.lastSignInTime || null,
          creationTime: firebaseUser.metadata?.creationTime || null
        },
        mongoData: userFromDB || null
      };

      // 6. استخراج companyId
      const companyId = req.headers['x-company-id'] || 
                        decodedToken.claims?.companyId || 
                        userFromDB?.companyId;

      if (!companyId) {
        logger.error('❌ Company ID not found for user:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email
        });
        return sendError(res, 400, 'Company ID is required. Please provide x-company-id header or ensure user has a company assigned.');
      }

      req.companyId = companyId;

      // 7. تسجيل نجاح المصادقة
      logger.debug('User authenticated successfully', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
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
        
        // جيب المستخدم من MongoDB (اختياري)
        let userFromDB = null;
        try {
          userFromDB = await User.findOne({ firebaseUid: decodedToken.uid });
        } catch (dbError) {
          // تجاهل
        }
        
        // تحديد الـ Role والـ Permissions
        let userRole = 'viewer';
        let userPermissions = [];
        
        if (userFromDB) {
          userRole = userFromDB.role || 'viewer';
          userPermissions = userFromDB.permissions || [];
          
          if (userRole === 'admin' && userPermissions.length === 0) {
            userPermissions = ['*'];
          }
          if (userRole === 'super_admin') {
            userPermissions = ['*'];
          }
        }
        
        req.user = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email,
          role: userRole,
          permissions: userPermissions,
          claims: decodedToken.claims || {},
          mongoData: userFromDB || null
        };
        
        const companyId = req.headers['x-company-id'] || 
                          decodedToken.claims?.companyId || 
                          userFromDB?.companyId;
        
        if (companyId) {
          req.companyId = companyId;
        }
        
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

      // الحصول على صلاحيات المستخدم من MongoDB
      const userPermissions = req.user.permissions || [];
      const userRole = req.user.role || 'viewer';

      // التحقق من صلاحيات الإداري
      if (userRole === 'super_admin' || userRole === 'admin') {
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

      // الحصول على الدور من MongoDB
      const userRole = req.user.role || 'viewer';

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

      // الحصول على companyId من MongoDB
      const userCompanyId = req.companyId || req.user.mongoData?.companyId;
      const userRole = req.user.role || 'viewer';

      // الإداري يمكنه الوصول لكل الشركات
      if (userRole === 'admin' || userRole === 'super_admin') {
        req.targetCompanyId = targetCompanyId;
        return next();
      }

      // التحقق من أن المستخدم يتبع نفس الشركة
      if (!userCompanyId) {
        logger.error('❌ User has no company assigned:', {
          userId: req.user.id,
          email: req.user.email
        });
        return sendError(res, 403, 'User has no company assigned. Please contact administrator.');
      }

      if (userCompanyId !== targetCompanyId) {
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

      const userRole = req.user.role || 'viewer';
      
      // الإداري يمكنه الوصول لكل المصانع
      if (userRole === 'admin' || userRole === 'super_admin') {
        req.targetFactoryId = factoryId;
        return next();
      }

      // التحقق من أن المستخدم لديه حق الوصول لهذا المصنع
      const userFactoryIds = req.user.mongoData?.factoryIds || [];
      
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

      const userRole = req.user.role || 'viewer';
      
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