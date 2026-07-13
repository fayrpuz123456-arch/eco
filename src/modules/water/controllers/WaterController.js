const BaseController = require('../../../core/base/BaseController');
const WaterService = require('../services/WaterService');
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

const createWaterSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid('groundwater', 'surface_water', 'treated_water', 'wastewater', 'rainwater', 'desalinated', 'total').required(),
  source: Joi.string().valid('well', 'river', 'lake', 'municipal', 'recycling', 'rain', 'other').default('municipal'),
  usage: Joi.string().valid('production', 'cooling', 'cleaning', 'irrigation', 'domestic', 'other').default('production'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  period: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required()
  }).required(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateWaterSchema = createWaterSchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const updateConsumptionSchema = Joi.object({
  intake: Joi.number().min(0).optional(),
  reused: Joi.number().min(0).optional(),
  recycled: Joi.number().min(0).optional(),
  discharged: Joi.number().min(0).optional(),
  wasted: Joi.number().min(0).optional()
});

const updateQualitySchema = Joi.object({
  ph: Joi.number().min(0).max(14).optional(),
  temperature: Joi.number().optional(),
  turbidity: Joi.number().min(0).optional(),
  conductivity: Joi.number().min(0).optional(),
  dissolvedOxygen: Joi.number().min(0).optional(),
  bod: Joi.number().min(0).optional(),
  cod: Joi.number().min(0).optional(),
  tds: Joi.number().min(0).optional(),
  hardness: Joi.number().min(0).optional(),
  alkalinity: Joi.number().min(0).optional(),
  chloride: Joi.number().min(0).optional(),
  nitrate: Joi.number().min(0).optional(),
  phosphate: Joi.number().min(0).optional(),
  bacteria: Joi.number().min(0).optional()
});

const updateTargetsSchema = Joi.object({
  consumptionReduction: Joi.number().min(0).max(100).required(),
  reuseTarget: Joi.number().min(0).max(100).required(),
  recycleTarget: Joi.number().min(0).max(100).required(),
  wasteTarget: Joi.number().min(0).max(100).required(),
  targetYear: Joi.number().min(2020).required(),
  baseline: Joi.number().min(0).required(),
  baselineYear: Joi.number().min(2020).required()
});

const addLeakSchema = Joi.object({
  location: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('low'),
  estimatedLoss: Joi.number().min(0).default(0),
  notes: Joi.string().optional()
});

const repairLeakSchema = Joi.object({
  leakId: Joi.string().uuid({ version: 'uuidv4' }).required()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json'),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const deleteWaterSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class WaterController extends BaseController {
  constructor() {
    super(new WaterService(), 'Water');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createWater(req.body, user.id, companyId);
      return sendCreated(res, 'Water record created successfully', result);
    } catch (error) {
      logger.error('Create water error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getWaterRecordsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Water records retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get water list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getWaterById(id, companyId);
      return sendResponse(res, 200, 'Water record retrieved successfully', result);
    } catch (error) {
      logger.error('Get water by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getWaterByCode(code);
      return sendResponse(res, 200, 'Water record retrieved successfully', result);
    } catch (error) {
      logger.error('Get water by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByPeriod(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getWaterByPeriod(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Water records by period retrieved successfully', result);
    } catch (error) {
      logger.error('Get water by period error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { companyId } = req;
      const { type, startDate, endDate } = req.query;
      
      const result = await this.service.getWaterByType(companyId, type, startDate, endDate);
      return sendResponse(res, 200, 'Water records by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get water by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getByYear(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getWaterByYear(companyId, parseInt(year));
      return sendResponse(res, 200, 'Water records by year retrieved successfully', result);
    } catch (error) {
      logger.error('Get water by year error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotal(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCompanyTotalConsumption(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Company total water consumption retrieved successfully', result);
    } catch (error) {
      logger.error('Get company total water consumption error:', error);
      return this.handleError(res, error);
    }
  }

  async getDistribution(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getConsumptionDistribution(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Water consumption distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get water consumption distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getTrend(req, res) {
    try {
      const { companyId } = req;
      const months = parseInt(req.query.months) || 12;
      
      const result = await this.service.getConsumptionTrend(companyId, months);
      return sendResponse(res, 200, 'Water consumption trend retrieved successfully', result);
    } catch (error) {
      logger.error('Get water consumption trend error:', error);
      return this.handleError(res, error);
    }
  }

  async getYearly(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getYearlyConsumption(companyId, parseInt(year));
      return sendResponse(res, 200, 'Yearly water consumption retrieved successfully', result);
    } catch (error) {
      logger.error('Get yearly water consumption error:', error);
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
      return sendResponse(res, 200, 'Top water consuming factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get top water consuming factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getLeakStats(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getLeakStats(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Water leak statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get water leak stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getQualityStats(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getQualityStats(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Water quality statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get water quality stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateWater(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Water record updated successfully', result);
    } catch (error) {
      logger.error('Update water error:', error);
      return this.handleError(res, error);
    }
  }

  async updateConsumption(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateConsumption(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Water consumption updated successfully', result);
    } catch (error) {
      logger.error('Update water consumption error:', error);
      return this.handleError(res, error);
    }
  }

  async updateQuality(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateQuality(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Water quality updated successfully', result);
    } catch (error) {
      logger.error('Update water quality error:', error);
      return this.handleError(res, error);
    }
  }

  async updateTargets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateTargets(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Water targets updated successfully', result);
    } catch (error) {
      logger.error('Update water targets error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ LEAK MANAGEMENT ============

  async addLeak(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addLeak(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Water leak added successfully', result);
    } catch (error) {
      logger.error('Add water leak error:', error);
      return this.handleError(res, error);
    }
  }

  async repairLeak(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { leakId } = req.body;
      const result = await this.service.repairLeak(id, leakId, user.id, companyId);
      return sendResponse(res, 200, 'Water leak repaired successfully', result);
    } catch (error) {
      logger.error('Repair water leak error:', error);
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
      
      const result = await this.service.getWaterDashboard(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Water dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get water dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteWater(id, user.id, companyId, reason);
      return sendDeleted(res, 'Water record deleted successfully');
    } catch (error) {
      logger.error('Delete water error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportWaterData(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=water_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Water data exported successfully', data);
    } catch (error) {
      logger.error('Export water error:', error);
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

module.exports = WaterController;