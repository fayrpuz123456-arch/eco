const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة الحساسات =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId بدلاً من req.body.companyId || req.companyId
    const companyId = getCompanyId(req);

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

    const { type, status, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { companyId, deletedAt: null };
    if (type) query.type = type;
    if (status) query.status = status;

    const [sensors, total] = await Promise.all([
      Sensor.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Sensor.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: 'Sensors retrieved successfully',
      data: sensors,
      count: sensors.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + sensors.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('❌ GET /sensors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensors',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء حساس جديد =====
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // ✅ استخدام getCompanyId بدلاً من bodyCompanyId || req.companyId
    const companyId = getCompanyId(req);

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

    const {
      name,
      code,
      type,
      unit,
      machineId,
      factoryId,
      departmentId,
      productionLineId,
      description,
      manufacturer,
      model,
      serialNumber,
      operationalStatus,
      thresholds,
      specifications
    } = req.body;

    // ===== التحقق من الحقول المطلوبة =====
    if (!name || !code || !type || !unit || !machineId || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, unit, machineId, and factoryId are required'
      });
    }

    // ===== التحقق من عدم وجود حساس بنفس الكود =====
    const existingSensor = await Sensor.findOne({
      code: code.toUpperCase(),
      machineId,
      companyId,
      deletedAt: null
    });

    if (existingSensor) {
      return res.status(409).json({
        success: false,
        message: 'Sensor with this code already exists on this machine'
      });
    }

    // ===== تحويل type إلى lowercase للتطابق مع Enum =====
    const normalizedType = type.toLowerCase();
    
    // ===== قائمة الأنواع المدعومة =====
    const validTypes = ['temperature', 'pressure', 'humidity', 'vibration', 'current', 'voltage', 'flow', 'level', 'speed', 'position', 'other'];
    
    // إذا كان النوع غير مدعوم، استخدم 'other'
    const finalType = validTypes.includes(normalizedType) ? normalizedType : 'other';

    // ===== إنشاء الحساس =====
    const newSensor = new Sensor({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      type: finalType,
      unit: unit.trim(),
      machineId,
      factoryId,
      departmentId: departmentId || null,
      productionLineId: productionLineId || null,
      description: description || null,
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      operationalStatus: operationalStatus || 'online',
      thresholds: thresholds || {},
      specifications: specifications || {},
      companyId,
      createdBy: userId,
      updatedBy: userId,
      status: 'active'
    });

    const savedSensor = await newSensor.save();

    res.status(201).json({
      success: true,
      message: 'Sensor created successfully',
      data: savedSensor
    });
  } catch (error) {
    logger.error('❌ Error creating sensor:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - حساس بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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

    const sensor = await Sensor.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    res.json({
      success: true,
      message: 'Sensor retrieved successfully',
      data: sensor
    });
  } catch (error) {
    logger.error('❌ GET /sensors/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - حساس بالكود =====
router.get('/code/:code', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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
    const sensor = await Sensor.findOne({
      code,
      companyId,
      deletedAt: null
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    res.json({
      success: true,
      message: 'Sensor retrieved successfully',
      data: sensor
    });
  } catch (error) {
    logger.error('❌ GET /sensors/code/:code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor by code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - حساسات ماكينة معينة =====
router.get('/machine/:machineId', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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

    const { machineId } = req.params;
    const sensors = await Sensor.find({
      machineId,
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Sensors for machine retrieved successfully',
      data: sensors,
      count: sensors.length
    });
  } catch (error) {
    logger.error('❌ GET /sensors/machine/:machineId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensors for machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - إحصائيات الحساسات =====
router.get('/stats', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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

    const [total, active, inactive, online, offline, maintenance] = await Promise.all([
      Sensor.countDocuments({ companyId, deletedAt: null }),
      Sensor.countDocuments({ companyId, status: 'active', deletedAt: null }),
      Sensor.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'online', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'offline', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'maintenance', deletedAt: null })
    ]);

    res.json({
      success: true,
      message: 'Sensor statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        online,
        offline,
        maintenance
      }
    });
  } catch (error) {
    logger.error('❌ GET /sensors/stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث حساس =====
router.put('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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

    const sensor = await Sensor.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    // منع تحديث الحقول الحساسة
    delete req.body.companyId;
    delete req.body.machineId;
    delete req.body.factoryId;
    delete req.body.code;

    const {
      name,
      type,
      unit,
      description,
      operationalStatus,
      thresholds,
      specifications,
      status
    } = req.body;

    if (name) sensor.name = name.trim();
    if (type) {
      const normalizedType = type.toLowerCase();
      const validTypes = ['temperature', 'pressure', 'humidity', 'vibration', 'current', 'voltage', 'flow', 'level', 'speed', 'position', 'other'];
      sensor.type = validTypes.includes(normalizedType) ? normalizedType : 'other';
    }
    if (unit) sensor.unit = unit.trim();
    if (description !== undefined) sensor.description = description ? description.trim() : null;
    if (operationalStatus) sensor.operationalStatus = operationalStatus;
    if (thresholds) sensor.thresholds = thresholds;
    if (specifications) sensor.specifications = specifications;
    if (status) sensor.status = status;

    sensor.updatedBy = userId;
    sensor.updatedAt = new Date();

    const updatedSensor = await sensor.save();

    res.json({
      success: true,
      message: 'Sensor updated successfully',
      data: updatedSensor
    });
  } catch (error) {
    logger.error('❌ PUT /sensors/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف حساس (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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

    const sensor = await Sensor.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    sensor.deletedAt = new Date();
    sensor.deletedBy = userId;
    sensor.status = 'archived';
    await sensor.save();

    res.json({
      success: true,
      message: 'Sensor deleted successfully'
    });
  } catch (error) {
    logger.error('❌ DELETE /sensors/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;