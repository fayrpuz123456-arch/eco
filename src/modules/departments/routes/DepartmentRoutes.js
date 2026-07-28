const express = require('express');
const router = express.Router();
const Department = require('../models/Department.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ============================================================
// ✅ تطبيق Middleware على جميع راوتات الـ Department
// ============================================================
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============================================================
// GET - إحصائيات الأقسام
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - الأقسام النشطة
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/active', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/active error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - الأقسام حسب المصنع
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/factory/:factoryId', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/factory/:factoryId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - الأقسام حسب النوع
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/type/:type', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/type/:type error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - البحث في الأقسام
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/search/:term', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/search/:term error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - قسم بالكود
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
// ============================================================
router.get('/code/:code', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const code = req.params.code.toUpperCase();
    const department = await Department.findOne({
      code,
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
    logger.error('❌ GET /departments/code/:code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department by code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - قائمة الأقسام (مع Pagination و Filtering)
// ============================================================
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const filter = { companyId, deletedAt: null };
    
    if (req.query.factoryId) {
      filter.factoryId = req.query.factoryId;
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex }
      ];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const sortField = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder };

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
      count: departments.length,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + departments.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('❌ GET /departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// GET - قسم بالمعرف
// ✅ لازم يكون في الآخر عشان منتصادش مع الـ Routes التانية
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ GET /departments/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// POST - إنشاء قسم جديد
// ============================================================
router.post('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { name, code, factoryId, description, type } = req.body;

    if (!name || !code || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, and factoryId are required'
      });
    }

    // ✅ التحقق من صحة الكود (حروف كبيرة وأرقام فقط)
    if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Code must contain only uppercase letters and numbers'
      });
    }

    // ✅ التحقق من عدم وجود قسم بنفس الكود
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
    logger.error('❌ POST /departments error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Department with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// PUT - تحديث قسم
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { name, type, description, status } = req.body;

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

    // ✅ منع تحديث companyId و code و factoryId
    delete req.body.companyId;
    delete req.body.code;
    delete req.body.factoryId;

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
    logger.error('❌ PUT /departments/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// PATCH - تحديث جزئي لقسم
// ============================================================
router.patch('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const updates = req.body;
    delete updates._id;
    delete updates.__v;
    delete updates.createdAt;
    delete updates.createdBy;
    delete updates.companyId;
    delete updates.code;
    delete updates.factoryId;

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
    logger.error('❌ PATCH /departments/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// DELETE - حذف قسم (Soft Delete)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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

    // ✅ التحقق من وجود ماكينات تابعة للقسم
    const { default: Machine } = require('../machines/models/Machine.model');
    const machinesCount = await Machine.countDocuments({ departmentId: department._id, deletedAt: null });
    
    if (machinesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department. It has ${machinesCount} associated machine(s)`
      });
    }

    // ✅ التحقق من وجود Production Lines تابعة للقسم
    const { default: ProductionLine } = require('../productionLines/models/ProductionLine.model');
    const linesCount = await ProductionLine.countDocuments({ departmentId: department._id, deletedAt: null });
    
    if (linesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department. It has ${linesCount} associated production line(s)`
      });
    }

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
    logger.error('❌ DELETE /departments/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// DELETE - حذف دائم لقسم (Hard Delete - Admin فقط)
// ============================================================
router.delete('/:id/permanent', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;
    const userRole = req.user?.role || 'viewer';

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can permanently delete departments.'
      });
    }

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
    logger.error('❌ DELETE /departments/:id/permanent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// POST - استعادة قسم محذوف
// ============================================================
router.post('/:id/restore', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;
    const userRole = req.user?.role || 'viewer';

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can restore departments.'
      });
    }

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
    logger.error('❌ POST /departments/:id/restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// PUT - تغيير حالة القسم
// ============================================================
router.put('/:id/status', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ PUT /departments/:id/status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// POST - حذف مجموعة أقسام (Batch Delete)
// ============================================================
router.post('/batch/delete', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { departmentIds } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'departmentIds array is required'
      });
    }

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
    logger.error('❌ POST /departments/batch/delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// POST - تحديث مجموعة أقسام (Batch Update)
// ============================================================
router.post('/batch/update', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
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
    logger.error('❌ POST /departments/batch/update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating departments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;