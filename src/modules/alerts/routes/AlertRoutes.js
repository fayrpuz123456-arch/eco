const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert.model');

// ===== POST - إضافة تنبيه =====
router.post('/', async (req, res) => {
  try {
    const { name, type, severity, source, condition, factoryId } = req.body;

    if (!name || !type || !severity || !source || !condition || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'name, type, severity, source, condition, and factoryId are required'
      });
    }

    const newAlert = new Alert({
      name,
      type,
      severity,
      source,
      condition,
      factoryId,
      status: 'active',
      triggeredAt: new Date()
    });

    const savedAlert = await newAlert.save();

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: savedAlert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating alert',
      error: error.message
    });
  }
});

// ===== GET - تنبيهات مصنع =====
router.get('/factory/:factoryId', async (req, res) => {
  try {
    const { factoryId } = req.params;
    const { status, severity, limit = 50 } = req.query;

    const query = { factoryId };
    if (status) query.status = status;
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .sort({ triggeredAt: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Alerts retrieved successfully',
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
      error: error.message
    });
  }
});

// ===== PUT - تحديث حالة تنبيه =====
router.put('/:id', async (req, res) => {
  try {
    const { status, acknowledgedBy, resolutionNote } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    if (status) alert.status = status;
    if (acknowledgedBy) {
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
    }
    if (resolutionNote) alert.resolutionNote = resolutionNote;

    const updatedAlert = await alert.save();

    res.json({
      success: true,
      message: 'Alert updated successfully',
      data: updatedAlert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating alert',
      error: error.message
    });
  }
});

module.exports = router;