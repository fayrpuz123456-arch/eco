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

    // ✅ دعم Pagination
    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ بناء الـ Query مع الـ Search
    const query = { companyId, deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }

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

// ===== GET - مصنع بالمعرف =====
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

// ===== GET - مصنع بالكود =====
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

// ===== GET - إحصائيات المصانع =====
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

    res.json({
      success: true,
      message: 'Factory statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        archived
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

module.exports = router;