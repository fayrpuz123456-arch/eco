// modules/ai/routes/AIRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const axios = require('axios');
const logger = require('../../../core/utils/logger');

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== Health Check للـ AI Service =====
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.AI_SERVICE_URL}/health`);
    res.json(response.data);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'AI Service unavailable',
      error: error.message
    });
  }
});

// ===== 1. تحليل قراءات الحساسات (Anomaly Detection) =====
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

    // جلب القراءات من MongoDB لو مش موجودة في الـ Request
    let sensorReadings = readings;
    if (!sensorReadings) {
      const SensorReading = require('../../sensorReadings/models/SensorReading.model');
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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/detect/anomalies`,
      {
        sensorId,
        readings: sensorReadings,
        threshold: threshold || 1.5
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'Anomaly detection completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Anomaly detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Error detecting anomalies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 2. توقع الصيانة =====
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

    // جلب قراءات الماكينة
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const readings = await SensorReading.find({
      machineId,
      companyId,
      deletedAt: null
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

    // بناء الـ features
    const featuresData = features || {
      temperature: readings.length > 0 ? readings[0].value : 0,
      vibration: 0.002,
      rpm: 1450,
      hoursOperated: machine.hoursOperated || 0,
      pressure: 5.2,
      oilLevel: 80
    };

    // جلب تاريخ الأعطال (لو موجود)
    const historicalFailures = machine.maintenance?.maintenanceHistory || [];

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/predict/maintenance`,
      {
        machineId,
        features: featuresData,
        historicalFailures
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'Maintenance prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Maintenance prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error predicting maintenance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 3. تحليل استهلاك الطاقة =====
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

    // جلب البيانات التاريخية من MongoDB لو مش موجودة
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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/predict/consumption`,
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
        }
      }
    );

    res.json({
      success: true,
      message: 'Consumption prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Consumption prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error predicting consumption',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 4. كشف التسريبات =====
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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/detect/leaks`,
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
        }
      }
    );

    res.json({
      success: true,
      message: 'Leak detection completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Leak detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Error detecting leaks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 5. توليد توصيات =====
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

    // جلب قراءات المصنع
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const query = { companyId, deletedAt: null };
    if (factoryId) query.factoryId = factoryId;
    if (machineId) query.machineId = machineId;

    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/generate/recommendations`,
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
        }
      }
    );

    res.json({
      success: true,
      message: 'Recommendations generated successfully',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 6. توقع انبعاثات الكربون =====
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
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const readings = await SensorReading.find({
      factoryId,
      companyId,
      deletedAt: null
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

    const data = historicalData || readings.map(r => ({
      date: r.timestamp.toISOString().split('T')[0],
      value: r.value
    }));

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/predict/carbon`,
      {
        factoryId,
        period: period || 'next_30_days',
        historicalData: data
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'Carbon prediction completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Carbon prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error predicting carbon emissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 7. تحليل What-If =====
router.post('/analyze/whatif', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { scenario, variables, factoryId } = req.body;

    if (!scenario || !variables) {
      return res.status(400).json({
        success: false,
        message: 'scenario and variables are required'
      });
    }

    // جلب بيانات المصنع
    const Factory = require('../../factories/models/Factory.model');
    const factory = await Factory.findOne({
      _id: factoryId,
      companyId,
      deletedAt: null
    });

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/analyze/whatif`,
      {
        scenario,
        variables,
        factoryData: factory
      },
      {
        headers: {
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: 'What-If analysis completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ What-If analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing What-If analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;