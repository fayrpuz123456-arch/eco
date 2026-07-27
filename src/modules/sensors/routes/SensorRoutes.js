const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);

// ===== GET - قائمة الحساسات =====
router.get('/', async (req, res) => {
  try {
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    const sensors = await Sensor.find({
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Sensors retrieved successfully',
      data: sensors,
      count: sensors.length
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
    const userId = req.user.id;

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
      specifications,
      companyId: bodyCompanyId
    } = req.body;

    // ✅ استخدم companyId من الـ Body لو موجود، وإلا استخدم من الـ Request
    const companyId = bodyCompanyId || req.companyId;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ التحقق من صحة companyId
    if (!companyId.startsWith('comp_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must start with "comp_"'
      });
    }

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
      type: finalType, // ✅ استخدام النوع الصحيح
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
    
    // ✅ تحسين رسائل الخطأ
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
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
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

// ===== PUT - تحديث حساس =====
router.put('/:id', async (req, res) => {
  try {
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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
      // ✅ تطبيع النوع عند التحديث
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
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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