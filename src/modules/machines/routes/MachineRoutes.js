const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine.model');

// ===== GET - قائمة الآلات =====
router.get('/', async (req, res) => {
  try {
    const machines = await Machine.find({ deletedAt: null }).select('-__v');
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
    const { name, code, type, factoryId, departmentId, model, serialNumber } = req.body;

    if (!name || !code || !type || !factoryId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, factoryId, and departmentId are required'
      });
    }

    const existingMachine = await Machine.findOne({ code: code.toUpperCase(), factoryId });
    if (existingMachine) {
      return res.status(409).json({
        success: false,
        message: 'Machine with this code already exists in this factory'
      });
    }

    const newMachine = new Machine({
      name,
      code: code.toUpperCase(),
      type,
      factoryId,
      departmentId,
      model: model || null,
      serialNumber: serialNumber || null,
      status: 'active'
    });

    const savedMachine = await newMachine.save();

    res.status(201).json({
      success: true,
      message: 'Machine created successfully',
      data: savedMachine
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating machine',
      error: error.message
    });
  }
});

module.exports = router;