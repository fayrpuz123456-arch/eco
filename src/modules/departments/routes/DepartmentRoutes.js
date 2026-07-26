const express = require('express');
const router = express.Router();
const Department = require('../models/Department.model');
const { authMiddleware } = require('../../../core/middleware/auth'); // ✅ استيراد authMiddleware

// ============================================================
// ✅ تطبيق authMiddleware على جميع راوتات الـ Department
// ============================================================
router.use(authMiddleware);

// ============================================================
// GET - قائمة الأقسام (مع Pagination و Filtering)
// ============================================================
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام req.companyId (من authMiddleware)
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    // ===== بناء فلتر البحث =====
    const filter = { companyId, deletedAt: null };
    
    // فلتر حسب المصنع
    if (req.query.factoryId) {
      filter.factoryId = req.query.factoryId;
    }
    
    // فلتر حسب النوع
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    // فلتر حسب الحالة
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // فلتر حسب البحث
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex }
      ];
    }

    // ===== Pagination =====
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // ===== Sorting =====
    const sortField = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

    // ===== تنفيذ الاستعلام =====
    const [departments, total] = await Promise.all([
      Department.find(filter)
        .select('-__v')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Department.countDocuments(filter)
    ]);

    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      count: departments.length
    });
  } catch (error) {
    console.error('❌ Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
});

// ============================================================
// GET - إحصائيات الأقسام
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const factoryId = req.query.factoryId || null;
    const stats = await Department.getStats(factoryId, companyId);
    const typeDistribution = await Department.getTypeDistribution(factoryId, companyId);

    res.json({
      success: true,
      message: 'Department statistics retrieved successfully',
      data: {
        stats,
        typeDistribution,
        factoryId: factoryId || 'all'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching department stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department statistics',
      error: error.message
    });
  }
});

// ============================================================
// GET - الأقسام حسب المصنع
// ============================================================
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const departments = await Department.findByFactory(
      req.params.factoryId,
      companyId
    );

    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('❌ Error fetching departments by factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
});

// ============================================================
// GET - الأقسام حسب النوع
// ============================================================
router.get('/type/:type', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const factoryId = req.query.factoryId || null;
    const departments = await Department.findByType(
      req.params.type,
      factoryId,
      companyId
    );

    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('❌ Error fetching departments by type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
});

// ============================================================
// GET - الأقسام النشطة
// ============================================================
router.get('/active', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const factoryId = req.query.factoryId || null;
    const departments = await Department.findActive(factoryId, companyId);

    res.json({
      success: true,
      message: 'Active departments retrieved successfully',
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('❌ Error fetching active departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
});

// ============================================================
// GET - قسم بالمعرف
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department retrieved successfully',
      data: department
    });
  } catch (error) {
    console.error('❌ Error fetching department:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department',
      error: error.message
    });
  }
});

// ============================================================
// GET - البحث في الأقسام
// ============================================================
router.get('/search/:term', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const factoryId = req.query.factoryId || null;
    const departments = await Department.search(
      req.params.term,
      factoryId,
      companyId
    );

    res.json({
      success: true,
      message: 'Search results retrieved successfully',
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('❌ Error searching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching departments',
      error: error.message
    });
  }
});

// ============================================================
// POST - إنشاء قسم جديد
// ============================================================
router.post('/', async (req, res) => {
  try {
    // ✅ استخدام req.companyId و req.user.id (من authMiddleware)
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { name, code, factoryId, description, type } = req.body;

    // ===== التحقق من الحقول المطلوبة =====
    if (!name || !code || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, and factoryId are required'
      });
    }

    // ===== التحقق من التكرار =====
    const existingDepartment = await Department.findOne({
      code: code.toUpperCase(),
      factoryId,
      companyId,
      deletedAt: null
    });

    if (existingDepartment) {
      return res.status(409).json({
        success: false,
        message: 'Department with this code already exists in this factory'
      });
    }

    // ===== إنشاء القسم =====
    const newDepartment = new Department({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      factoryId,
      type: type || 'production',
      description: description ? description.trim() : null,
      status: 'active',
      companyId,
      createdBy: userId,
      updatedBy: userId
    });

    const savedDepartment = await newDepartment.save();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: savedDepartment
    });
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating department',
      error: error.message
    });
  }
});

// ============================================================
// PUT - تحديث قسم
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { name, type, description, status } = req.body;

    // ===== البحث عن القسم =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // ===== تحديث الحقول =====
    if (name) department.name = name.trim();
    if (type) department.type = type;
    if (description !== undefined) department.description = description ? description.trim() : null;
    if (status) department.status = status;

    department.updatedBy = userId;
    department.updatedAt = new Date();

    const updatedDepartment = await department.save();

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    console.error('❌ Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: error.message
    });
  }
});

