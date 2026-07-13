const BaseController = require('../../../core/base/BaseController');
const WasteService = require('../services/WasteService');
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

const createWasteSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'organic', 'plastic', 'paper', 'metal', 'glass',
    'electronic', 'hazardous', 'chemical', 'construction',
    'food_waste', 'medical', 'textile', 'wood', 'rubber',
    'mixed', 'other'
  ).required(),
  category: Joi.string().valid('recyclable', 'non_recyclable', 'hazardous', 'compostable', 'other').required(),
  hazardLevel: Joi.string().valid('none', 'low', 'medium', 'high', 'critical').default('none'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  period: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required()
  }).required(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateWasteSchema = createWasteSchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const updateGenerationSchema = Joi.object({
  total: Joi.number().min(0).optional(),
  collected: Joi.number().min(0).optional(),
  sorted: Joi.number().min(0).optional()
});

const updateDisposalSchema = Joi.object({
  landfill: Joi.number().min(0).optional(),
  incineration: Joi.number().min(0).optional(),
  composting: Joi.number().min(0).optional(),
  recycling: Joi.number().min(0).optional(),
  energy_recovery: Joi.number().min(0).optional(),
  export: Joi.number().min(0).optional(),
  other: Joi.number().min(0).optional()
});

const updateRecyclingSchema = Joi.object({
  rate: Joi.number().min(0).max(100).optional(),
  target: Joi.number().min(0).max(100).optional(),
  materials: Joi.array().items(Joi.object({
    material: Joi.string().required(),
    quantity: Joi.number().min(0).default(0),
    value: Joi.number().min(0).default(0),
    buyer: Joi.string().optional()
  })).optional(),
  revenue: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional()
});

const updateTargetsSchema = Joi.object({
  reductionTarget: Joi.number().min(0).max(100).required(),
  recyclingTarget: Joi.number().min(0).max(100).required(),
  diversionTarget: Joi.number().min(0).max(100).required(),
  targetYear: Joi.number().min(2020).required(),
  baseline: Joi.number().min(0).required(),
  baselineYear: Joi.number().min(2020).required()
});

const addOpportunitySchema = Joi.object({
  wasteType: Joi.string().required(),
  potential: Joi.number().min(0).default(0),
  buyer: Joi.string().required(),
  pricePerUnit: Joi.number().min(0).default(0),
  quantity: Joi.number().min(0).default(0),
  notes: Joi.string().optional()
});

const updateOpportunitySchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'sold').required()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json'),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const deleteWasteSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class WasteController extends BaseController {
  constructor() {
    super(new WasteService(), 'Waste');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createWaste(req.body, user.id, companyId);
      return sendCreated(res, 'Waste record created successfully', result);
    } catch (error) {
      logger.error('Create waste error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getWasteRecordsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Waste records retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get waste list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getWasteById(id, companyId);
      return sendResponse(res, 200, 'Waste record retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getWasteByCode(code);
      return sendResponse(res, 200, 'Waste record retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByPeriod(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getWasteByPeriod(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Waste records by period retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by period error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { companyId } = req;
      const { type, startDate, endDate } = req.query;
      
      const result = await this.service.getWasteByType(companyId, type, startDate, endDate);
      return sendResponse(res, 200, 'Waste records by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCategory(req, res) {
    try {
      const { companyId } = req;
      const { category, startDate, endDate } = req.query;
      
      const result = await this.service.getWasteByCategory(companyId, category, startDate, endDate);
      return sendResponse(res, 200, 'Waste records by category retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by category error:', error);
      return this.handleError(res, error);
    }
  }

  async getByYear(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getWasteByYear(companyId, parseInt(year));
      return sendResponse(res, 200, 'Waste records by year retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste by year error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotal(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCompanyTotalWaste(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Company total waste retrieved successfully', result);
    } catch (error) {
      logger.error('Get company total waste error:', error);
      return this.handleError(res, error);
    }
  }

  async getDistribution(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getWasteDistribution(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Waste distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getTrend(req, res) {
    try {
      const { companyId } = req;
      const months = parseInt(req.query.months) || 12;
      
      const result = await this.service.getWasteTrend(companyId, months);
      return sendResponse(res, 200, 'Waste trend retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste trend error:', error);
      return this.handleError(res, error);
    }
  }

  async getYearly(req, res) {
    try {
      const { companyId } = req;
      const { year } = req.params;
      
      const result = await this.service.getYearlyWaste(companyId, parseInt(year));
      return sendResponse(res, 200, 'Yearly waste retrieved successfully', result);
    } catch (error) {
      logger.error('Get yearly waste error:', error);
      return this.handleError(res, error);
    }
  }

  async getTopFactories(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getTopWasteGeneratingFactories(
        companyId,
        startDate,
        endDate,
        parseInt(limit) || 10
      );
      return sendResponse(res, 200, 'Top waste generating factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get top waste generating factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getWasteToValueStats(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getWasteToValueStats(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Waste-to-value statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste-to-value stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateWaste(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste record updated successfully', result);
    } catch (error) {
      logger.error('Update waste error:', error);
      return this.handleError(res, error);
    }
  }

  async updateGeneration(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateGeneration(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste generation updated successfully', result);
    } catch (error) {
      logger.error('Update generation error:', error);
      return this.handleError(res, error);
    }
  }

  async updateDisposal(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateDisposal(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste disposal updated successfully', result);
    } catch (error) {
      logger.error('Update disposal error:', error);
      return this.handleError(res, error);
    }
  }

  async updateRecycling(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateRecycling(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste recycling updated successfully', result);
    } catch (error) {
      logger.error('Update recycling error:', error);
      return this.handleError(res, error);
    }
  }

  async updateTargets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateTargets(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste targets updated successfully', result);
    } catch (error) {
      logger.error('Update targets error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ WASTE-TO-VALUE ============

  async addOpportunity(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addWasteToValueOpportunity(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Waste-to-value opportunity added successfully', result);
    } catch (error) {
      logger.error('Add opportunity error:', error);
      return this.handleError(res, error);
    }
  }

  async updateOpportunity(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { opportunityId, status } = req.body;
      const result = await this.service.updateOpportunityStatus(id, opportunityId, status, user.id, companyId);
      return sendResponse(res, 200, 'Opportunity status updated successfully', result);
    } catch (error) {
      logger.error('Update opportunity error:', error);
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
      
      const result = await this.service.getWasteDashboard(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Waste dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get waste dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteWaste(id, user.id, companyId, reason);
      return sendDeleted(res, 'Waste record deleted successfully');
    } catch (error) {
      logger.error('Delete waste error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportWasteData(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=waste_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Waste data exported successfully', data);
    } catch (error) {
      logger.error('Export waste error:', error);
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

module.exports = WasteController;