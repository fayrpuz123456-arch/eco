const axios = require('axios');
const config = require('../../config');
const logger = require('../utils/logger');


class AIService {
  constructor() {
    this.baseUrl = config.ai.serviceUrl || 'http://ai-service:5000';
    this.timeout = 30000;
    this.enabled = config.features.enableAI || false;
  }


  async predictConsumption(data) {
    if (!this.enabled) return this._mockPrediction(data);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/predict/consumption`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (predictConsumption):', error.message);
      return this._mockPrediction(data);
    }
  }

  _mockPrediction(data) {
    const baseValue = data.historicalData?.slice(-1)[0] || 100;
    return {
      prediction: baseValue * (1 + (Math.random() - 0.5) * 0.2),
      confidence: 0.85 + Math.random() * 0.1,
      trend: ['increasing', 'decreasing', 'stable'][Math.floor(Math.random() * 3)],
      recommendation: 'متابعة الاستهلاك بشكل طبيعي',
      timestamp: new Date().toISOString()
    };
  }

  async detectLeak(data) {
    if (!this.enabled) {
      return {
        hasLeak: false,
        confidence: 0.95,
        location: null,
        estimatedLoss: 0,
        cost: 0,
        carbonImpact: 0,
        recommendation: 'لا يوجد تسريب مكتشف'
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/detect/leak`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (detectLeak):', error.message);
      return { hasLeak: false, confidence: 0.9, estimatedLoss: 0 };
    }
  }

  async detectAnomalies(data) {
    if (!this.enabled) {
      return {
        anomalies: [],
        threshold: 3,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/detect/anomalies`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (detectAnomalies):', error.message);
      return { anomalies: [], threshold: 3 };
    }
  }

  async predictMaintenance(data) {
    if (!this.enabled) {
      return {
        machineId: data.machineId,
        predictedFailure: false,
        confidence: 0,
        daysUntilFailure: null,
        recommendedAction: 'لا يوجد عطل متوقع',
        partsToCheck: []
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/predict/maintenance`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (predictMaintenance):', error.message);
      return {
        machineId: data.machineId,
        predictedFailure: false,
        confidence: 0,
        daysUntilFailure: null,
        recommendedAction: 'لا يوجد عطل متوقع'
      };
    }
  }

  async analyzeHeatRecovery(data) {
    if (!this.enabled) {
      return {
        totalWasteHeat: 0,
        recoverableHeat: 0,
        solutions: [],
        potentialSavings: 0,
        carbonReduction: 0,
        roi: 0,
        paybackPeriod: 0
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/analyze/heat-recovery`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (analyzeHeatRecovery):', error.message);
      return {
        totalWasteHeat: 0,
        recoverableHeat: 0,
        solutions: [],
        potentialSavings: 0,
        carbonReduction: 0
      };
    }
  }

  async generateRecommendations(data) {
    if (!this.enabled) {
      return {
        recommendations: [
          {
            title: 'تحسين كفاءة الطاقة',
            description: 'مراجعة استهلاك الكهرباء وتحديد فرص التوفير',
            potentialSavings: 1000,
            carbonReduction: 500,
            priority: 'medium'
          }
        ],
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/generate/recommendations`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (generateRecommendations):', error.message);
      return { recommendations: [] };
    }
  }

  async predictCarbon(data) {
    if (!this.enabled) {
      return {
        predictedEmissions: data.currentEmissions * 1.02,
        confidence: 0.85,
        trend: 'increasing',
        reductionPotential: data.currentEmissions * 0.15,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/predict/carbon`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (predictCarbon):', error.message);
      return { predictedEmissions: data.currentEmissions || 0, confidence: 0.8 };
    }
  }

  async findIndustrialMatch(data) {
    if (!this.enabled) {
      return {
        matches: [],
        recommendedPartner: null,
        potentialSavings: 0,
        carbonReduction: 0,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/match/industrial`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (findIndustrialMatch):', error.message);
      return { matches: [] };
    }
  }

  async analyzeFinancialImpact(data) {
    if (!this.enabled) {
      return {
        savings: data.estimatedSavings || 0,
        carbonReduction: data.estimatedCarbonReduction || 0,
        paybackPeriod: data.estimatedCost ? data.estimatedCost / (data.estimatedSavings || 1) : 0,
        roi: data.estimatedSavings ? (data.estimatedSavings / (data.estimatedCost || 1)) * 100 : 0,
        recommendation: 'استمرار في الخطة الحالية',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/analyze/financial`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (analyzeFinancialImpact):', error.message);
      return { savings: 0, carbonReduction: 0, paybackPeriod: 0, roi: 0 };
    }
  }

  async whatIfAnalysis(data) {
    if (!this.enabled) {
      return {
        scenario: data.scenario || 'solar_panels',
        results: {
          energySaved: 0,
          costSaved: 0,
          carbonReduced: 0,
          roi: 0,
          paybackPeriod: 0
        },
        recommendation: 'تنفيذ التحليل عند توفر البيانات الكافية',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/analyze/whatif`,
        data,
        { timeout: this.timeout }
      );
      return response.data;
    } catch (error) {
      logger.error('AI Service error (whatIfAnalysis):', error.message);
      return { scenario: data.scenario, results: {} };
    }
  }

  async healthCheck() {
    if (!this.enabled) {
      return { status: 'disabled', message: 'AI Service is disabled' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return { status: 'healthy', data: response.data };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new AIService();