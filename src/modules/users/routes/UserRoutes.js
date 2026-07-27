const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { checkPermissions, PERMISSIONS } = require('../../../core/middleware/permissions');
const { sendResponse, sendError, sendCreated, sendDeleted } = require('../../../core/utils/response');
const logger = require('../../../core/utils/logger');

// ============================================
// ✅ 1. STATIC ROUTES
// ============================================

// ===== GET /active - المستخدمين النشطين =====
router.get('/active', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const users = await User.find({ 
      companyId,
      status: 'active', 
      deletedAt: null 
    }).select('-__v');

    res.json({
      success: true,
      message: 'Active users retrieved successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('GET /active error:', error);
    sendError(res, 500, 'Error fetching active users');
  }
});

// ===== GET /me - الملف الشخصي =====
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.id });
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user.toPublicJSON ? user.toPublicJSON() : user
    });
  } catch (error) {
    logger.error('GET /me error:', error);
    sendError(res, 500, 'Error fetching profile');
  }
});

// ===== GET /stats - إحصائيات =====
router.get('/stats', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const [total, active, inactive, suspended, admins, managers, employees, viewers] = await Promise.all([
      User.countDocuments({ companyId, deletedAt: null }),
      User.countDocuments({ companyId, status: 'active', deletedAt: null }),
      User.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
      User.countDocuments({ companyId, status: 'suspended', deletedAt: null }),
      User.countDocuments({ companyId, role: 'admin', deletedAt: null }),
      User.countDocuments({ companyId, role: 'manager', deletedAt: null }),
      User.countDocuments({ companyId, role: 'employee', deletedAt: null }),
      User.countDocuments({ companyId, role: 'viewer', deletedAt: null })
    ]);

    res.json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        suspended,
        admins,
        managers,
        employees,
        viewers
      }
    });
  } catch (error) {
    logger.error('GET /stats error:', error);
    sendError(res, 500, 'Error fetching stats');
  }
});

// ===== GET /search - بحث عن المستخدمين =====
router.get('/search', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const { query } = req.query;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    if (!query || query.length < 2) {
      return sendError(res, 400, 'Search query must be at least 2 characters');
    }

    const users = await User.find({
      companyId,
      deletedAt: null,
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } }
      ]
    }).select('-__v').limit(50);

    res.json({
      success: true,
      message: `Search results for "${query}"`,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('GET /search error:', error);
    sendError(res, 500, 'Error searching users');
  }
});

// ============================================
// ✅ 2. PARAMETER ROUTES
// ============================================

// ===== GET /role/:role - مستخدمين حسب الدور =====
router.get('/role/:role', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const { role } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'engineer', 'employee', 'viewer'];
    if (!validRoles.includes(role)) {
      return sendError(res, 400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const users = await User.find({ 
      companyId,
      role, 
      deletedAt: null 
    }).select('-__v');

    res.json({
      success: true,
      message: `Users with role "${role}" retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('GET /role/:role error:', error);
    sendError(res, 500, 'Error fetching users by role');
  }
});

// ===== GET /factory/:factoryId - مستخدمين حسب المصنع =====
router.get('/factory/:factoryId', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const { factoryId } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const users = await User.find({ 
      companyId,
      factoryIds: factoryId, 
      deletedAt: null 
    }).select('-__v');

    res.json({
      success: true,
      message: `Users in factory ${factoryId} retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('GET /factory/:factoryId error:', error);
    sendError(res, 500, 'Error fetching users by factory');
  }
});

// ===== GET /department/:departmentId - مستخدمين حسب القسم =====
router.get('/department/:departmentId', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const { departmentId } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const users = await User.find({ 
      companyId,
      departmentIds: departmentId, 
      deletedAt: null 
    }).select('-__v');

    res.json({
      success: true,
      message: `Users in department ${departmentId} retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('GET /department/:departmentId error:', error);
    sendError(res, 500, 'Error fetching users by department');
  }
});

// ============================================
// ✅ 3. DYNAMIC ROUTES
// ============================================

// ===== GET - قائمة المستخدمين =====
router.get('/', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const { page = 1, limit = 10, search, role, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId, deletedAt: null };
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('GET /users error:', error);
    sendError(res, 500, 'Error fetching users');
  }
});

// ===== GET - مستخدم بالمعرف =====
router.get('/:id', checkPermissions([PERMISSIONS.USERS_VIEW]), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const user = await User.findOne({ _id: id, companyId, deletedAt: null });
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    logger.error('GET /users/:id error:', error);
    sendError(res, 500, 'Error fetching user');
  }
});

// ===== POST - إنشاء مستخدم جديد =====
router.post('/', checkPermissions([PERMISSIONS.USERS_CREATE]), async (req, res) => {
  try {
    const { email, displayName, firstName, lastName, role, phoneNumber, firebaseUid } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    // التحقق من البيانات المطلوبة
    if (!email || !displayName) {
      return sendError(res, 400, 'Email and displayName are required');
    }

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 400, 'Invalid email format');
    }

    // التحقق من عدم وجود مستخدم بنفس البريد في نفس الشركة
    const existingUser = await User.findOne({ email, companyId });
    if (existingUser) {
      return sendError(res, 409, 'User with this email already exists in this company');
    }

    // إنشاء مستخدم جديد
    const newUser = new User({
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      firstName: firstName ? firstName.trim() : null,
      lastName: lastName ? lastName.trim() : null,
      role: role || 'employee',
      status: 'active',
      companyId,
      phoneNumber: phoneNumber || null,
      firebaseUid: firebaseUid || `firebase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: savedUser
    });
  } catch (error) {
    logger.error('POST /users error:', error);
    sendError(res, 500, 'Error creating user');
  }
});

