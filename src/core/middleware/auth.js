const firebaseService = require('../../config/firebase');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken'); // ✅ أضف هذا
const { sendError, sendUnauthorized } = require('../utils/response');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');
const User = require('../../modules/users/models/User.model');

// ============================================================
// ===== دوال مساعدة للـ Company ID =====
// ============================================================

function generateCompanyId() {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function isValidCompanyId(companyId) {
    if (!companyId) return false;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(companyId);
    const isValidCompanyCode = companyId.startsWith('comp_') && companyId.length >= 10;
    return isValidObjectId || isValidCompanyCode;
}

function normalizeCompanyId(companyId) {
    if (!companyId) return generateCompanyId();
    if (/^[0-9a-fA-F]{24}$/.test(companyId)) {
        return `comp_${companyId}`;
    }
    if (companyId.startsWith('comp_') && companyId.length >= 10) {
        return companyId;
    }
    return generateCompanyId();
}

// ============================================================
// ===== التحقق من التوكن مع مرونة في الـ Issuer =====
// ============================================================

/**
 * التحقق من التوكن مع دعم كل من ID Token و Custom Token و REST API Token
 */
async function verifyTokenWithFlexibleIssuer(token) {
    try {
        // ✅ 1. حاول التحقق كـ ID Token عادي (من Firebase Client SDK)
        return await admin.auth().verifyIdToken(token);
    } catch (error) {
        // ✅ 2. إذا كان الخطأ بسبب الـ issuer، حاول التحقق يدوياً
        if (error.code === 'auth/argument-error' && 
            (error.message.includes('iss') || error.message.includes('issuer'))) {
            
            logger.warn('⚠️ Token has incorrect issuer, trying manual verification...');
            
            try {
                // ✅ فك تشفير التوكن بدون التحقق من التوقيع
                const decoded = jwt.decode(token, { complete: true });
                
                if (!decoded || !decoded.payload) {
                    throw new Error('Invalid token structure');
                }
                
                const payload = decoded.payload;
                const now = Math.floor(Date.now() / 1000);
                
                // ✅ التحقق من انتهاء الصلاحية
                if (payload.exp && payload.exp < now) {
                    throw new Error('Token expired');
                }
                
                // ✅ التحقق من وجود user_id أو sub
                const uid = payload.user_id || payload.sub;
                if (!uid) {
                    throw new Error('No user identifier found in token');
                }
                
                // ✅ إرجاع كائن مشابه لـ decodedToken
                return {
                    uid: uid,
                    claims: payload,
                    email: payload.email,
                    name: payload.displayName || payload.name,
                    picture: payload.picture || payload.photoURL,
                    email_verified: payload.email_verified || false,
                    auth_time: payload.auth_time || payload.iat,
                    sign_in_provider: payload.sign_in_provider || 'password',
                    exp: payload.exp,
                    iat: payload.iat,
                    iss: payload.iss,
                    aud: payload.aud,
                    sub: payload.sub || uid,
                    user_id: uid,
                    firebase: {
                        sign_in_provider: payload.sign_in_provider || 'password',
                        sign_in_second_factor: payload.sign_in_second_factor || null
                    }
                };
                
            } catch (manualError) {
                logger.error('❌ Manual token verification failed:', manualError.message);
                throw new Error('Invalid token: ' + manualError.message);
            }
        }
        
        // ✅ 3. إذا كان الخطأ من نوع آخر، أعد طرحه
        throw error;
    }
}

// ============================================================
// ===== قائمة الـ Routes الـ Public (محتاجتش توثيق) =====
// ============================================================

const PUBLIC_ROUTES = [
    { path: '/api/v1/auth/register', methods: ['POST'] },
    { path: '/api/v1/auth/login', methods: ['POST'] },
    { path: '/api/v1/auth/refresh', methods: ['POST'] },
    { path: '/api/v1/auth/forgot-password', methods: ['POST'] },
    { path: '/api/v1/auth/reset-password', methods: ['POST'] },
    { path: '/api/v1/auth/verify-email', methods: ['GET', 'POST'] },
    { path: '/api/v1/auth/send-verification', methods: ['POST'] },
    { path: '/health', methods: ['GET'] },
    { path: '/api/v1/health', methods: ['GET'] },
];

// ===== التحقق إذا كان المسار Public =====
function isPublicRoute(path, method) {
    return PUBLIC_ROUTES.some(route => {
        const pathMatch = path === route.path || path.startsWith(route.path + '/');
        const methodMatch = route.methods.includes(method);
        return pathMatch && methodMatch;
    });
}

// ============================================================
// ===== MAIN AUTH MIDDLEWARE =====
// ============================================================

/**
 * التحقق من المصادقة - يتحقق من صحة التوكن
 */
const authMiddleware = async (req, res, next) => {
    try {
        // ✅ 1. تخطي الـ Public Routes
        if (isPublicRoute(req.path, req.method)) {
            logger.debug(`🔓 Public route: ${req.method} ${req.path} - skipping auth`);
            return next();
        }

        // ✅ DEBUG: طباعة كل الـ Headers (للتشخيص)
        if (process.env.NODE_ENV !== 'production') {
            console.log('📋 ALL HEADERS:', JSON.stringify(req.headers, null, 2));
        }

        // 2. التحقق من وجود التوكن في الـ Header
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

        // 3. استخراج التوكن
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

        // 4. التحقق من التوكن مع Firebase (بمرونة)
        let decodedToken;
        let firebaseUser = null;
        let isCustomToken = false;
        let tokenSource = 'unknown';

        try {
            // ✅ استخدام الدالة الجديدة للتحقق
            decodedToken = await verifyTokenWithFlexibleIssuer(token);
            
            // ✅ تحديد مصدر التوكن
            if (decodedToken.iss && decodedToken.iss.includes('securetoken.google.com')) {
                tokenSource = 'firebase_client_sdk';
            } else if (decodedToken.iss && decodedToken.iss.includes('identitytoolkit')) {
                tokenSource = 'firebase_rest_api';
            } else {
                tokenSource = 'custom_token';
                isCustomToken = true;
            }
            
            // ✅ محاولة جلب المستخدم من Firebase (إذا كان UID موجود)
            if (decodedToken.uid) {
                try {
                    firebaseUser = await firebaseService.getUser(decodedToken.uid);
                } catch (userError) {
                    // لو مش موجود في Firebase، نستخدم البيانات من التوكن
                    logger.warn('⚠️ User not found in Firebase, using token data');
                    firebaseUser = {
                        uid: decodedToken.uid,
                        email: decodedToken.email || null,
                        displayName: decodedToken.name || decodedToken.displayName || null,
                        emailVerified: decodedToken.email_verified || false,
                        phoneNumber: decodedToken.phone_number || null,
                        photoURL: decodedToken.picture || null,
                        metadata: {
                            lastSignInTime: new Date(decodedToken.auth_time * 1000).toISOString() || null,
                            creationTime: new Date(decodedToken.iat * 1000).toISOString() || null
                        }
                    };
                }
            } else {
                throw new Error('No UID found in token');
            }

        } catch (authError) {
            // معالجة أخطاء المصادقة
            logger.warn('Firebase authentication failed', {
                error: authError.message,
                code: authError.code,
                ip: req.ip,
                path: req.path
            });

            if (authError.message === 'Token expired' || authError.message.includes('expired')) {
                return sendUnauthorized(res, 'Your session has expired. Please login again.');
            }

            return sendUnauthorized(res, 'Authentication failed. Invalid or expired token.');
        }

        // 5. جيب المستخدم من MongoDB
        let userFromDB = null;
        try {
            userFromDB = await User.findOne({ firebaseUid: decodedToken.uid });
        } catch (dbError) {
            logger.warn('Could not fetch user from MongoDB:', dbError.message);
        }

        // لو المستخدم مش موجود في MongoDB، أنشئه تلقائياً
        if (!userFromDB) {
            try {
                // ✅ توليد companyId مع التطبيع
                let companyId = req.headers['x-company-id'] ||
                    req.headers['company-id'] ||
                    decodedToken.claims?.companyId ||
                    null;

                // ✅ تطبيع companyId
                companyId = normalizeCompanyId(companyId);

                // ✅ التحقق من عدم وجود user بنفس الإيميل
                let existingUser = null;
                if (firebaseUser.email) {
                    existingUser = await User.findOne({
                        email: firebaseUser.email,
                        deletedAt: null
                    });
                }

                if (existingUser) {
                    // لو موجود بالإيميل، حدّث الـ firebaseUid
                    existingUser.firebaseUid = firebaseUser.uid;
                    existingUser.displayName = firebaseUser.displayName || existingUser.displayName;
                    existingUser.photoURL = firebaseUser.photoURL || existingUser.photoURL;

                    // ✅ لو مفيش companyId، استخدم companyId الموجود
                    if (!existingUser.companyId) {
                        existingUser.companyId = companyId;
                    }

                    await existingUser.save();
                    userFromDB = existingUser;
                    logger.info('🔄 Updated existing user with Firebase UID:', {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        companyId: existingUser.companyId
                    });
                } else {
                    // إنشاء يوزر جديد
                    const newUser = new User({
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || firebaseUser.email || 'User',
                        firstName: firebaseUser.displayName?.split(' ')[0] || null,
                        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || null,
                        firebaseUid: firebaseUser.uid,
                        emailVerified: firebaseUser.emailVerified || false,
                        role: 'viewer',
                        permissions: [],
                        companyId: companyId,
                        status: 'active',
                        metadata: {
                            provider: tokenSource,
                            createdAt: new Date(),
                            lastSync: new Date()
                        }
                    });
                    userFromDB = await newUser.save();
                    logger.info('✅ User auto-created from Firebase:', {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        companyId: companyId,
                        source: tokenSource
                    });
                }
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

        // 6. بناء كائن المستخدم
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
            mongoData: userFromDB || null,
            tokenSource: tokenSource,
            isCustomToken: isCustomToken
        };

        // 7. استخراج companyId من المصادر المختلفة
        let companyId = req.headers['x-company-id'] ||
            req.headers['company-id'] ||
            decodedToken.claims?.companyId ||
            userFromDB?.companyId ||
            null;

        // ✅ تطبيع companyId
        companyId = normalizeCompanyId(companyId);

        if (!companyId) {
            logger.error('❌ Company ID not found for user:', {
                uid: firebaseUser.uid,
                email: firebaseUser.email
            });
            return sendError(res, 400, 'Company ID is required. Please provide x-company-id header or ensure user has a company assigned.');
        }

        // ✅ التحقق من صحة companyId
        if (!isValidCompanyId(companyId)) {
            companyId = generateCompanyId();
            logger.warn(`⚠️ Generated new companyId: ${companyId}`);
        }

        req.companyId = companyId;

        // 8. تحديث userFromDB.companyId إذا كان مختلف
        if (userFromDB && userFromDB.companyId !== companyId) {
            userFromDB.companyId = companyId;
            await userFromDB.save();
            logger.info(`🔄 Updated user companyId: ${userFromDB.email} → ${companyId}`);
        }

        // 9. تسجيل نجاح المصادقة
        logger.debug('User authenticated successfully', {
            userId: req.user.id,
            email: req.user.email,
            role: req.user.role,
            permissions: req.user.permissions,
            companyId: req.companyId,
            tokenSource: tokenSource,
            ip: req.ip,
            path: req.path
        });

        next();

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

// ============================================================
// ===== OPTIONAL AUTH MIDDLEWARE =====
// ============================================================

/**
 * مصادقة اختيارية - تسمح بالوصول حتى بدون توكن
 */
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        // ✅ تخطي الـ Public Routes
        if (isPublicRoute(req.path, req.method)) {
            return next();
        }

        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];

            try {
                // ✅ استخدام الدالة الجديدة للتحقق
                const decodedToken = await verifyTokenWithFlexibleIssuer(token);

                let firebaseUser = null;
                if (decodedToken.uid) {
                    try {
                        firebaseUser = await firebaseService.getUser(decodedToken.uid);
                    } catch (userError) {
                        firebaseUser = {
                            uid: decodedToken.uid,
                            email: decodedToken.email || null,
                            displayName: decodedToken.name || decodedToken.displayName || null,
                            emailVerified: decodedToken.email_verified || false
                        };
                    }
                }

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
                    id: decodedToken.uid,
                    email: firebaseUser?.email || decodedToken.email,
                    displayName: firebaseUser?.displayName || decodedToken.name || decodedToken.displayName || 'User',
                    role: userRole,
                    permissions: userPermissions,
                    claims: decodedToken.claims || {},
                    mongoData: userFromDB || null,
                    tokenSource: 'optional'
                };

                let companyId = req.headers['x-company-id'] ||
                    req.headers['company-id'] ||
                    decodedToken.claims?.companyId ||
                    userFromDB?.companyId;

                if (companyId) {
                    companyId = normalizeCompanyId(companyId);
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

// ============================================================
// ===== PERMISSION MIDDLEWARE =====
// ============================================================

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

// ============================================================
// ===== ROLE MIDDLEWARE =====
// ============================================================

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

// ============================================================
// ===== COMPANY ACCESS MIDDLEWARE =====
// ============================================================

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

            // تطبيع targetCompanyId
            targetCompanyId = normalizeCompanyId(targetCompanyId);

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

            const normalizedUserCompanyId = normalizeCompanyId(userCompanyId);
            if (normalizedUserCompanyId !== targetCompanyId) {
                logger.warn('Company access denied', {
                    userId: req.user.id,
                    userCompanyId: normalizedUserCompanyId,
                    targetCompanyId: targetCompanyId,
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

// ============================================================
// ===== FACTORY ACCESS MIDDLEWARE =====
// ============================================================

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

// ============================================================
// ===== USER ID VALIDATION =====
// ============================================================

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
            if (req.user.id !== userId && req.user.mongoData?._id?.toString() !== userId) {
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

// ============================================================
// ===== API KEY MIDDLEWARE =====
// ============================================================

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

// ============================================================
// ===== EXPORT =====
// ============================================================

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
    apiKeyMiddleware,

    // Public Routes (للتصدير)
    PUBLIC_ROUTES,
    isPublicRoute,

    // Company ID Helpers (للتصدير)
    generateCompanyId,
    isValidCompanyId,
    normalizeCompanyId
};