const BaseController = require('../../../core/base/BaseController');
const FactoryService = require('../services/FactoryService');
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

const createFactorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(10).uppercase().required(),
  description: Joi.string().max(500).optional(),
  industry: Joi.string().valid(
    'manufacturing', 'energy', 'chemical', 'pharmaceutical',
    'food_beverage', 'automotive', 'aerospace', 'electronics',
    'textile', 'steel', 'mining', 'construction',
    'agriculture', 'technology', 'logistics', 'other'
  ).required(),
  industrySubtype: Joi.string().max(50).optional(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().optional(),
  contactPerson: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    position: Joi.string().optional()
  }).optional(),
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    postalCode: Joi.string().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lng: Joi.number().min(-180).max(180).optional()
    }).optional(),
    formattedAddress: Joi.string().optional()
  }).optional(),
  type: Joi.string().valid('production', 'warehouse', 'distribution', 'maintenance', 'research', 'mixed').default('production'),
  size: Joi.string().valid('small', 'medium', 'large', 'enterprise').default('medium'),
  area: Joi.number().min(0).default(0),
  establishedDate: Joi.date().iso().optional(),
  timezone: Joi.string().default('UTC'),
  productionCapacity: Joi.number().min(0).default(0),
  productionUnit: Joi.string().default('units/hour'),
  shiftCount: Joi.number().integer().min(1).max(5).default(1),
  operatingHours: Joi.object({
    start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
    end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00'),
    days: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
      .default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  }).optional(),
  sustainability: Joi.object({
    carbonFootprint: Joi.number().min(0).default(0),
    energyConsumption: Joi.number().min(0).default(0),
    waterConsumption: Joi.number().min(0).default(0),
    wasteProduction: Joi.number().min(0).default(0),
    renewableEnergyPercentage: Joi.number().min(0).max(100).default(0),
    certifications: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      issuer: Joi.string().required(),
      dateIssued: Joi.date().iso(),
      dateExpires: Joi.date().iso(),
      status: Joi.string().valid('active', 'expired', 'pending').default('active')
    })).default([])
  }).optional(),
  safety: Joi.object({
    rating: Joi.number().min(0).max(100).default(0),
    lastInspection: Joi.date().iso().optional(),
    nextInspection: Joi.date().iso().optional(),
    emergencyProtocols: Joi.array().items(Joi.string()).default([]),
    safetyOfficer: Joi.object({
      name: Joi.string().optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional()
    }).optional()
  }).optional(),
  settings: Joi.object({
    maxDepartments: Joi.number().integer().min(1).default(20),
    maxProductionLines: Joi.number().integer().min(1).default(10),
    maxMachines: Joi.number().integer().min(1).default(50),
    maxSensors: Joi.number().integer().min(1).default(100),
    dataRetentionDays: Joi.number().integer().min(30).default(365),
    alertThresholds: Joi.object({
      temperatureMin: Joi.number().default(0),
      temperatureMax: Joi.number().default(40),
      humidityMin: Joi.number().min(0).max(100).default(30),
      humidityMax: Joi.number().min(0).max(100).default(80),
      pressureMin: Joi.number().default(900),
      pressureMax: Joi.number().default(1100)
    }).optional(),
    maintenanceSchedule: Joi.object({
      type: Joi.string().valid('preventive', 'predictive', 'reactive').default('preventive'),
      frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').default('monthly'),
      lastMaintenance: Joi.date().iso().optional(),
      nextMaintenance: Joi.date().iso().optional()
    }).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateFactorySchema = createFactorySchema.fork(
  ['name', 'code', 'industry', 'contactEmail'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'archived').required()
});

const updateGreenScoreSchema = Joi.object({
  score: Joi.number().min(0).max(100).required()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'archived'),
  industry: Joi.string(),
  country: Joi.string(),
  city: Joi.string(),
  type: Joi.string().valid('production', 'warehouse', 'distribution', 'maintenance', 'research', 'mixed'),
  size: Joi.string().valid('small', 'medium', 'large', 'enterprise'),
  minGreenScore: Joi.number().min(0).max(100),
  maxGreenScore: Joi.number().min(0).max(100),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// ============ CONTROLLER ============

class FactoryController extends BaseController {
  constructor() {
    super(new FactoryService(), 'Factory');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createFactory(req.body, user.id, companyId);
      return sendCreated(res, 'Factory created successfully', result);
    } catch (error) {
      logger.error('Create factory error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getFactoriesPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Factories retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get factories list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryById(id, companyId);
      return sendResponse(res, 200, 'Factory retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryByCode(code, companyId);
      return sendResponse(res, 200, 'Factory retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getActive(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getActiveFactories(companyId);
      return sendResponse(res, 200, 'Active factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get active factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getHighGreenScore(req, res) {
    try {
      const { companyId } = req;
      const minScore = parseInt(req.query.minScore) || 70;
      const result = await this.service.getHighGreenScoreFactories(minScore, companyId);
      return sendResponse(res, 200, 'High green score factories retrieved successfully', result);
    } catch (error) {
      logger.error('Get high green score factories error:', error);
      return this.handleError(res, error);
    }
  }

  async search(req, res) {
    try {
      const { query } = req.query;
      const { companyId } = req;
      const result = await this.service.searchFactories(query, companyId);
      return sendResponse(res, 200, 'Factories found successfully', result);
    } catch (error) {
      logger.error('Search factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getFactoryStats(id);
      return sendResponse(res, 200, 'Factory statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getCompanyStats(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getCompanyFactoryStats(companyId);
      return sendResponse(res, 200, 'Company factory statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get company factory stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getDashboard(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryDashboard(id, companyId);
      return sendResponse(res, 200, 'Factory dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateFactory(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Factory updated successfully', result);
    } catch (error) {
      logger.error('Update factory error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'Factory status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  async updateGreenScore(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { score } = req.body;
      const result = await this.service.updateGreenScore(id, score, user.id, companyId);
      return sendResponse(res, 200, 'Green score updated successfully', result);
    } catch (error) {
      logger.error('Update green score error:', error);
      return this.handleError(res, error);
    }
  }

  async calculateGreenScore(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.calculateGreenScore(id, user.id, companyId);
      return sendResponse(res, 200, 'Green score calculated successfully', result);
    } catch (error) {
      logger.error('Calculate green score error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatistics(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateStatistics(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Factory statistics updated successfully', result);
    } catch (error) {
      logger.error('Update statistics error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteFactory(id, user.id, companyId, reason);
      return sendDeleted(res, 'Factory deleted successfully');
    } catch (error) {
      logger.error('Delete factory error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FILTERS ============

  async filter(req, res) {
    try {
      const { companyId } = req;
      const filters = req.query;
      const result = await this.service.findWithFilters(filters, companyId);
      return sendPaginatedResponse(res, 'Factories filtered successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Filter factories error:', error);
      return this.handleError(res, error);
    }
  }

  async getIndustryDistribution(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getIndustryDistribution(companyId);
      return sendResponse(res, 200, 'Industry distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get industry distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getCountryDistribution(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getCountryDistribution(companyId);
      return sendResponse(res, 200, 'Country distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get country distribution error:', error);
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

module.exports = FactoryController;