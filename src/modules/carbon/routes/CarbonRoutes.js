const express = require('express');
const router = express.Router();
const Carbon = require('../models/Carbon.model');

// ===== POST - إضافة سجل كربون =====
router.post('/', async (req, res) => {
  try {
    const { factoryId, period, scope1, scope2, scope3 } = req.body;

    if (!factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'factoryId, period.startDate, and period.endDate are required'
      });
    }

    const totalEmissions = (scope1?.total || 0) + (scope2?.total || 0) + (scope3?.total || 0);

    const newCarbon = new Carbon({
      factoryId,
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      emissions: {
        scope1: scope1 || { total: 0 },
        scope2: scope2 || { total: 0 },
        scope3: scope3 || { total: 0 },
        totalEmissions
      }
    });

    const savedCarbon = await newCarbon.save();

    res.status(201).json({
      success: true,
      message: 'Carbon record created successfully',
      data: savedCarbon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating carbon record',
      error: error.message
    });
  }
});

// ===== GET - سجلات الكربون لمصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    const { limit = 50 } = req.query;

    const records = await Carbon.find({ factoryId })
      .sort({ 'period.startDate': -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Carbon records retrieved successfully',
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching carbon records',
      error: error.message
    });
  }
});

module.exports = router;