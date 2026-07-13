const BaseController = require('../../../core/base/BaseController');
const CarbonService = require('../services/CarbonService');
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

const createCarbonSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid('direct_emissions', 'indirect_energy', 'indirect_other', 'total').required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  period: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required()
  }).required(),
  emissions: Joi.object({
    scope1: Joi.object({
      stationaryCombustion: Joi.number().min(0).default(0),
      mobileCombustion: Joi.number().min(0).default(0),
      fugitiveEmissions: Joi.number().min(0).default(0),
      processEmissions: Joi.number().min(0).default(0)
    }).optional(),
    scope2: Joi.object({
      electricity: Joi.number().min(0).default(0),
      steam: Joi.number().min(0).default(0),
      heating: Joi.number().min(0).default(0),
      cooling: Joi.number().min(0).default(0)
    }).optional(),
    scope3: Joi.object({
      purchasedGoods: Joi.number().min(0).default(0),
      transportation: Joi.number().min(0).default(0),
      waste: Joi.number().min(0).default(0),
      businessTravel: Joi.number().min(0).default(0),
      employeeCommuting: Joi.number().min(0).default(0),
      leasedAssets: Joi.number().min(0).default(0),
      investments: Joi.number().min(0).default(0)
    }).optional()
  }).optional(),
  energyData: Joi.object({
    electricityConsumption: Joi.number().min(0).default(0),
    fuelConsumption: Joi.number().min(0).default(0),
    naturalGasConsumption: Joi.number().min(0).default(0),
    renewableEnergy: Joi.number().min(0).default(0)
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateCarbonSchema = createCarbonSchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const updateEmissionsSchema = Joi.object({
  scope1: Joi.object({
    stationaryCombustion: Joi.number().min(0).optional(),
    mobileCombustion: Joi.number().min(0).optional(),
    fugitiveEmissions: Joi.number().min(0).optional(),
    processEmissions: Joi.number().min(0).optional()
  }).optional(),
  scope2: Joi.object({
    electricity: Joi.number().min(0).optional(),
    steam: Joi.number().min(0).optional(),
    heating: Joi.number().min(0).optional(),
    cooling: Joi.number().min(0).optional()
  }).optional(),
  scope3: Joi.object({
    purchasedGoods: Joi.number().min(0).optional(),
    transportation: Joi.number().min(0).optional(),
    waste: Joi.number().min(0).optional(),
    businessTravel: Joi.number().min(0).optional(),
    employeeCommuting: Joi.number().min(0).optional(),
    leasedAssets: Joi.number().min(0).optional(),
    investments: Joi.number().min(0).optional()
  }).optional()
});

const updateTargetsSchema = Joi.object({
  reductionTarget: Joi.number().min(0).max(100).required(),
  targetYear: Joi.number().min(2020).required(),
  baseline: Joi.number().min(0).required(),
  baselineYear: Joi.number().min(2020).required()
});

const verifySchema = Joi.object({
  verificationBody: Joi.string().required(),
  reportUrl: Joi.string().uri().optional(),
  comments: Joi.string().optional()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json'),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const deleteCarbonSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class CarbonController extends BaseController {
  constructor() {
    super(new CarbonService(), 'Carbon');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createCarbon(req.body, user.id, companyId);
      return sendCreated(res, 'Carbon record created successfully', result);
    } catch (error) {
      logger.error('Create carbon error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getCarbonRecordsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Carbon records retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get carbon list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getCarbonById(id, companyId);
      return sendResponse(res, 200, 'Carbon record retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getCarbonByCode(code);
      return sendResponse(res, 200, 'Carbon record retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByPeriod(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCarbonByPeriod(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Carbon records by period retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon by period error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { companyId } = req;
      const { type, startDate, endDate } = req.query;
      
      const result = await this.service.getCarbonByType(companyId, type, startDate, endDate);
      return sendResponse(res, 200, 'Carbon records by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getByYear(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getCarbonByYear(companyId, parseInt(year));
      return sendResponse(res, 200, 'Carbon records by year retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon by year error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotal(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCompanyTotalEmissions(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Company total emissions retrieved successfully', result);
    } catch (error) {
      logger.error('Get company total emissions error:', error);
      return this.handleError(res, error);
    }
  }

  async getDistribution(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getEmissionsDistribution(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Emissions distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get emissions distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getTrend(req, res) {
    try {
      const { companyId } = req;
      const months = parseInt(req.query.months) || 12;
      
      const result = await this.service.getEmissionsTrend(companyId, months);
      return sendResponse(res, 200, 'Emissions trend retrieved successfully', result);
    } catch (error) {
      logger.error('Get emissions trend error:', error);
      return this.handleError(res, error);
    }
  }

  async getYearly(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getYearlyEmissions(companyId, parseInt(year));
      return sendResponse(res, 200, 'Yearly emissions retrieved successfully', result);
    } catch (error) {
      logger.error('Get yearly emissions error:', error);
      return this.handleError(res, error);
    }
  }

  async getTopFactories(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getTopEmittingFactories(
        companyId,
        startDate,
        endDate,
        parseInt(limit) || 10
      );
      return sendResponse(res, 200, 'Top emitting factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get top emitting factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getReductionActions(req, res) {
    try {
      const { companyId } = req;
      
      const result = await this.service.getReductionActions(companyId);
      return sendResponse(res, 200, 'Reduction actions retrieved successfully', result);
    } catch (error) {
      logger.error('Get reduction actions error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateCarbon(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Carbon record updated successfully', result);
    } catch (error) {
      logger.error('Update carbon error:', error);
      return this.handleError(res, error);
    }
  }

  async updateEmissions(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateEmissions(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Carbon emissions updated successfully', result);
    } catch (error) {
      logger.error('Update carbon emissions error:', error);
      return this.handleError(res, error);
    }
  }

  async updateTargets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateTargets(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Carbon targets updated successfully', result);
    } catch (error) {
      logger.error('Update carbon targets error:', error);
      return this.handleError(res, error);
    }
  }

  async verify(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.verifyCarbon(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Carbon record verified successfully', result);
    } catch (error) {
      logger.error('Verify carbon error:', error);
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
      
      const result = await this.service.getCarbonDashboard(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Carbon dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get carbon dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteCarbon(id, user.id, companyId, reason);
      return sendDeleted(res, 'Carbon record deleted successfully');
    } catch (error) {
      logger.error('Delete carbon error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportCarbonData(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=carbon_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Carbon data exported successfully', data);
    } catch (error) {
      logger.error('Export carbon error:', error);
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

module.exports = CarbonController;