const BaseController = require('../../../core/base/BaseController');
const EnergyService = require('../services/EnergyService');
const {
  sendResponse,
  sendError,
  sendPaginatedResponse,
  sendCreated,
  sendDeleted,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError
} = require('../../../core/utils/response');
const { validate } = require('../../../core/middleware/validation');
const { PERMISSIONS, checkPermissions, checkRole } = require('../../../core/middleware/permissions');
const logger = require('../../../core/utils/logger');
const Joi = require('joi');
const { idSchema } = require('../../../core/middleware/validation');

// ============ SCHEMAS ============

const createEnergySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'electricity', 'natural_gas', 'diesel', 'petrol',
    'kerosene', 'coal', 'biomass', 'solar', 'wind',
    'geothermal', 'hydro', 'total'
  ).required(),
  source: Joi.string().valid('grid', 'generator', 'solar', 'wind', 'battery', 'other').default('grid'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  period: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required()
  }).required(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateEnergySchema = createEnergySchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const updateConsumptionSchema = Joi.object({
  electricity: Joi.object({
    total: Joi.number().min(0).optional(),
    peak: Joi.number().min(0).optional(),
    offPeak: Joi.number().min(0).optional(),
    demand: Joi.number().min(0).optional(),
    powerFactor: Joi.number().min(0).max(1).optional()
  }).optional(),
  fuel: Joi.object({
    total: Joi.number().min(0).optional(),
    type: Joi.string().optional(),
    consumption: Joi.number().min(0).optional()
  }).optional(),
  gas: Joi.object({
    total: Joi.number().min(0).optional(),
    consumption: Joi.number().min(0).optional()
  }).optional(),
  renewable: Joi.object({
    total: Joi.number().min(0).optional(),
    solar: Joi.number().min(0).optional(),
    wind: Joi.number().min(0).optional(),
    biomass: Joi.number().min(0).optional()
  }).optional()
});

const updateCostSchema = Joi.object({
  electricity: Joi.number().min(0).optional(),
  fuel: Joi.number().min(0).optional(),
  gas: Joi.number().min(0).optional(),
  renewable: Joi.number().min(0).optional(),
  rate: Joi.number().min(0).optional(),
  savings: Joi.number().min(0).optional()
});

const updateTargetsSchema = Joi.object({
  consumptionReduction: Joi.number().min(0).max(100).required(),
  efficiencyImprovement: Joi.number().min(0).max(100).required(),
  renewableTarget: Joi.number().min(0).max(100).required(),
  targetYear: Joi.number().min(2020).required(),
  baseline: Joi.number().min(0).required(),
  baselineYear: Joi.number().min(2020).required()
});

const updateEfficiencySchema = Joi.object({
  overall: Joi.number().min(0).max(100).optional(),
  electricity: Joi.number().min(0).max(100).optional(),
  fuel: Joi.number().min(0).max(100).optional(),
  gas: Joi.number().min(0).max(100).optional(),
  renewable: Joi.number().min(0).max(100).optional(),
  target: Joi.number().min(0).max(100).optional()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json'),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const deleteEnergySchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class EnergyController extends BaseController {
  constructor() {
    super(new EnergyService(), 'Energy');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createEnergy(req.body, user.id, companyId);
      return sendCreated(res, 'Energy record created successfully', result);
    } catch (error) {
      logger.error('Create energy error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getEnergyRecordsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Energy records retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get energy list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getEnergyById(id, companyId);
      return sendResponse(res, 200, 'Energy record retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getEnergyByCode(code);
      return sendResponse(res, 200, 'Energy record retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByPeriod(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getEnergyByPeriod(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Energy records by period retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy by period error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { companyId } = req;
      const { type, startDate, endDate } = req.query;
      
      const result = await this.service.getEnergyByType(companyId, type, startDate, endDate);
      return sendResponse(res, 200, 'Energy records by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getByYear(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getEnergyByYear(companyId, parseInt(year));
      return sendResponse(res, 200, 'Energy records by year retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy by year error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotal(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCompanyTotalConsumption(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Company total consumption retrieved successfully', result);
    } catch (error) {
      logger.error('Get company total consumption error:', error);
      return this.handleError(res, error);
    }
  }

  async getDistribution(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getConsumptionDistribution(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Consumption distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get consumption distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getTrend(req, res) {
    try {
      const { companyId } = req;
      const months = parseInt(req.query.months) || 12;
      
      const result = await this.service.getConsumptionTrend(companyId, months);
      return sendResponse(res, 200, 'Consumption trend retrieved successfully', result);
    } catch (error) {
      logger.error('Get consumption trend error:', error);
      return this.handleError(res, error);
    }
  }

  async getYearly(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getYearlyConsumption(companyId, parseInt(year));
      return sendResponse(res, 200, 'Yearly consumption retrieved successfully', result);
    } catch (error) {
      logger.error('Get yearly consumption error:', error);
      return this.handleError(res, error);
    }
  }

  async getTopFactories(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getTopConsumingFactories(
        companyId,
        startDate,
        endDate,
        parseInt(limit) || 10
      );
      return sendResponse(res, 200, 'Top consuming factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get top consuming factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getEfficiencyStats(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getEfficiencyStats(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Efficiency statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get efficiency stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateEnergy(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Energy record updated successfully', result);
    } catch (error) {
      logger.error('Update energy error:', error);
      return this.handleError(res, error);
    }
  }

  async updateConsumption(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateConsumption(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Energy consumption updated successfully', result);
    } catch (error) {
      logger.error('Update consumption error:', error);
      return this.handleError(res, error);
    }
  }

  async updateCost(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateCost(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Energy cost updated successfully', result);
    } catch (error) {
      logger.error('Update cost error:', error);
      return this.handleError(res, error);
    }
  }

  async updateTargets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateTargets(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Energy targets updated successfully', result);
    } catch (error) {
      logger.error('Update targets error:', error);
      return this.handleError(res, error);
    }
  }

  async updateEfficiency(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateEfficiency(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Energy efficiency updated successfully', result);
    } catch (error) {
      logger.error('Update efficiency error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ RECOMMENDATIONS ============

  async generateRecommendations(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      
      const result = await this.service.generateRecommendations(id, companyId);
      return sendResponse(res, 200, 'Recommendations generated successfully', result);
    } catch (error) {
      logger.error('Generate recommendations error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DASHBOARD ============

  async getDashboard(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getEnergyDashboard(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Energy dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get energy dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteEnergy(id, user.id, companyId, reason);
      return sendDeleted(res, 'Energy record deleted successfully');
    } catch (error) {
      logger.error('Delete energy error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportEnergyData(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=energy_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Energy data exported successfully', data);
    } catch (error) {
      logger.error('Export energy error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ ERROR HANDLER ============

  handleError(res, error) {
    switch (error.constructor.name) {
      case 'ValidationError':
        return sendValidationError(res, error.message, error.errors);
      case 'NotFoundError':
        return sendNotFound(res, error.message);
      case 'ConflictError':
        return sendConflict(res, error.message);
      case 'UnauthorizedError':
        return sendUnauthorized(res, error.message);
      case 'ForbiddenError':
        return sendForbidden(res, error.message);
      default:
        return sendError(res, error.statusCode || 500, error.message);
    }
  }
}

module.exports = EnergyController;