const express = require('express');
const router = express.Router();
const Factory = require('../models/Factory.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - إحصائيات المصانع =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
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

    const [total, active, inactive, archived] = await Promise.all([
      Factory.countDocuments({ companyId, deletedAt: null }),
      Factory.countDocuments({ companyId, status: 'active', deletedAt: null }),
      Factory.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
      Factory.countDocuments({ companyId, status: 'archived', deletedAt: null })
    ]);

    // ✅ إحصائيات إضافية
    const [byIndustry, recent] = await Promise.all([
      Factory.aggregate([
        { $match: { companyId, deletedAt: null } },
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Factory.find({ companyId, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name code industry createdAt')
    ]);

    res.json({
      success: true,
      message: 'Factory statistics retrieved successfully',
      data: {
        summary: {
          total,
          active,
          inactive,
          archived
        },
        byIndustry,
        recent
      }
    });
  } catch (error) {
    logger.error('❌ GET /factories/stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - قائمة المصانع =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    // ✅ تسجيل للـ Debug
    logger.debug('🔍 GET /factories - companyId:', {
      fromBody: req.body?.companyId,
      fromHeader: req.headers?.['x-company-id'],
      fromAuth: req.companyId,
      final: companyId
    });

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    // ✅ التحقق من صحة companyId
    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    // ✅ دعم Pagination و Filtering
    const { page = 1, limit = 10, search, status, industry } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ بناء الـ Query مع الـ Search و Filters
    const query = { companyId, deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (industry) query.industry = industry;

    const [factories, total] = await Promise.all([
      Factory.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v')
        .sort({ createdAt: -1 }),
      Factory.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: 'Factories retrieved successfully',
      data: factories,
      count: factories.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + factories.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('❌ GET /factories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching factories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - مصنع بالكود =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
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
    const factory = await Factory.findOne({ 
      code, 
      companyId,
      deletedAt: null 
    });

    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    res.json({
      success: true,
      message: 'Factory retrieved successfully',
      data: factory
    });
  } catch (error) {
    logger.error('❌ GET /factories/code/:code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - مصنع بالمعرف =====
// ✅ لازم يكون في الآخر عشان منتصادش مع الـ Routes التانية
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

    const factory = await Factory.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    res.json({
      success: true,
      message: 'Factory retrieved successfully',
      data: factory
    });
  } catch (error) {
    logger.error('❌ GET /factories/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء مصنع جديد =====
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

    // ✅ التحقق من صحة companyId
    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { name, code, industry, contactEmail, contactPhone, address, description } = req.body;

    // ✅ التحقق من البيانات المطلوبة
    if (!name || !code || !industry || !contactEmail) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, industry, and contactEmail are required'
      });
    }

    // ✅ التحقق من صحة الكود (حروف كبيرة وأرقام فقط)
    if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Code must contain only uppercase letters and numbers'
      });
    }

    // ✅ التحقق من عدم وجود مصنع بنفس الكود في نفس الشركة
    const existingFactory = await Factory.findOne({ 
      code: code.toUpperCase(), 
      companyId,
      deletedAt: null 
    });

    if (existingFactory) {
      return res.status(409).json({
        success: false,
        message: `Factory with code "${code}" already exists in this company`
      });
    }

    // ✅ إنشاء مصنع جديد
    const newFactory = new Factory({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      industry,
      contactEmail: contactEmail.trim(),
      companyId,
      contactPhone: contactPhone || null,
      address: address || {},
      description: description || null,
      createdBy: userId,
      updatedBy: userId,
      status: 'active'
    });

    const savedFactory = await newFactory.save();

    res.status(201).json({
      success: true,
      message: 'Factory created successfully',
      data: savedFactory
    });
  } catch (error) {
    logger.error('❌ Error creating factory:', error);
    
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
        message: 'Factory with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث مصنع =====
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

    const factory = await Factory.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    // ✅ منع تحديث companyId و code
    delete req.body.companyId;
    delete req.body.code;

    const { name, industry, contactEmail, contactPhone, address, description, status } = req.body;

    // ✅ تحديث الحقول
    if (name) factory.name = name.trim();
    if (industry) factory.industry = industry;
    if (contactEmail) factory.contactEmail = contactEmail.trim();
    if (contactPhone) factory.contactPhone = contactPhone;
    if (address) factory.address = address;
    if (description !== undefined) factory.description = description;
    if (status) factory.status = status;

    factory.updatedBy = userId;
    factory.updatedAt = new Date();

    const updatedFactory = await factory.save();

    res.json({
      success: true,
      message: 'Factory updated successfully',
      data: updatedFactory
    });
  } catch (error) {
    logger.error('❌ Error updating factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PATCH - تحديث جزئي لمصنع =====
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

    const factory = await Factory.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    Object.keys(updates).forEach(key => {
      if (key === 'name') updates[key] = updates[key].trim();
      if (key === 'contactEmail') updates[key] = updates[key].trim();
      if (key === 'description') updates[key] = updates[key] || null;
      factory[key] = updates[key];
    });

    factory.updatedBy = userId;
    factory.updatedAt = new Date();

    const updatedFactory = await factory.save();

    res.json({
      success: true,
      message: 'Factory updated successfully',
      data: updatedFactory
    });
  } catch (error) {
    logger.error('❌ PATCH /factories/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف مصنع (Soft Delete) =====
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

    const factory = await Factory.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    // ✅ التحقق من وجود مستخدمين تابعين للمصنع قبل الحذف
    const { default: User } = require('../users/models/User.model');
    const usersCount = await User.countDocuments({ factoryId: factory._id, deletedAt: null });
    
    if (usersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete factory. It has ${usersCount} associated user(s)`
      });
    }

    // ✅ التحقق من وجود أقسام تابعة للمصنع
    const { default: Department } = require('../departments/models/Department.model');
    const departmentsCount = await Department.countDocuments({ factoryId: factory._id, deletedAt: null });
    
    if (departmentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete factory. It has ${departmentsCount} associated department(s)`
      });
    }

    // Soft Delete
    factory.deletedAt = new Date();
    factory.deletedBy = userId;
    factory.status = 'archived';
    await factory.save();

    res.json({
      success: true,
      message: 'Factory deleted successfully',
      data: {
        id: factory._id,
        name: factory.name,
        status: 'deleted',
        deletedAt: factory.deletedAt
      }
    });
  } catch (error) {
    logger.error('❌ Error deleting factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - استعادة مصنع محذوف =====
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
        message: 'Access denied. Only administrators can restore factories.'
      });
    }

    const factory = await Factory.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: { $ne: null }
    });

    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Deleted factory not found'
      });
    }

    factory.deletedAt = null;
    factory.deletedBy = null;
    factory.status = 'active';
    factory.updatedBy = userId;
    factory.updatedAt = new Date();

    const restoredFactory = await factory.save();

    res.json({
      success: true,
      message: 'Factory restored successfully',
      data: restoredFactory
    });
  } catch (error) {
    logger.error('❌ POST /factories/:id/restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;