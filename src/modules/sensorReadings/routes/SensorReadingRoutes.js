const express = require('express');
const router = express.Router();
const SensorReading = require('../models/SensorReading.model');
const Sensor = require('../models/Sensor.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== POST - إضافة قراءة جديدة =====
router.post('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ التحقق من صحة companyId
    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { 
      sensorId, 
      value, 
      unit, 
      timestamp, 
      quality, 
      factoryId, 
      machineId,
      departmentId,
      productionLineId,
      metadata
    } = req.body;

    // ✅ التحقق من الحقول المطلوبة
    if (!sensorId || value === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: 'sensorId, value, and unit are required'
      });
    }

    // ✅ التحقق من وجود factoryId و machineId
    if (!factoryId) {
      return res.status(400).json({
        success: false,
        message: 'factoryId is required'
      });
    }

    if (!machineId) {
      return res.status(400).json({
        success: false,
        message: 'machineId is required'
      });
    }

    // ✅ إنشاء القراءة الجديدة
    const newReading = new SensorReading({
      sensorId,
      value: parseFloat(value),
      unit: unit.trim(),
      timestamp: timestamp || new Date(),
      quality: quality || 'good',
      companyId,
      factoryId,
      machineId,
      departmentId: departmentId || null,
      productionLineId: productionLineId || null,
      metadata: metadata || {},
      createdBy: userId,
      updatedBy: userId,
      status: 'active'
    });

    const savedReading = await newReading.save();

    // ✅ تحديث آخر قراءة في الـ Sensor
    try {
      await Sensor.updateOne(
        { _id: sensorId, companyId },
        {
          $set: {
            'readings.lastValue': parseFloat(value),
            'readings.lastReadingAt': new Date(),
            'readings.lastUpdated': new Date()
          },
          $inc: { 'readings.totalReadings': 1 },
          $min: { 'readings.minValue': parseFloat(value) },
          $max: { 'readings.maxValue': parseFloat(value) }
        }
      );
    } catch (updateError) {
      logger.warn('⚠️ Could not update sensor readings:', updateError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Sensor reading added successfully',
      data: savedReading
    });
  } catch (error) {
    logger.error('❌ Error adding sensor reading:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error adding sensor reading',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - قراءات حساس معين =====
router.get('/sensor/:sensorId', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { sensorId } = req.params;
    const { limit = 100, from, to, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { 
      sensorId,
      companyId,
      deletedAt: null 
    };
    
    if (from) query.timestamp = { $gte: new Date(from) };
    if (to) query.timestamp = { ...query.timestamp, $lte: new Date(to) };

    const [readings, total] = await Promise.all([
      SensorReading.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      SensorReading.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: 'Readings retrieved successfully',
      data: readings,
      count: readings.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + readings.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching readings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching readings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - آخر قراءة لحساس =====
router.get('/sensor/:sensorId/latest', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { sensorId } = req.params;

    const reading = await SensorReading.findOne({
      sensorId,
      companyId,
      deletedAt: null
    })
    .sort({ timestamp: -1 })
    .select('-__v');

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: 'No readings found for this sensor'
      });
    }

    res.json({
      success: true,
      message: 'Latest reading retrieved successfully',
      data: reading
    });
  } catch (error) {
    logger.error('❌ Error fetching latest reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest reading',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - قراءات ماكينة معينة =====
router.get('/machine/:machineId', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { machineId } = req.params;
    const { limit = 100, from, to, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      machineId,
      companyId,
      deletedAt: null
    };

    if (from) query.timestamp = { $gte: new Date(from) };
    if (to) query.timestamp = { ...query.timestamp, $lte: new Date(to) };

    const [readings, total] = await Promise.all([
      SensorReading.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      SensorReading.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: 'Machine readings retrieved successfully',
      data: readings,
      count: readings.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + readings.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching machine readings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machine readings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - قراءة بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const reading = await SensorReading.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    }).select('-__v');

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: 'Reading not found'
      });
    }

    res.json({
      success: true,
      message: 'Reading retrieved successfully',
      data: reading
    });
  } catch (error) {
    logger.error('❌ Error fetching reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reading',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - إحصائيات قراءات حساس =====
router.get('/stats/:sensorId', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const { sensorId } = req.params;
    const { from, to } = req.query;

    const query = { 
      sensorId,
      companyId,
      deletedAt: null 
    };
    
    if (from) query.timestamp = { $gte: new Date(from) };
    if (to) query.timestamp = { ...query.timestamp, $lte: new Date(to) };

    const readings = await SensorReading.find(query).sort({ timestamp: -1 });

    if (readings.length === 0) {
      return res.json({
        success: true,
        message: 'No readings found',
        data: {
          count: 0,
          avg: 0,
          min: 0,
          max: 0,
          lastValue: null,
          lastReadingAt: null
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
        lastValue: readings[0]?.value || 0,
        lastReadingAt: readings[0]?.timestamp || null,
        firstReadingAt: readings[readings.length - 1]?.timestamp || null
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف قراءة (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const reading = await SensorReading.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: 'Reading not found'
      });
    }

    reading.deletedAt = new Date();
    reading.deletedBy = userId;
    reading.status = 'archived';
    await reading.save();

    res.json({
      success: true,
      message: 'Reading deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reading',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;