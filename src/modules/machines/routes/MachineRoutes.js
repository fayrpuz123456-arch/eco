const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);

// ===== GET - قائمة الآلات =====
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

    const machines = await Machine.find({ 
      companyId, 
      deletedAt: null 
    }).select('-__v');
    
    res.json({
      success: true,
      message: 'Machines retrieved successfully',
      data: machines,
      count: machines.length
    });
  } catch (error) {
    logger.error('GET /machines error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء آلة جديدة =====
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ استخدم companyId من الـ Body لو موجود، وإلا استخدم من الـ Request
    const companyId = req.body.companyId || req.companyId;

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
      specifications
    } = req.body;

    // ===== التحقق من الحقول المطلوبة =====
    if (!name || !code || !type || !factoryId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, factoryId, and departmentId are required'
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
        message: 'Machine with this code already exists in this factory'
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
      companyId, // ✅ استخدام companyId الصحيح
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
    logger.error('POST /machines error:', error);
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
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
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
    logger.error('GET /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث آلة =====
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

    // منع تحديث companyId و factoryId و departmentId
    delete req.body.companyId;
    delete req.body.factoryId;
    delete req.body.departmentId;

    const { 
      name, 
      type, 
      model, 
      serialNumber, 
      description,
      operationalStatus,
      specifications,
      status 
    } = req.body;

    if (name) machine.name = name.trim();
    if (type) machine.type = type;
    if (model) machine.model = model.trim();
    if (serialNumber) machine.serialNumber = serialNumber.trim();
    if (description !== undefined) machine.description = description ? description.trim() : null;
    if (operationalStatus) machine.operationalStatus = operationalStatus;
    if (specifications) machine.specifications = specifications;
    if (status) machine.status = status;

    machine.updatedBy = userId;
    machine.updatedAt = new Date();

    const updatedMachine = await machine.save();

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: updatedMachine
    });
  } catch (error) {
    logger.error('PUT /machines/:id error:', error);
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
    // استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
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

    machine.deletedAt = new Date();
    machine.deletedBy = userId;
    machine.status = 'archived';
    await machine.save();

    res.json({
      success: true,
      message: 'Machine deleted successfully'
    });
  } catch (error) {
    logger.error('DELETE /machines/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting machine',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;