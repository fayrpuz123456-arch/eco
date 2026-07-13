const express = require('express');
const router = express.Router();
const Water = require('../models/Water.model');

// ===== POST - إضافة سجل مياه =====
router.post('/', async (req, res) => {
  try {
    const { factoryId, period, consumption, quality } = req.body;

    if (!factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'factoryId, period.startDate, and period.endDate are required'
      });
    }

    const newWater = new Water({
      factoryId,
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      consumption: consumption || { total: 0 },
      quality: quality || { score: 0 }
    });

    const savedWater = await newWater.save();

    res.status(201).json({
      success: true,
      message: 'Water record created successfully',
      data: savedWater
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating water record',
      error: error.message
    });
  }
});

// ===== GET - سجلات المياه لمصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    const { limit = 50 } = req.query;

    const records = await Water.find({ factoryId })
      .sort({ 'period.startDate': -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Water records retrieved successfully',
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching water records',
      error: error.message
    });
  }
});

module.exports = router;