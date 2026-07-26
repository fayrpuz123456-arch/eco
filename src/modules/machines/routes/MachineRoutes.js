const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine.model');
const { authMiddleware } = require('../../../core/middleware/auth'); // ✅ استيراد الـ middleware

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);

// ===== GET - قائمة الآلات =====
router.get('/', async (req, res) => {
  try {
    const companyId = req.companyId; // ✅ من الـ middleware
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
    res.status(500).json({
      success: false,
      message: 'Error fetching machines',
      error: error.message
    });
  }
});

// ===== POST - إنشاء آلة جديدة =====
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

    // ===== إنشاء الآلة مع companyId =====
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
      // ✅ إضافة الحقول المطلوبة
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
    console.error('❌ Error creating machine:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating machine',
      error: error.message
    });
  }
});

// ===== GET - آلة بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
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
    res.status(500).json({
      success: false,
      message: 'Error fetching machine',
      error: error.message
    });
  }
});

// ===== PUT - تحديث آلة =====
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
    res.status(500).json({
      success: false,
      message: 'Error updating machine',
      error: error.message
    });
  }
});

// ===== DELETE - حذف آلة (Soft Delete) =====
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
    res.status(500).json({
      success: false,
      message: 'Error deleting machine',
      error: error.message
    });
  }
});

module.exports = router;