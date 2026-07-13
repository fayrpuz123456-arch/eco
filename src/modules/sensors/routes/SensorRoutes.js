const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor.model');

// ===== GET - قائمة الحساسات =====
router.get('/', async (req, res) => {
  try {
    const sensors = await Sensor.find({ deletedAt: null }).select('-__v');
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
    const { name, code, type, unit, machineId, factoryId, departmentId } = req.body;

    if (!name || !code || !type || !unit || !machineId || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, type, unit, machineId, and factoryId are required'
      });
    }

    const existingSensor = await Sensor.findOne({ code: code.toUpperCase(), machineId });
    if (existingSensor) {
      return res.status(409).json({
        success: false,
        message: 'Sensor with this code already exists on this machine'
      });
    }

    const newSensor = new Sensor({
      name,
      code: code.toUpperCase(),
      type,
      unit,
      machineId,
      factoryId,
      departmentId: departmentId || null,
      status: 'active'
    });

    const savedSensor = await newSensor.save();

    res.status(201).json({
      success: true,
      message: 'Sensor created successfully',
      data: savedSensor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating sensor',
      error: error.message
    });
  }
});

module.exports = router;