// ===== PUT /:id/role - تحديث دور المستخدم =====
router.put('/:id/role', checkPermissions([PERMISSIONS.USERS_UPDATE]), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    if (!role) {
      return sendError(res, 400, 'Role is required');
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'engineer', 'employee', 'viewer'];
    if (!validRoles.includes(role)) {
      return sendError(res, 400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = await User.findOne({ _id: id, companyId });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // لا يمكن تغيير دور Super Admin
    if (user.role === 'super_admin' && role !== 'super_admin') {
      return sendError(res, 403, 'Cannot change Super Admin role');
    }

    user.role = role;
    user.updatedBy = req.user?.id;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: user
    });
  } catch (error) {
    logger.error('PUT /:id/role error:', error);
    sendError(res, 500, 'Error updating role');
  }
});

// ===== PUT /:id/status - تحديث حالة المستخدم =====
router.put('/:id/status', checkPermissions([PERMISSIONS.USERS_UPDATE]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    if (!status) {
      return sendError(res, 400, 'Status is required');
    }

    const validStatuses = ['active', 'inactive', 'suspended', 'archived'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const user = await User.findOne({ _id: id, companyId });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // لا يمكن تغيير حالة Super Admin
    if (user.role === 'super_admin') {
      return sendError(res, 403, 'Cannot change Super Admin status');
    }

    user.status = status;
    user.updatedBy = req.user?.id;
    await user.save();

    res.json({
      success: true,
      message: `User status updated to ${status} successfully`,
      data: user
    });
  } catch (error) {
    logger.error('PUT /:id/status error:', error);
    sendError(res, 500, 'Error updating status');
  }
});

// ===== PUT - تحديث مستخدم =====
router.put('/:id', checkPermissions([PERMISSIONS.USERS_UPDATE]), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, firstName, lastName, phoneNumber, email, firebaseUid } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const user = await User.findOne({ _id: id, companyId });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // تحديث الحقول مع التنظيف
    if (displayName) user.displayName = displayName.trim();
    if (firstName !== undefined) user.firstName = firstName ? firstName.trim() : null;
    if (lastName !== undefined) user.lastName = lastName ? lastName.trim() : null;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber || null;
    
    if (email && email !== user.email) {
      // التحقق من عدم وجود مستخدم آخر بنفس البريد
      const existingUser = await User.findOne({ email, companyId, _id: { $ne: id } });
      if (existingUser) {
        return sendError(res, 409, 'Email already in use by another user');
      }
      user.email = email.toLowerCase().trim();
    }

    if (firebaseUid) user.firebaseUid = firebaseUid;

    user.updatedBy = req.user?.id;
    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    logger.error('PUT /users/:id error:', error);
    sendError(res, 500, 'Error updating user');
  }
});

// ===== DELETE - حذف مستخدم (Soft Delete) =====
router.delete('/:id', checkPermissions([PERMISSIONS.USERS_DELETE]), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      return sendError(res, 400, 'Company ID is required');
    }

    const user = await User.findOne({ _id: id, companyId });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // لا يمكن حذف Super Admin
    if (user.role === 'super_admin') {
      return sendError(res, 403, 'Cannot delete Super Admin');
    }

    // لا يمكن حذف نفسه
    if (user.firebaseUid === req.user?.id) {
      return sendError(res, 403, 'Cannot delete your own account');
    }

    // Soft Delete
    user.deletedAt = new Date();
    user.status = 'archived';
    user.deletedBy = req.user?.id;
    await user.save();

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        id: user._id,
        status: 'archived',
        deletedAt: user.deletedAt
      }
    });
  } catch (error) {
    logger.error('DELETE /users/:id error:', error);
    sendError(res, 500, 'Error deleting user');
  }
});

module.exports = router;