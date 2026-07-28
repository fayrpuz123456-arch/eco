const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة الآلات =====
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

    const { page = 1, limit = 10, factoryId, departmentId, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ بناء الـ Query
    const query = { companyId, deletedAt: null };
    if (factoryId) query.factoryId = factoryId;
    if (departmentId) query.departmentId = departmentId;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const [machines, total] = await Promise.all([
      Machine.find(query)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Machine.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      message: 'Machines retrieved successfully',
      data: machines,
      count: machines.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + machines.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('❌ GET /machines error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلات حسب المصنع =====
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

    const machines = await Machine.find({
      factoryId: req.params.factoryId,
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Machines by factory retrieved successfully',
      data: machines,
      count: machines.length
    });
  } catch (error) {
    logger.error('❌ GET /machines/factory/:factoryId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines by factory',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلات حسب القسم =====
router.get('/department/:departmentId', async (req, res) => {
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

    const machines = await Machine.find({
      departmentId: req.params.departmentId,
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Machines by department retrieved successfully',
      data: machines,
      count: machines.length
    });
  } catch (error) {
    logger.error('❌ GET /machines/department/:departmentId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines by department',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلات حسب خط الإنتاج =====
router.get('/production-line/:productionLineId', async (req, res) => {
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

    const machines = await Machine.find({
      productionLineId: req.params.productionLineId,
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Machines by production line retrieved successfully',
      data: machines,
      count: machines.length
    });
  } catch (error) {
    logger.error('❌ GET /machines/production-line/:productionLineId error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines by production line',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء آلة جديدة =====
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

    const { 
      name, 
      code, 
      type, 
      factoryId, 
      departmentId, 
      productionLineId,
      model, 
      serialNumber,
      description,
      manufacturer,
      operationalStatus,
      specifications,
      yearOfManufacture,
      installationDate,
      warrantyExpiry
    } = req.body;

    // ===== التحقق من الحقول المطلوبة =====
    if (!name || !code || !type || !factoryId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, factoryId, and departmentId are required'
      });
    }

    // ✅ التحقق من صحة الكود (حروف كبيرة وأرقام فقط)
    if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Code must contain only uppercase letters and numbers'
      });
    }

    // ===== التحقق من عدم وجود آلة بنفس الكود =====
    const existingMachine = await Machine.findOne({ 
      code: code.toUpperCase(), 
      factoryId,
      companyId,
      deletedAt: null 
    });
    
    if (existingMachine) {
      return res.status(409).json({
        success: false,
        message: `Machine with code "${code}" already exists in this factory`
      });
    }

    // ===== إنشاء الآلة =====
    const newMachine = new Machine({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      type,
      factoryId,
      departmentId,
      productionLineId: productionLineId || null,
      model: model || null,
      serialNumber: serialNumber || null,
      description: description || null,
      manufacturer: manufacturer || null,
      operationalStatus: operationalStatus || 'idle',
      specifications: specifications || {},
      yearOfManufacture: yearOfManufacture || null,
      installationDate: installationDate || null,
      warrantyExpiry: warrantyExpiry || null,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      status: 'active'
    });

    const savedMachine = await newMachine.save();

    res.status(201).json({
      success: true,
      message: 'Machine created successfully',
      data: savedMachine
    });
  } catch (error) {
    logger.error('❌ POST /machines error:', error);
    
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
        message: 'Machine with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلة بالمعرف =====
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

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    res.json({
      success: true,
      message: 'Machine retrieved successfully',
      data: machine
    });
  } catch (error) {
    logger.error('❌ GET /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلة بالكود =====
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
    const machine = await Machine.findOne({
      code,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    res.json({
      success: true,
      message: 'Machine retrieved successfully',
      data: machine
    });
  } catch (error) {
    logger.error('❌ GET /machines/code/:code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machine by code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آلات حسب الحالة التشغيلية =====
router.get('/operational/:status', async (req, res) => {
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

    const validStatuses = ['online', 'offline', 'idle', 'maintenance', 'error'];
    if (!validStatuses.includes(req.params.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operational status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const machines = await Machine.find({
      operationalStatus: req.params.status,
      companyId,
      deletedAt: null
    }).select('-__v');

    res.json({
      success: true,
      message: 'Machines by operational status retrieved successfully',
      data: machines,
      count: machines.length
    });
  } catch (error) {
    logger.error('❌ GET /machines/operational/:status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines by operational status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - إحصائيات الآلات =====
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

    const [total, active, inactive, online, offline, idle, maintenance, error] = await Promise.all([
      Machine.countDocuments({ companyId, deletedAt: null }),
      Machine.countDocuments({ companyId, status: 'active', deletedAt: null }),
      Machine.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
      Machine.countDocuments({ companyId, operationalStatus: 'online', deletedAt: null }),
      Machine.countDocuments({ companyId, operationalStatus: 'offline', deletedAt: null }),
      Machine.countDocuments({ companyId, operationalStatus: 'idle', deletedAt: null }),
      Machine.countDocuments({ companyId, operationalStatus: 'maintenance', deletedAt: null }),
      Machine.countDocuments({ companyId, operationalStatus: 'error', deletedAt: null })
    ]);

    res.json({
      success: true,
      message: 'Machine statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        operational: {
          online,
          offline,
          idle,
          maintenance,
          error
        }
      }
    });
  } catch (error) {
    logger.error('❌ GET /machines/stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machine statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث آلة =====
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

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    // ✅ منع تحديث الحقول الحساسة
    delete req.body.companyId;
    delete req.body.factoryId;
    delete req.body.departmentId;
    delete req.body.code;

    const { 
      name, 
      type, 
      model, 
      serialNumber, 
      description,
      operationalStatus,
      specifications,
      status,
      productionLineId,
      yearOfManufacture,
      installationDate,
      warrantyExpiry
    } = req.body;

    if (name) machine.name = name.trim();
    if (type) machine.type = type;
    if (model) machine.model = model.trim();
    if (serialNumber) machine.serialNumber = serialNumber.trim();
    if (description !== undefined) machine.description = description ? description.trim() : null;
    if (operationalStatus) machine.operationalStatus = operationalStatus;
    if (specifications) machine.specifications = specifications;
    if (status) machine.status = status;
    if (productionLineId !== undefined) machine.productionLineId = productionLineId;
    if (yearOfManufacture) machine.yearOfManufacture = yearOfManufacture;
    if (installationDate) machine.installationDate = new Date(installationDate);
    if (warrantyExpiry) machine.warrantyExpiry = new Date(warrantyExpiry);

    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const updatedMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: updatedMachine
    });
  } catch (error) {
    logger.error('❌ PUT /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PATCH - تحديث جزئي لآلة =====
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
    delete updates.factoryId;
    delete updates.departmentId;
    delete updates.code;

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    Object.keys(updates).forEach(key => {
      if (key === 'name') updates[key] = updates[key].trim();
      if (key === 'model') updates[key] = updates[key].trim();
      if (key === 'serialNumber') updates[key] = updates[key].trim();
      if (key === 'description') updates[key] = updates[key] ? updates[key].trim() : null;
      if (key === 'installationDate' || key === 'warrantyExpiry') {
        updates[key] = new Date(updates[key]);
      }
      machine[key] = updates[key];
    });

    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const updatedMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: updatedMachine
    });
  } catch (error) {
    logger.error('❌ PATCH /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف آلة (Soft Delete) =====
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

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    // ✅ التحقق من وجود حساسات تابعة للآلة
    const { default: Sensor } = require('../sensors/models/Sensor.model');
    const sensorsCount = await Sensor.countDocuments({ machineId: machine._id, deletedAt: null });
    
    if (sensorsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete machine. It has ${sensorsCount} associated sensor(s)`
      });
    }

    machine.deletedAt = new Date();
    machine.deletedBy = userId;
    machine.status = 'archived';
    await machine.save();

    res.json({
      success: true,
      message: 'Machine deleted successfully'
    });
  } catch (error) {
    logger.error('❌ DELETE /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - استعادة آلة محذوفة =====
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
        message: 'Access denied. Only administrators can restore machines.'
      });
    }

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: { $ne: null }
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Deleted machine not found'
      });
    }

    machine.deletedAt = null;
    machine.deletedBy = null;
    machine.status = 'active';
    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const restoredMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine restored successfully',
      data: restoredMachine
    });
  } catch (error) {
    logger.error('❌ POST /machines/:id/restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث حالة الآلة =====
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

    const validStatuses = ['active', 'inactive', 'maintenance', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    machine.status = status;
    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const updatedMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine status updated successfully',
      data: updatedMachine
    });
  } catch (error) {
    logger.error('❌ PUT /machines/:id/status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating machine status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث الحالة التشغيلية =====
router.put('/:id/operational', async (req, res) => {
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

    const { operationalStatus } = req.body;

    if (!operationalStatus) {
      return res.status(400).json({
        success: false,
        message: 'Operational status is required'
      });
    }

    const validStatuses = ['online', 'offline', 'idle', 'maintenance', 'error'];
    if (!validStatuses.includes(operationalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operational status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const machine = await Machine.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    machine.operationalStatus = operationalStatus;
    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const updatedMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine operational status updated successfully',
      data: updatedMachine
    });
  } catch (error) {
    logger.error('❌ PUT /machines/:id/operational error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating machine operational status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;