const express = require('express');
const router = express.Router();

// ===== IMPORT USER MODEL - VERSION SANS BaseModel =====
const User = require('../models/User.model');

// ✅ استيراد Auth Middleware
const { authMiddleware } = require('../../../core/middleware/auth');

// ===== GET - قائمة المستخدمين من قاعدة البيانات =====
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    
    res.json({
      success: true,
      message: 'Users retrieved from database successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// ===== GET /me - الملف الشخصي (مع Auth Middleware) =====
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // الـ authMiddleware بيحط المستخدم في req.user
    // البحث باستخدام firebaseUid بدل _id
    const user = await User.findOne({ firebaseUid: req.user.id });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user.toPublicJSON ? user.toPublicJSON() : user
    });
  } catch (error) {
    console.error('❌ GET /me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// ===== GET - مستخدم بالمعرف من قاعدة البيانات =====
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ GET /users/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// ===== POST - إنشاء مستخدم جديد في قاعدة البيانات =====
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /users - Body:', req.body);
    
    const { email, displayName, role, firebaseUid } = req.body; // ✅ إضافة firebaseUid

    // التحقق من البيانات المطلوبة
    if (!email || !displayName) {
      console.log('❌ Missing email or displayName');
      return res.status(400).json({
        success: false,
        message: 'Email and displayName are required fields',
        errors: {
          email: !email ? 'Email is required' : undefined,
          displayName: !displayName ? 'Display name is required' : undefined
        }
      });
    }

    // التحقق من عدم وجود مستخدم بنفس البريد
    console.log('🔍 Checking if user exists:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('⚠️ User already exists:', email);
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    console.log('✅ Creating new user...');
    // إنشاء مستخدم جديد
    const newUser = new User({
      email,
      displayName,
      role: role || 'employee',
      status: 'active',
      companyId: 'comp_test_001',
      firebaseUid: firebaseUid || `firebase_${Date.now()}` // ✅ استخدام القيمة المرسلة أو إنشاء واحدة
    });

    console.log('📦 Saving user to database...');
    // حفظ في قاعدة البيانات
    const savedUser = await newUser.save();
    console.log('✅ User saved successfully! ID:', savedUser._id);

    res.status(201).json({
      success: true,
      message: 'User created in database successfully',
      data: savedUser
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message,
      stack: error.stack
    });
  }
});

// ===== PUT - تحديث مستخدم =====
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, role, email, firebaseUid, deletedAt, status } = req.body; // ✅ إضافة الحقول

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // تحديث الحقول
    if (displayName) user.displayName = displayName;
    if (role) user.role = role;
    if (email) user.email = email;
    if (firebaseUid) user.firebaseUid = firebaseUid; // ✅ تحديث firebaseUid
    if (deletedAt !== undefined) user.deletedAt = deletedAt; // ✅ تحديث deletedAt
    if (status) user.status = status; // ✅ تحديث status

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: `User ${id} updated successfully`,
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ PUT /users/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
});

// ===== DELETE - حذف مستخدم (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft Delete - وضع علامة محذوف
    user.deletedAt = new Date();
    user.status = 'archived';
    await user.save();

    res.json({
      success: true,
      message: `User ${id} deleted successfully`,
      data: {
        id: id,
        status: 'deleted',
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ DELETE /users/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// ===== GET /search - بحث عن المستخدمين =====
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ]
    }).select('-__v');

    res.json({
      success: true,
      message: `Search results for "${query}"`,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
});

// ===== GET /active - المستخدمين النشطين =====
router.get('/active', async (req, res) => {
  try {
    const users = await User.find({ status: 'active', deletedAt: null }).select('-__v');
    
    res.json({
      success: true,
      message: 'Active users retrieved successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /active error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active users',
      error: error.message
    });
  }
});

// ===== GET /stats - إحصائيات =====
router.get('/stats', async (req, res) => {
  try {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ status: 'active', deletedAt: null });
    const inactive = await User.countDocuments({ status: 'inactive', deletedAt: null });
    const suspended = await User.countDocuments({ status: 'suspended', deletedAt: null });
    
    const admins = await User.countDocuments({ role: 'admin', deletedAt: null });
    const managers = await User.countDocuments({ role: 'manager', deletedAt: null });
    const employees = await User.countDocuments({ role: 'employee', deletedAt: null });

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
        employees
      }
    });
  } catch (error) {
    console.error('❌ GET /stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

// ===== GET /role/:role - مستخدمين حسب الدور =====
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    
    const users = await User.find({ role, deletedAt: null }).select('-__v');
    
    res.json({
      success: true,
      message: `Users with role "${role}" retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /role/:role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by role',
      error: error.message
    });
  }
});

// ===== GET /factory/:factoryId - مستخدمين حسب المصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    
    const users = await User.find({ factoryIds: factoryId, deletedAt: null }).select('-__v');
    
    res.json({
      success: true,
      message: `Users in factory ${factoryId} retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /factory/:factoryId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by factory',
      error: error.message
    });
  }
});

// ===== GET /department/:departmentId - مستخدمين حسب القسم =====
router.get('/department/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    const users = await User.find({ departmentIds: departmentId, deletedAt: null }).select('-__v');
    
    res.json({
      success: true,
      message: `Users in department ${departmentId} retrieved successfully`,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ GET /department/:departmentId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by department',
      error: error.message
    });
  }
});

// ===== PUT /:id/role - تحديث دور المستخدم =====
router.put('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User ${id} role updated to ${role} successfully`,
      data: user
    });
  } catch (error) {
    console.error('❌ PUT /:id/role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating role',
      error: error.message
    });
  }
});

// ===== PUT /:id/status - تحديث حالة المستخدم =====
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.status = status;
    await user.save();

    res.json({
      success: true,
      message: `User ${id} status updated to ${status} successfully`,
      data: user
    });
  } catch (error) {
    console.error('❌ PUT /:id/status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message
    });
  }
});

module.exports = router;