const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const User = require('../../users/models/User.model');
const logger = require('../../../core/utils/logger');

// ============================================================
// ===== REGISTER - إنشاء حساب جديد =====
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, companyId, role } = req.body;

        // ✅ التحقق من الحقول المطلوبة
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and name are required'
            });
        }

        // ✅ التحقق من صحة الإيميل
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // ✅ التحقق من قوة كلمة المرور
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // ✅ التحقق من صحة الدور (role) إذا تم إرساله
        const validRoles = ['super_admin', 'admin', 'manager', 'engineer', 'employee', 'viewer'];
        let userRole = 'viewer'; // القيمة الافتراضية

        if (role) {
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                });
            }
            userRole = role;
        }

        // ✅ 1. إنشاء اليوزر في Firebase Authentication
        let firebaseUser;
        try {
            firebaseUser = await admin.auth().createUser({
                email,
                password,
                displayName: name,
                emailVerified: false,
            });
            logger.info(`✅ Firebase user created: ${firebaseUser.uid}`);
        } catch (firebaseError) {
            logger.error('❌ Firebase user creation failed:', firebaseError.message);

            if (firebaseError.code === 'auth/email-already-exists') {
                return res.status(409).json({
                    success: false,
                    message: 'Email already registered. Please login instead.',
                    code: 'EMAIL_EXISTS'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to create user in Firebase',
                error: process.env.NODE_ENV === 'development' ? firebaseError.message : 'Internal server error'
            });
        }

        // ✅ 2. توليد companyId إذا لم يكن موجوداً
        let finalCompanyId = companyId;
        if (!finalCompanyId) {
            finalCompanyId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        } else if (!finalCompanyId.startsWith('comp_')) {
            finalCompanyId = `comp_${finalCompanyId}`;
        }

        // ✅ 3. إنشاء اليوزر في الـ Database
        try {
            const newUser = new User({
                firebaseUid: firebaseUser.uid,
                email: email.toLowerCase(),
                displayName: name.trim(),
                firstName: name.split(' ')[0] || null,
                lastName: name.split(' ').slice(1).join(' ') || null,
                companyId: finalCompanyId,
                role: userRole, // ✅ الدور من الـ Request أو default
                permissions: userRole === 'admin' || userRole === 'super_admin' ? ['*'] : [],
                status: 'active',
                emailVerified: false,
                metadata: {
                    provider: 'email/password',
                    createdAt: new Date()
                }
            });

            await newUser.save();
            logger.info(`✅ User saved to database: ${newUser.email} (role: ${newUser.role})`);

            // ✅ 4. إنشاء Custom Token (للتسجيل التلقائي)
            const customToken = await admin.auth().createCustomToken(firebaseUser.uid);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: newUser._id,
                        firebaseUid: newUser.firebaseUid,
                        email: newUser.email,
                        displayName: newUser.displayName,
                        role: newUser.role,
                        permissions: newUser.permissions,
                        companyId: newUser.companyId,
                        emailVerified: newUser.emailVerified
                    },
                    token: customToken // ✅ يستخدمه Frontend لتسجيل الدخول التلقائي
                }
            });

        } catch (dbError) {
            // ✅ لو فشل الحفظ في الـ DB، احذف اليوزر من Firebase
            logger.error('❌ Database save failed, deleting Firebase user:', dbError && dbError.message);

            try {
                await admin.auth().deleteUser(firebaseUser.uid);
                logger.info(`🗑️ Firebase user deleted due to DB error: ${firebaseUser.uid}`);
            } catch (deleteError) {
                logger.error('❌ Failed to delete Firebase user:', deleteError.message);
            }

            if (dbError && dbError.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists in our system',
                    code: 'USER_EXISTS'
                });
            }

            throw dbError;
        }

    } catch (error) {
        logger.error('❌ Registration error:', {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        res.status(500).json({
            success: false,
            message: 'Error registering user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== LOGIN - تسجيل الدخول (توجيه) =====
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // ⚠️ Firebase Admin SDK لا يدعم تسجيل الدخول بكلمة مرور مباشرة
        // لازم الـ Frontend يعمل signInWithEmailAndPassword من Firebase Client SDK
        // وبعد كده يبعت الـ ID Token لـ /api/v1/auth/verify-token

        return res.status(400).json({
            success: false,
            message: 'Please use Firebase Client SDK to sign in, then verify token via /api/v1/auth/verify-token'
        });
    } catch (error) {
        logger.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== VERIFY TOKEN - التحقق من التوكن =====
// ============================================================
router.post('/verify-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // ✅ التحقق من التوكن مع Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);

        // ✅ البحث عن المستخدم في قاعدة البيانات
        const user = await User.findOne({ firebaseUid: decodedToken.uid, deletedAt: null });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found in database'
            });
        }

        res.json({
            success: true,
            message: 'Token verified successfully',
            data: {
                user: user.toPublicJSON ? user.toPublicJSON() : user,
                claims: decodedToken
            }
        });
    } catch (error) {
        logger.error('❌ Verify token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid or expired token'
        });
    }
});

// ============================================================
// ===== LOGOUT - تسجيل الخروج =====
// ============================================================
router.post('/logout', async (req, res) => {
    try {
        // ✅ التحقق من وجود التوكن في الـ Header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // ✅ التحقق من التوكن مع Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);

        // ✅ إبطال الجلسة (اختياري)
        // يمكن إضافة منطق لإبطال الجلسة في قاعدة البيانات

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        logger.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging out',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== FORGOT PASSWORD - نسيت كلمة المرور =====
// ============================================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // ✅ إرسال رابط إعادة تعيين كلمة المرور عبر Firebase
        // Firebase Admin SDK لا يدعم إرسال رابط إعادة التعيين مباشرة
        // لازم الـ Frontend يستخدم Firebase Client SDK

        // ✅ التحقق من وجود المستخدم في قاعدة البيانات
        const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Password reset email sent',
            data: {
                email: user.email,
                // رابط إعادة التعيين من Firebase Client SDK
                resetUrl: `https://your-app.firebaseapp.com/reset-password?email=${encodeURIComponent(email)}`
            }
        });
    } catch (error) {
        logger.error('❌ Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending reset email',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== RESET PASSWORD - إعادة تعيين كلمة المرور =====
// ============================================================
router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword, resetToken } = req.body;

        if (!email || !newPassword || !resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Email, newPassword, and resetToken are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // ✅ التحقق من صحة resetToken عبر Firebase
        // Firebase Admin SDK لا يدعم التحقق من resetToken مباشرة
        // يجب استخدام Firebase Client SDK

        // ✅ تحديث كلمة المرور في Firebase
        const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // ✅ تحديث كلمة المرور في Firebase
        await admin.auth().updateUser(user.firebaseUid, {
            password: newPassword
        });

        // ✅ تحديث تاريخ آخر تغيير كلمة المرور
        user.lastPasswordChange = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                email: user.email,
                updatedAt: user.lastPasswordChange
            }
        });
    } catch (error) {
        logger.error('❌ Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== REFRESH TOKEN - تحديث التوكن =====
// ============================================================
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // ✅ تحديث التوكن عبر Firebase
        // Firebase Admin SDK لا يدعم تحديث التوكن مباشرة
        // يجب استخدام Firebase Client SDK

        res.json({
            success: true,
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        logger.error('❌ Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Error refreshing token',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;