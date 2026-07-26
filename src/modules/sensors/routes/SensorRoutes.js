const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor.model');
const { authMiddleware } = require('../../../core/middleware/auth'); // ✅ استيراد الـ middleware

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);

// ===== GET - قائمة الحساسات =====
router.get('/', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
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
    res.status(500).json({
      success: false,
      message: 'Error fetching sensors',
      error: error.message
    });
  }
});

// ===== POST - إنشاء حساس جديد =====
router.post('/', async (req, res) => {
  try {
    // ✅ قراءة companyId و userId من req (من الـ middleware)
    const companyId = req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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

    // ===== إنشاء الحساس مع companyId =====
    const newSensor = new Sensor({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      type,
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
      // ✅ إضافة الحقول المطلوبة
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
    console.error('❌ Error creating sensor:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sensor',
      error: error.message
    });
  }
});

// ===== GET - حساس بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
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
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor',
      error: error.message
    });
  }
});

// ===== PUT - تحديث حساس =====
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
    if (type) sensor.type = type;
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
    res.status(500).json({
      success: false,
      message: 'Error updating sensor',
      error: error.message
    });
  }
});

// ===== DELETE - حذف حساس (Soft Delete) =====
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
    res.status(500).json({
      success: false,
      message: 'Error deleting sensor',
      error: error.message
    });
  }
});

module.exports = router;