// modules/ai/routes/AIRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const axios = require('axios');
const logger = require('../../../core/utils/logger');

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

// ===== 1. Predict Consumption =====
router.post('/predict/consumption', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { type, hours, historicalData, factoryId } = req.body;

    if (!factoryId) {
      return res.status(400).json({
        success: false,
        message: 'factoryId is required'
      });
    }

    // جلب البيانات التاريخية من MongoDB إذا لم تكن موجودة
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
      `${AI_SERVICE_URL}/api/v1/predict/consumption`,
      {
        type: type || 'electricity',
        hours: hours || 24,
        historicalData: data,
        factoryId
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error predicting consumption',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 2. Detect Leak =====
router.post('/detect/leak', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { sensorId, readings, threshold } = req.body;

    if (!sensorId || !readings) {
      return res.status(400).json({
        success: false,
        message: 'sensorId and readings are required'
      });
    }

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/detect/leak`,
      {
        sensorId,
        readings,
        threshold: threshold || 3
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error detecting leak',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 3. Detect Anomalies =====
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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/detect/anomalies`,
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error detecting anomalies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 4. Predict Maintenance =====
router.post('/predict/maintenance', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { machineId, readings, historicalFailures } = req.body;

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

    // جلب القراءات إذا لم تكن موجودة
    let readingsData = readings;
    if (!readingsData) {
      const SensorReading = require('../../sensorReadings/models/SensorReading.model');
      const dbReadings = await SensorReading.find({
        machineId,
        companyId,
        deletedAt: null
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
      
      readingsData = dbReadings.map(r => ({
        timestamp: r.timestamp,
        vibration: r.vibration || 0.002,
        temperature: r.value || 0,
        rpm: 1450
      }));
    }

    const historicalData = historicalFailures || machine.maintenance?.maintenanceHistory || [];

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/predict/maintenance`,
      {
        machineId,
        readings: readingsData,
        historicalFailures: historicalData
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error predicting maintenance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 5. Heat Recovery Analysis =====
router.post('/analyze/heat-recovery', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { heatSource, wasteHeat, recoverableHeat, factoryId } = req.body;

    if (!heatSource || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'heatSource and factoryId are required'
      });
    }

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/analyze/heat-recovery`,
      {
        heatSource,
        wasteHeat: wasteHeat || 5000,
        recoverableHeat: recoverableHeat || 3500,
        factoryId
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
      message: 'Heat recovery analysis completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Heat recovery analysis error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error analyzing heat recovery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 6. Generate Recommendations =====
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

    if (!factoryId) {
      return res.status(400).json({
        success: false,
        message: 'factoryId is required'
      });
    }

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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/generate/recommendations`,
      {
        factoryId,
        machineId: machineId || null,
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error generating recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 7. Predict Carbon =====
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

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/predict/carbon`,
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
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error predicting carbon emissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 8. Industrial Matching =====
router.post('/match/industrial', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { resourceType, quantity, unit, location } = req.body;

    if (!resourceType || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'resourceType and quantity are required'
      });
    }

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/match/industrial`,
      {
        resourceType,
        quantity,
        unit: unit || 'kWh',
        location: location || { city: 'Cairo', country: 'Egypt' },
        companyId
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
      message: 'Industrial matching completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Industrial matching error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error matching industrial resources',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 9. Financial Analysis =====
router.post('/analyze/financial', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { estimatedSavings, estimatedCost, timeframe, type } = req.body;

    if (!estimatedSavings || !estimatedCost) {
      return res.status(400).json({
        success: false,
        message: 'estimatedSavings and estimatedCost are required'
      });
    }

    // إرسال للـ AI Service
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/analyze/financial`,
      {
        estimatedSavings,
        estimatedCost,
        timeframe: timeframe || 5,
        type: type || 'energy_efficiency'
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
      message: 'Financial analysis completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ Financial analysis error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error performing financial analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== 10. What-If Analysis =====
router.post('/analyze/whatif', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    if (!companyId || !isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const { scenario, factoryId } = req.body;

    if (!scenario || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'scenario and factoryId are required'
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
      `${AI_SERVICE_URL}/api/v1/analyze/whatif`,
      {
        scenario,
        factoryId,
        factoryData: factory || null
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
      message: 'What-If analysis completed',
      data: aiResponse.data
    });

  } catch (error) {
    logger.error('❌ What-If analysis error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: 'AI Service error',
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error performing What-If analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;