// ============================================================
// PATCH - تحديث جزئي لقسم
// ============================================================
router.patch('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const updates = req.body;
    delete updates._id;
    delete updates.__v;
    delete updates.createdAt;
    delete updates.createdBy;

    // ===== البحث عن القسم =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // ===== تطبيق التحديثات =====
    Object.keys(updates).forEach(key => {
      if (key === 'name') updates[key] = updates[key].trim();
      if (key === 'code') updates[key] = updates[key].toUpperCase().trim();
      if (key === 'description') updates[key] = updates[key] ? updates[key].trim() : null;
      department[key] = updates[key];
    });

    department.updatedBy = userId;
    department.updatedAt = new Date();

    const updatedDepartment = await department.save();

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    console.error('❌ Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: error.message
    });
  }
});

// ============================================================
// DELETE - حذف قسم (Soft Delete)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ===== البحث عن القسم =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // ===== Soft Delete =====
    department.deletedAt = new Date();
    department.deletedBy = userId;
    department.status = 'archived';
    await department.save();

    res.json({
      success: true,
      message: 'Department deleted successfully',
      data: {
        id: department._id,
        name: department.name,
        deletedAt: department.deletedAt
      }
    });
  } catch (error) {
    console.error('❌ Error deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting department',
      error: error.message
    });
  }
});

// ============================================================
// DELETE - حذف دائم لقسم (Hard Delete - Admin فقط)
// ============================================================
router.delete('/:id/permanent', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userRole = req.user.role || 'viewer';

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    // ✅ فقط admin أو super_admin يمكنهم الحذف الدائم
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can permanently delete departments.'
      });
    }

    // ===== البحث عن القسم =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // ===== حذف دائم =====
    await department.deleteOne();

    res.json({
      success: true,
      message: 'Department permanently deleted successfully',
      data: {
        id: req.params.id,
        name: department.name
      }
    });
  } catch (error) {
    console.error('❌ Error permanently deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting department',
      error: error.message
    });
  }
});

// ============================================================
// POST - استعادة قسم محذوف
// ============================================================
router.post('/:id/restore', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;
    const userRole = req.user.role || 'viewer';

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ فقط admin أو super_admin يمكنهم الاستعادة
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can restore departments.'
      });
    }

    // ===== البحث عن القسم المحذوف =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: { $ne: null }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Deleted department not found'
      });
    }

    // ===== استعادة القسم =====
    department.deletedAt = null;
    department.deletedBy = null;
    department.deletedReason = null;
    department.status = 'active';
    department.updatedBy = userId;
    department.updatedAt = new Date();

    const restoredDepartment = await department.save();

    res.json({
      success: true,
      message: 'Department restored successfully',
      data: restoredDepartment
    });
  } catch (error) {
    console.error('❌ Error restoring department:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring department',
      error: error.message
    });
  }
});

// ============================================================
// PUT - تغيير حالة القسم
// ============================================================
router.put('/:id/status', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['active', 'inactive', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // ===== البحث عن القسم =====
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    department.status = status;
    department.updatedBy = userId;
    department.updatedAt = new Date();

    const updatedDepartment = await department.save();

    res.json({
      success: true,
      message: 'Department status updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    console.error('❌ Error updating department status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department status',
      error: error.message
    });
  }
});

// ============================================================
// POST - حذف مجموعة أقسام (Batch Delete)
// ============================================================
router.post('/batch/delete', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { departmentIds } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'departmentIds array is required'
      });
    }

    // ===== البحث عن الأقسام =====
    const departments = await Department.find({
      _id: { $in: departmentIds },
      companyId,
      deletedAt: null
    });

    if (departments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active departments found for the provided IDs'
      });
    }

    // ===== حذف جميع الأقسام =====
    const results = [];
    for (const department of departments) {
      department.deletedAt = new Date();
      department.deletedBy = userId;
      department.status = 'archived';
      await department.save();
      results.push({
        id: department._id,
        name: department.name,
        code: department.code
      });
    }

    res.json({
      success: true,
      message: `${results.length} departments deleted successfully`,
      data: results
    });
  } catch (error) {
    console.error('❌ Error batch deleting departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting departments',
      error: error.message
    });
  }
});

// ============================================================
// POST - تحديث مجموعة أقسام (Batch Update)
// ============================================================
router.post('/batch/update', async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { departmentIds, updates } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'departmentIds array is required'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'updates object is required'
      });
    }

    // ===== البحث عن الأقسام =====
    const departments = await Department.find({
      _id: { $in: departmentIds },
      companyId,
      deletedAt: null
    });

    if (departments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active departments found for the provided IDs'
      });
    }

    // ===== تحديث جميع الأقسام =====
    const results = [];
    for (const department of departments) {
      Object.keys(updates).forEach(key => {
        if (key === 'name') updates[key] = updates[key].trim();
        if (key === 'code') updates[key] = updates[key].toUpperCase().trim();
        if (key === 'description') updates[key] = updates[key] ? updates[key].trim() : null;
        department[key] = updates[key];
      });
      department.updatedBy = userId;
      department.updatedAt = new Date();
      await department.save();
      results.push({
        id: department._id,
        name: department.name,
        code: department.code
      });
    }

    res.json({
      success: true,
      message: `${results.length} departments updated successfully`,
      data: results
    });
  } catch (error) {
    console.error('❌ Error batch updating departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating departments',
      error: error.message
    });
  }
});

module.exports = router;