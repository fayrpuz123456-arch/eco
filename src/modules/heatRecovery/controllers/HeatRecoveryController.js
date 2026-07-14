const BaseController = require('../../../core/base/BaseController');
const HeatRecoveryService = require('../services/HeatRecoveryService');
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
const logger = require('../../../core/utils/logger');
const Joi = require('joi');
const { idSchema } = require('../../../core/middleware/validation');

// ============ SCHEMAS ============

const createHeatRecoverySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  machineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  heatSource: Joi.object({
    type: Joi.string().valid(
      'boiler', 'furnace', 'engine', 'compressor', 'pump',
      'exhaust', 'steam_trap', 'cooling_tower', 'heat_exchanger',
      'incinerator', 'other'
    ).required(),
    temperature: Joi.number().min(0).required(),
    flowRate: Joi.number().min(0).default(0),
    pressure: Joi.number().min(0).default(0),
    operatingHours: Joi.number().min(0).default(0),
    operatingDays: Joi.number().min(0).default(0),
    fuelType: Joi.string().valid('natural_gas', 'diesel', 'coal', 'biomass', 'electricity', 'other').default('natural_gas')
  }).required(),
  heatCalculation: Joi.object({
    recoveryEfficiency: Joi.number().min(0).max(100).default(70)
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateHeatRecoverySchema = createHeatRecoverySchema.fork(
  ['name', 'factoryId', 'machineId'],
  (schema) => schema.optional()
);

const addSolutionSchema = Joi.object({
  type: Joi.string().valid(
    'heat_exchanger', 'steam_recovery', 'boiler_feed', 'orc_generator',
    'drying_system', 'preheating', 'district_heating', 'absorption_chiller',
    'heat_pump'
  ).required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  potentialRecovery: Joi.number().min(0).required(),
  efficiency: Joi.number().min(0).max(100).default(70),
  cost: Joi.number().min(0).default(0),
  implementationTime: Joi.number().min(0).default(0),
  maintenanceCost: Joi.number().min(0).default(0)
});

const updateImplementationSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').required(),
  startedAt: Joi.date().iso().optional(),
  completedAt: Joi.date().iso().optional(),
  actualSavings: Joi.number().min(0).optional(),
  actualCarbonReduction: Joi.number().min(0).optional(),
  challenges: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  priority: Joi.string().valid('high', 'medium', 'low'),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }),
  machineId: Joi.string().uuid({ version: 'uuidv4' }),
  minRecoverable: Joi.number().min(0),
  maxRecoverable: Joi.number().min(0),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteHeatRecoverySchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class HeatRecoveryController extends BaseController {
  constructor() {
    super(new HeatRecoveryService(), 'HeatRecovery');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createHeatRecovery(req.body, user.id, companyId);
      return sendCreated(res, 'Heat recovery opportunity created successfully', result);
    } catch (error) {
      logger.error('Create heat recovery error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;

      const result = await this.service.getHeatRecoveriesPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );

      return sendPaginatedResponse(res, 'Heat recovery opportunities retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get heat recoveries list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getHeatRecoveryById(id, companyId);
      return sendResponse(res, 200, 'Heat recovery opportunity retrieved successfully', result);
    } catch (error) {
      logger.error('Get heat recovery by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getHeatRecoveryByFactory(factoryId, companyId);
      return sendResponse(res, 200, 'Factory heat recovery opportunities retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory heat recoveries error:', error);
      return this.handleError(res, error);
    }
  }

  async getByMachine(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getHeatRecoveryByMachine(machineId, companyId);
      return sendResponse(res, 200, 'Machine heat recovery opportunities retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine heat recoveries error:', error);
      return this.handleError(res, error);
    }
  }

  async getHighPriority(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getHighPriority(companyId);
      return sendResponse(res, 200, 'High priority heat recovery opportunities retrieved successfully', result);
    } catch (error) {
      logger.error('Get high priority heat recoveries error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getStats(companyId);
      return sendResponse(res, 200, 'Heat recovery statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get heat recovery stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ AI ANALYSIS ============

  async analyzeWithAI(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.analyzeWithAI(id, companyId);
      return sendResponse(res, 200, 'AI analysis completed successfully', result);
    } catch (error) {
      logger.error('AI analysis error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ SOLUTIONS ============

  async addSolution(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addSolution(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Solution added successfully', result);
    } catch (error) {
      logger.error('Add solution error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateHeatRecovery(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Heat recovery opportunity updated successfully', result);
    } catch (error) {
      logger.error('Update heat recovery error:', error);
      return this.handleError(res, error);
    }
  }

  async updateImplementation(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateImplementation(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Implementation status updated successfully', result);
    } catch (error) {
      logger.error('Update implementation error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteHeatRecovery(id, user.id, companyId, reason);
      return sendDeleted(res, 'Heat recovery opportunity deleted successfully');
    } catch (error) {
      logger.error('Delete heat recovery error:', error);
      return this.handleError(res, error);
    }
  }

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

module.exports = HeatRecoveryController;