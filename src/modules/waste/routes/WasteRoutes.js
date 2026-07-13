const express = require('express');
const router = express.Router();
const Waste = require('../models/Waste.model');

// ===== POST - إضافة سجل نفايات =====
router.post('/', async (req, res) => {
  try {
    const { factoryId, period, generation, disposal, recycling } = req.body;

    if (!factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'factoryId, period.startDate, and period.endDate are required'
      });
    }

    const newWaste = new Waste({
      factoryId,
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      generation: generation || { total: 0 },
      disposal: disposal || { landfill: 0, recycling: 0 },
      recycling: recycling || { rate: 0, revenue: 0 }
    });

    const savedWaste = await newWaste.save();

    res.status(201).json({
      success: true,
      message: 'Waste record created successfully',
      data: savedWaste
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating waste record',
      error: error.message
    });
  }
});

// ===== GET - سجلات النفايات لمصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    const { limit = 50 } = req.query;

    const records = await Waste.find({ factoryId })
      .sort({ 'period.startDate': -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Waste records retrieved successfully',
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching waste records',
      error: error.message
    });
  }
});

module.exports = router;