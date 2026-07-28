// modules/ai/routes/AIRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const axios = require('axios');
const logger = require('../../../core/utils/logger');

// ✅ AI Service Base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://ai-eco-service-production.up.railway.app';

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== Health Check =====
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    res.json(response.data);
  } catch (error) {
    logger.error('❌ AI Health check failed:', error.message);
    res.status(503).json({
      success: false,
      message: 'AI Service unavailable',
      error: error.message
    });
  }
});

// ===== 1. Detect Anomalies =====
router.post('/detect/anomalies', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { sensorId, readings, threshold } = req.body;

    if (!sensorId) {
      return res.status(400).json({
        success: false,
        message: 'sensorId is required'
      });
    }

    // جلب القراءات من MongoDB
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    let sensorReadings = readings;

    if (!sensorReadings) {
      const dbReadings = await SensorReading.find({
        sensorId,
        companyId,
        deletedAt: null
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
      
      sensorReadings = dbReadings.map(r => ({
        timestamp: r.timestamp,
        value: r.value
      }));
    }

    // ✅ إرسال للـ AI Service (المسار الصحيح)
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/detect/anomalies`,
      {
        sensorId,
        readings: sensorReadings,
        threshold: threshold || 1.5
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Anomaly detection completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Anomaly detection error:', error.message);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: 'AI Service unavailable',
        error: 'Cannot connect to AI service'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error detecting anomalies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 2. Predict Maintenance =====
router.post('/predict/maintenance', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { machineId, features } = req.body;

    if (!machineId) {
      return res.status(400).json({
        success: false,
        message: 'machineId is required'
      });
    }

    // جلب بيانات الماكينة
    const Machine = require('../../machines/models/Machine.model');
    const machine = await Machine.findOne({
      _id: machineId,
      companyId,
      deletedAt: null
    });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    // جلب القراءات
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const readings = await SensorReading.find({
      machineId,
      companyId,
      deletedAt: null
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

    const featuresData = features || {
      temperature: readings.length > 0 ? readings[0].value : 0,
      vibration: 0.002,
      rpm: 1450,
      hoursOperated: machine.hoursOperated || 0,
      pressure: 5.2,
      oilLevel: 80
    };

    const historicalFailures = machine.maintenance?.maintenanceHistory || [];

    // ✅ إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/predict/maintenance`,
      {
        machineId,
        features: featuresData,
        historicalFailures
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Maintenance prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Maintenance prediction error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error predicting maintenance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 3. Predict Consumption =====
router.post('/predict/consumption', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { factoryId, metric, period, historicalData } = req.body;

    if (!factoryId) {
      return res.status(400).json({
        success: false,
        message: 'factoryId is required'
      });
    }

    // جلب البيانات التاريخية
    let data = historicalData;
    if (!data) {
      const SensorReading = require('../../sensorReadings/models/SensorReading.model');
      const readings = await SensorReading.find({
        factoryId,
        companyId,
        deletedAt: null
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
      
      data = readings.map(r => ({
        date: r.timestamp.toISOString().split('T')[0],
        value: r.value
      }));
    }

    // ✅ إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/predict/consumption`,
      {
        factoryId,
        metric: metric || 'energy',
        period: period || 'next_30_days',
        historicalData: data
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Consumption prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Consumption prediction error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error predicting consumption',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 4. Generate Recommendations =====
router.post('/generate/recommendations', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { factoryId, machineId } = req.body;

    // جلب بيانات المصنع
    const Factory = require('../../factories/models/Factory.model');
    const factory = await Factory.findOne({
      _id: factoryId,
      companyId,
      deletedAt: null
    });

    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    // جلب القراءات
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const query = { companyId, deletedAt: null };
    if (factoryId) query.factoryId = factoryId;
    if (machineId) query.machineId = machineId;

    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    // ✅ إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/generate/recommendations`,
      {
        factoryId,
        machineId,
        readings,
        factoryData: factory
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Recommendations generated successfully',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Recommendations error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error generating recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 5. Detect Leaks =====
router.post('/detect/leaks', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { sensorId, readings, expectedFlow, threshold } = req.body;

    if (!sensorId || !readings) {
      return res.status(400).json({
        success: false,
        message: 'sensorId and readings are required'
      });
    }

    // ✅ إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/detect/leaks`,
      {
        sensorId,
        readings,
        expectedFlow: expectedFlow || 100,
        threshold: threshold || 3.0
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Leak detection completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Leak detection error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error detecting leaks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 6. Predict Carbon =====
router.post('/predict/carbon', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { factoryId, period, historicalData } = req.body;

    if (!factoryId) {
      return res.status(400).json({
        success: false,
        message: 'factoryId is required'
      });
    }

    // جلب البيانات التاريخية
    let data = historicalData;
    if (!data) {
      const SensorReading = require('../../sensorReadings/models/SensorReading.model');
      const readings = await SensorReading.find({
        factoryId,
        companyId,
        deletedAt: null
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
      
      data = readings.map(r => ({
        date: r.timestamp.toISOString().split('T')[0],
        value: r.value
      }));
    }

    // ✅ إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/predict/carbon`,
      {
        factoryId,
        period: period || 'next_30_days',
        historicalData: data
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Carbon prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Carbon prediction error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error predicting carbon emissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;