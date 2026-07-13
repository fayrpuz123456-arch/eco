const express = require('express');
const router = express.Router();
const SensorReading = require('../models/SensorReading.model');

// ===== POST - إضافة قراءة جديدة =====
router.post('/', async (req, res) => {
  try {
    const { sensorId, value, unit, timestamp, quality } = req.body;

    if (!sensorId || value === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: 'sensorId, value, and unit are required'
      });
    }

    const newReading = new SensorReading({
      sensorId,
      value,
      unit,
      timestamp: timestamp || new Date(),
      quality: quality || 'good'
    });

    const savedReading = await newReading.save();

    res.status(201).json({
      success: true,
      message: 'Sensor reading added successfully',
      data: savedReading
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding sensor reading',
      error: error.message
    });
  }
});

// ===== GET - قراءات حساس معين =====
router.get('/sensor/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { limit = 100, from, to } = req.query;

    const query = { sensorId };
    if (from) query.timestamp = { $gte: new Date(from) };
    if (to) query.timestamp = { ...query.timestamp, $lte: new Date(to) };

    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Readings retrieved successfully',
      data: readings,
      count: readings.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching readings',
      error: error.message
    });
  }
});

// ===== GET - آخر قراءة لحساس =====
router.get('/last/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const reading = await SensorReading.findOne({ sensorId })
      .sort({ timestamp: -1 });

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: 'No readings found for this sensor'
      });
    }

    res.json({
      success: true,
      message: 'Last reading retrieved successfully',
      data: reading
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching last reading',
      error: error.message
    });
  }
});

// ===== GET - إحصائيات قراءات =====
router.get('/stats/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { from, to } = req.query;

    const query = { sensorId };
    if (from) query.timestamp = { $gte: new Date(from) };
    if (to) query.timestamp = { ...query.timestamp, $lte: new Date(to) };

    const readings = await SensorReading.find(query);

    if (readings.length === 0) {
      return res.json({
        success: true,
        message: 'No readings found',
        data: {
          count: 0,
          avg: 0,
          min: 0,
          max: 0,
          lastValue: null
        }
      });
    }

    const values = readings.map(r => r.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        count: readings.length,
        avg: parseFloat(avg.toFixed(2)),
        min: Math.min(...values),
        max: Math.max(...values),
        lastValue: readings[0]?.value || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

module.exports = router;