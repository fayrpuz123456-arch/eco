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

// ===== GET - إحصائيات الحساسات =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
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

    // ✅ إحصائيات رئيسية
    const [total, active, inactive, online, offline, maintenance, error, calibrating] = await Promise.all([
      Sensor.countDocuments({ companyId, deletedAt: null }),
      Sensor.countDocuments({ companyId, status: 'active', deletedAt: null }),
      Sensor.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'online', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'offline', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'maintenance', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'error', deletedAt: null }),
      Sensor.countDocuments({ companyId, operationalStatus: 'calibrating', deletedAt: null })
    ]);

    // ✅ توزيع الحساسات حسب النوع
    const byType = await Sensor.aggregate([
      { $match: { companyId, deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // ✅ الحساسات التي تحتاج معايرة
    const needsCalibration = await Sensor.countDocuments({
      companyId,
      deletedAt: null,
      nextCalibrationDate: { $lte: new Date() },
      status: 'active'
    });

    res.json({
      success: true,
      message: 'Sensor statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        operational: {
          online,
          offline,
          maintenance,
          error,
          calibrating
        },
        byType,
        needsCalibration
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

// ===== GET - حساسات ماكينة معينة =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
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

// ===== GET - حساس بالكود =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
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

// ===== GET - قائمة الحساسات =====
router.get('/', async (req, res) => {
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

    const { type, status, operationalStatus, machineId, factoryId, search, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { companyId, deletedAt: null };
    if (type) query.type = type;
    if (status) query.status = status;
    if (operationalStatus) query.operationalStatus = operationalStatus;
    if (machineId) query.machineId = machineId;
    if (factoryId) query.factoryId = factoryId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { unit: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

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

// ===== GET - حساس بالمعرف =====
// ✅ لازم يكون في الآخر عشان منتصادش مع الـ Routes التانية
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

// ===== POST - إنشاء حساس جديد =====
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // ✅ استخدام getCompanyId
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
      specifications,
      calibrationInterval,
      installationDate,
      calibrationDate
    } = req.body;

    // ===== التحقق من الحقول المطلوبة =====
    if (!name || !code || !type || !unit || !machineId || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, unit, machineId, and factoryId are required'
      });
    }

    // ✅ التحقق من صحة الكود (حروف كبيرة وأرقام فقط)
    if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Code must contain only uppercase letters and numbers'
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

    // ===== حساب موعد المعايرة القادم =====
    let nextCalibrationDate = null;
    if (calibrationDate && calibrationInterval) {
      const nextDate = new Date(calibrationDate);
      nextDate.setDate(nextDate.getDate() + calibrationInterval);
      nextCalibrationDate = nextDate;
    }

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
      installationDate: installationDate || null,
      calibrationDate: calibrationDate || null,
      nextCalibrationDate: nextCalibrationDate,
      calibrationInterval: calibrationInterval || 365,
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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Sensor with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating sensor',
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
      status,
      calibrationDate,
      calibrationInterval
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
    if (calibrationDate) {
      sensor.calibrationDate = new Date(calibrationDate);
      if (calibrationInterval || sensor.calibrationInterval) {
        const interval = calibrationInterval || sensor.calibrationInterval;
        const nextDate = new Date(sensor.calibrationDate);
        nextDate.setDate(nextDate.getDate() + interval);
        sensor.nextCalibrationDate = nextDate;
      }
    }
    if (calibrationInterval) {
      sensor.calibrationInterval = calibrationInterval;
      if (sensor.calibrationDate) {
        const nextDate = new Date(sensor.calibrationDate);
        nextDate.setDate(nextDate.getDate() + calibrationInterval);
        sensor.nextCalibrationDate = nextDate;
      }
    }

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

// ===== PATCH - تحديث جزئي لحساس =====
router.patch('/:id', async (req, res) => {
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

    const updates = req.body;
    delete updates._id;
    delete updates.__v;
    delete updates.createdAt;
    delete updates.createdBy;
    delete updates.companyId;
    delete updates.machineId;
    delete updates.factoryId;
    delete updates.code;

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

    Object.keys(updates).forEach(key => {
      if (key === 'name') updates[key] = updates[key].trim();
      if (key === 'unit') updates[key] = updates[key].trim();
      if (key === 'description') updates[key] = updates[key] ? updates[key].trim() : null;
      if (key === 'calibrationDate') {
        updates[key] = new Date(updates[key]);
        if (sensor.calibrationInterval) {
          const nextDate = new Date(updates[key]);
          nextDate.setDate(nextDate.getDate() + sensor.calibrationInterval);
          sensor.nextCalibrationDate = nextDate;
        }
      }
      sensor[key] = updates[key];
    });

    sensor.updatedBy = userId;
    sensor.updatedAt = new Date();

    const updatedSensor = await sensor.save();

    res.json({
      success: true,
      message: 'Sensor updated successfully',
      data: updatedSensor
    });
  } catch (error) {
    logger.error('❌ PATCH /sensors/:id error:', error);
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

    // ✅ التحقق من وجود قراءات تابعة للحساس
    const { default: SensorReading } = require('../sensorReadings/models/SensorReading.model');
    const readingsCount = await SensorReading.countDocuments({ sensorId: sensor._id, deletedAt: null });
    
    if (readingsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete sensor. It has ${readingsCount} associated reading(s)`
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

// ===== POST - استعادة حساس محذوف =====
router.post('/:id/restore', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId
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
        message: 'Access denied. Only administrators can restore sensors.'
      });
    }

    const sensor = await Sensor.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: { $ne: null }
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Deleted sensor not found'
      });
    }

    sensor.deletedAt = null;
    sensor.deletedBy = null;
    sensor.status = 'active';
    sensor.updatedBy = userId;
    sensor.updatedAt = new Date();

    const restoredSensor = await sensor.save();

    res.json({
      success: true,
      message: 'Sensor restored successfully',
      data: restoredSensor
    });
  } catch (error) {
    logger.error('❌ POST /sensors/:id/restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث حالة الحساس =====
router.put('/:id/status', async (req, res) => {
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

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['active', 'inactive', 'maintenance', 'offline', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
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

    sensor.status = status;
    sensor.updatedBy = userId;
    sensor.updatedAt = new Date();

    const updatedSensor = await sensor.save();

    res.json({
      success: true,
      message: 'Sensor status updated successfully',
      data: updatedSensor
    });
  } catch (error) {
    logger.error('❌ PUT /sensors/:id/status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sensor status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - معايرة حساس =====
router.put('/:id/calibrate', async (req, res) => {
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

    const { calibrationDate, calibrationInterval } = req.body;

    if (!calibrationDate) {
      return res.status(400).json({
        success: false,
        message: 'calibrationDate is required'
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

    sensor.calibrationDate = new Date(calibrationDate);
    if (calibrationInterval) {
      sensor.calibrationInterval = calibrationInterval;
    }
    
    const nextDate = new Date(sensor.calibrationDate);
    nextDate.setDate(nextDate.getDate() + sensor.calibrationInterval);
    sensor.nextCalibrationDate = nextDate;
    sensor.operationalStatus = 'online';
    sensor.updatedBy = userId;
    sensor.updatedAt = new Date();

    const calibratedSensor = await sensor.save();

    res.json({
      success: true,
      message: 'Sensor calibrated successfully',
      data: calibratedSensor
    });
  } catch (error) {
    logger.error('❌ PUT /sensors/:id/calibrate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calibrating sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;