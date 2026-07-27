const express = require('express');
const router = express.Router();
const Factory = require('../models/Factory.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== Helper function للحصول على companyId =====
const getCompanyId = (req) => {
  return req.body?.companyId || req.headers?.['x-company-id'] || req.companyId;
};

// ===== GET - قائمة المصانع =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
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

    // ✅ دعم Pagination
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [factories, total] = await Promise.all([
      Factory.find({ 
        companyId,
        deletedAt: null 
      })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v')
      .sort({ createdAt: -1 }),
      Factory.countDocuments({ companyId, deletedAt: null })
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ التحقق من صحة companyId (يدعم ObjectId و comp_)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(companyId);
    const isValidCompanyCode = companyId.startsWith('comp_') && companyId.length >= 10;
    
    if (!isValidObjectId && !isValidCompanyCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { name, code, industry, contactEmail, contactPhone, address } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !code || !industry || !contactEmail) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, industry, and contactEmail are required'
      });
    }

    // التحقق من عدم وجود مصنع بنفس الكود في نفس الشركة
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

    // إنشاء مصنع جديد
    const newFactory = new Factory({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      industry,
      contactEmail: contactEmail.trim(),
      companyId, // ✅ استخدام companyId الصحيح
      contactPhone: contactPhone || null,
      address: address || {},
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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

    // منع تحديث companyId و code
    delete req.body.companyId;
    delete req.body.code;

    const { name, industry, contactEmail, contactPhone, address, status } = req.body;

    // تحديث الحقول
    if (name) factory.name = name.trim();
    if (industry) factory.industry = industry;
    if (contactEmail) factory.contactEmail = contactEmail.trim();
    if (contactPhone) factory.contactPhone = contactPhone;
    if (address) factory.address = address;
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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
    // ✅ استخدام companyId من الـ Body أو الـ Header أو الـ Auth
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
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