const express = require('express');
const router = express.Router();
const aiService = require('../../../core/services/AIService');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { sendResponse, sendError } = require('../../../core/utils/response');
const logger = require('../../../core/utils/logger');

// ============ MIDDLEWARE ============
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ HEALTH CHECK ============
router.get('/health', async (req, res) => {
  try {
    const result = await aiService.healthCheck();
    return sendResponse(res, 200, 'AI Service health check', result);
  } catch (error) {
    logger.error('AI health check error:', error);
    return sendError(res, 500, 'Error checking AI service');
  }
});

// ============ 1️⃣ PREDICT CONSUMPTION ============
router.post('/predict/consumption', async (req, res) => {
  try {
    const result = await aiService.predictConsumption(req.body);
    return sendResponse(res, 200, 'Consumption prediction completed', result);
  } catch (error) {
    logger.error('Consumption prediction error:', error);
    return sendError(res, 500, 'Error predicting consumption');
  }
});

// ============ 2️⃣ DETECT LEAK ============
router.post('/detect/leak', async (req, res) => {
  try {
    const result = await aiService.detectLeak(req.body);
    return sendResponse(res, 200, 'Leak detection completed', result);
  } catch (error) {
    logger.error('Leak detection error:', error);
    return sendError(res, 500, 'Error detecting leak');
  }
});

// ============ 3️⃣ DETECT ANOMALIES ============
router.post('/detect/anomalies', async (req, res) => {
  try {
    const result = await aiService.detectAnomalies(req.body);
    return sendResponse(res, 200, 'Anomaly detection completed', result);
  } catch (error) {
    logger.error('Anomaly detection error:', error);
    return sendError(res, 500, 'Error detecting anomalies');
  }
});

// ============ 4️⃣ PREDICT MAINTENANCE ============
router.post('/predict/maintenance', async (req, res) => {
  try {
    const result = await aiService.predictMaintenance(req.body);
    return sendResponse(res, 200, 'Maintenance prediction completed', result);
  } catch (error) {
    logger.error('Maintenance prediction error:', error);
    return sendError(res, 500, 'Error predicting maintenance');
  }
});

// ============ 5️⃣ HEAT RECOVERY ============
router.post('/analyze/heat-recovery', async (req, res) => {
  try {
    const result = await aiService.analyzeHeatRecovery(req.body);
    return sendResponse(res, 200, 'Heat recovery analysis completed', result);
  } catch (error) {
    logger.error('Heat recovery analysis error:', error);
    return sendError(res, 500, 'Error analyzing heat recovery');
  }
});

// ============ 6️⃣ RECOMMENDATIONS ============
router.post('/generate/recommendations', async (req, res) => {
  try {
    const result = await aiService.generateRecommendations(req.body);
    return sendResponse(res, 200, 'Recommendations generated', result);
  } catch (error) {
    logger.error('Recommendations generation error:', error);
    return sendError(res, 500, 'Error generating recommendations');
  }
});

// ============ 7️⃣ PREDICT CARBON ============
router.post('/predict/carbon', async (req, res) => {
  try {
    const result = await aiService.predictCarbon(req.body);
    return sendResponse(res, 200, 'Carbon prediction completed', result);
  } catch (error) {
    logger.error('Carbon prediction error:', error);
    return sendError(res, 500, 'Error predicting carbon');
  }
});

// ============ 8️⃣ INDUSTRIAL MATCHING ============
router.post('/match/industrial', async (req, res) => {
  try {
    const result = await aiService.findIndustrialMatch(req.body);
    return sendResponse(res, 200, 'Industrial matching completed', result);
  } catch (error) {
    logger.error('Industrial matching error:', error);
    return sendError(res, 500, 'Error finding industrial match');
  }
});

// ============ 9️⃣ FINANCIAL IMPACT ============
router.post('/analyze/financial', async (req, res) => {
  try {
    const result = await aiService.analyzeFinancialImpact(req.body);
    return sendResponse(res, 200, 'Financial impact analysis completed', result);
  } catch (error) {
    logger.error('Financial impact analysis error:', error);
    return sendError(res, 500, 'Error analyzing financial impact');
  }
});

// ============ WHAT-IF ANALYSIS ============
router.post('/analyze/whatif', async (req, res) => {
  try {
    const result = await aiService.whatIfAnalysis(req.body);
    return sendResponse(res, 200, 'What-if analysis completed', result);
  } catch (error) {
    logger.error('What-if analysis error:', error);
    return sendError(res, 500, 'Error performing what-if analysis');
  }
});

module.exports = router;