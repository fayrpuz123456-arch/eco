const express = require('express');
const router = express.Router();
const Energy = require('../models/Energy.model');

// ===== POST - إضافة سجل طاقة =====
router.post('/', async (req, res) => {
  try {
    const { factoryId, period, consumption, cost } = req.body;

    if (!factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'factoryId, period.startDate, and period.endDate are required'
      });
    }

    const newEnergy = new Energy({
      factoryId,
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      consumption: consumption || { total: 0 },
      cost: cost || { total: 0 }
    });

    const savedEnergy = await newEnergy.save();

    res.status(201).json({
      success: true,
      message: 'Energy record created successfully',
      data: savedEnergy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating energy record',
      error: error.message
    });
  }
});

// ===== GET - سجلات الطاقة لمصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    const { limit = 50 } = req.query;

    const records = await Energy.find({ factoryId })
      .sort({ 'period.startDate': -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Energy records retrieved successfully',
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching energy records',
      error: error.message
    });
  }
});

module.exports = router;