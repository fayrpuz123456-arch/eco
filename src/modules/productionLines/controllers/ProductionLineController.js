const BaseController = require('../../../core/base/BaseController');
const ProductionLineService = require('../services/ProductionLineService');
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

const createProductionLineSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(10).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'assembly', 'packaging', 'processing', 'manufacturing',
    'filling', 'cutting', 'welding', 'painting',
    'quality_control', 'testing', 'maintenance', 'material_handling', 'other'
  ).required(),
  category: Joi.string().valid('manual', 'semi_automated', 'fully_automated', 'robotic', 'hybrid')
    .default('semi_automated'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  productionDetails: Joi.object({
    capacityPerHour: Joi.number().min(0).default(0),
    capacityPerShift: Joi.number().min(0).default(0),
    capacityPerDay: Joi.number().min(0).default(0),
    unit: Joi.string().default('units'),
    currentProduction: Joi.number().min(0).default(0),
    targetProduction: Joi.number().min(0).default(0),
    efficiency: Joi.number().min(0).max(100).default(0),
    utilization: Joi.number().min(0).max(100).default(0),
    qualityRate: Joi.number().min(0).max(100).default(0),
    scrapRate: Joi.number().min(0).max(100).default(0),
    reworkRate: Joi.number().min(0).max(100).default(0)
  }).optional(),
  operatingDetails: Joi.object({
    shiftCount: Joi.number().integer().min(1).max(5).default(1),
    operatingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00')
    }).optional(),
    workingDays: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
      .default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateProductionLineSchema = createProductionLineSchema.fork(
  ['name', 'code', 'type', 'departmentId', 'factoryId'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'stopped', 'archived').required()
});

const updatePerformanceSchema = Joi.object({
  oee: Joi.number().min(0).max(100).optional(),
  availability: Joi.number().min(0).max(100).optional(),
  performance: Joi.number().min(0).max(100).optional(),
  quality: Joi.number().min(0).max(100).optional(),
  throughput: Joi.number().min(0).optional(),
  cycleTime: Joi.number().min(0).optional(),
  changeoverTime: Joi.number().min(0).optional()
});

const updateMachinesSchema = Joi.object({
  total: Joi.number().min(0).optional(),
  active: Joi.number().min(0).optional(),
  idle: Joi.number().min(0).optional(),
  maintenance: Joi.number().min(0).optional(),
  offline: Joi.number().min(0).optional(),
  machineIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).optional()
});

const updateSensorsSchema = Joi.object({
  total: Joi.number().min(0).optional(),
  active: Joi.number().min(0).optional(),
  offline: Joi.number().min(0).optional(),
  sensorIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).optional()
});

const updateQualitySchema = Joi.object({
  totalProduced: Joi.number().min(0).optional(),
  totalDefects: Joi.number().min(0).optional(),
  totalScrap: Joi.number().min(0).optional(),
  totalRework: Joi.number().min(0).optional(),
  defectRate: Joi.number().min(0).max(100).optional(),
  qualityScore: Joi.number().min(0).max(100).optional(),
  lastInspection: Joi.date().iso().optional(),
  nextInspection: Joi.date().iso().optional()
});

const updateGreenScoreSchema = Joi.object({
  score: Joi.number().min(0).max(100).required()
});

const updateCostSchema = Joi.object({
  laborCost: Joi.number().min(0).optional(),
  materialCost: Joi.number().min(0).optional(),
  energyCost: Joi.number().min(0).optional(),
  maintenanceCost: Joi.number().min(0).optional(),
  totalCost: Joi.number().min(0).optional(),
  costPerUnit: Joi.number().min(0).optional(),
  currency: Joi.string().optional()
});

const addMaintenanceRecordSchema = Joi.object({
  type: Joi.string().required(),
  description: Joi.string().required(),
  duration: Joi.number().min(0).optional(),
  performedBy: Joi.string().optional(),
  cost: Joi.number().min(0).optional(),
  nextMaintenance: Joi.date().iso().optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'stopped', 'archived'),
  type: Joi.string().valid(
    'assembly', 'packaging', 'processing', 'manufacturing',
    'filling', 'cutting', 'welding', 'painting',
    'quality_control', 'testing', 'maintenance', 'material_handling', 'other'
  ),
  category: Joi.string().valid('manual', 'semi_automated', 'fully_automated', 'robotic', 'hybrid'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }),
  minOEE: Joi.number().min(0).max(100),
  maxOEE: Joi.number().min(0).max(100),
  minGreenScore: Joi.number().min(0).max(100),
  maxGreenScore: Joi.number().min(0).max(100),
  isRunning: Joi.boolean(),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteProductionLineSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class ProductionLineController extends BaseController {
  constructor() {
    super(new ProductionLineService(), 'ProductionLine');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createProductionLine(req.body, user.id, companyId);
      return sendCreated(res, 'Production line created successfully', result);
    } catch (error) {
      logger.error('Create production line error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getProductionLinesPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Production lines retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get production lines list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getProductionLineById(id, companyId);
      return sendResponse(res, 200, 'Production line retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code, departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getProductionLineByCode(code, departmentId, companyId);
      return sendResponse(res, 200, 'Production line retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentProductionLines(departmentId, companyId);
      return sendResponse(res, 200, 'Department production lines retrieved successfully', result);
    } catch (error) {
      logger.error('Get department production lines error:', error);
      return this.handleError(res, error);
    }
  }

  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryProductionLines(factoryId, companyId);
      return sendResponse(res, 200, 'Factory production lines retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory production lines error:', error);
      return this.handleError(res, error);
    }
  }

  async getActive(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getActiveProductionLines(departmentId, companyId);
      return sendResponse(res, 200, 'Active production lines retrieved successfully', result);
    } catch (error) {
      logger.error('Get active production lines error:', error);
      return this.handleError(res, error);
    }
  }

  async getHighPerformance(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const minOEE = parseInt(req.query.minOEE) || 80;
      const result = await this.service.getHighPerformanceLines(minOEE, departmentId, companyId);
      return sendResponse(res, 200, 'High performance production lines retrieved successfully', result);
    } catch (error) {
      logger.error('Get high performance production lines error:', error);
      return this.handleError(res, error);
    }
  }

  async search(req, res) {
    try {
      const { query, departmentId } = req.query;
      const { companyId } = req;
      const result = await this.service.searchProductionLines(query, departmentId, companyId);
      return sendResponse(res, 200, 'Production lines found successfully', result);
    } catch (error) {
      logger.error('Search production lines error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getProductionLineStats(id);
      return sendResponse(res, 200, 'Production line statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getDepartmentStats(req, res) {
    try {
      const { departmentId } = req.params;
      const result = await this.service.getDepartmentProductionLineStats(departmentId);
      return sendResponse(res, 200, 'Department production line statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get department production line stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getTypeDistribution(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getTypeDistribution(departmentId, companyId);
      return sendResponse(res, 200, 'Type distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get type distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getCategoryDistribution(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getCategoryDistribution(departmentId, companyId);
      return sendResponse(res, 200, 'Category distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get category distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getDashboard(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getProductionLineDashboard(id, companyId);
      return sendResponse(res, 200, 'Production line dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateProductionLine(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line updated successfully', result);
    } catch (error) {
      logger.error('Update production line error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'Production line status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  async updatePerformance(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updatePerformance(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line performance updated successfully', result);
    } catch (error) {
      logger.error('Update performance error:', error);
      return this.handleError(res, error);
    }
  }

  async updateMachines(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateMachines(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line machines updated successfully', result);
    } catch (error) {
      logger.error('Update machines error:', error);
      return this.handleError(res, error);
    }
  }

  async updateSensors(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateSensors(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line sensors updated successfully', result);
    } catch (error) {
      logger.error('Update sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async updateQuality(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateQuality(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line quality updated successfully', result);
    } catch (error) {
      logger.error('Update quality error:', error);
      return this.handleError(res, error);
    }
  }

  async updateGreenScore(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { score } = req.body;
      const result = await this.service.updateGreenScore(id, score, user.id, companyId);
      return sendResponse(res, 200, 'Production line green score updated successfully', result);
    } catch (error) {
      logger.error('Update green score error:', error);
      return this.handleError(res, error);
    }
  }

  async updateCost(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateCost(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Production line cost updated successfully', result);
    } catch (error) {
      logger.error('Update cost error:', error);
      return this.handleError(res, error);
    }
  }

  async start(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.startLine(id, user.id, companyId);
      return sendResponse(res, 200, 'Production line started successfully', result);
    } catch (error) {
      logger.error('Start production line error:', error);
      return this.handleError(res, error);
    }
  }

  async stop(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.stopLine(id, user.id, companyId);
      return sendResponse(res, 200, 'Production line stopped successfully', result);
    } catch (error) {
      logger.error('Stop production line error:', error);
      return this.handleError(res, error);
    }
  }

  async addMaintenanceRecord(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addMaintenanceRecord(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Maintenance record added successfully', result);
    } catch (error) {
      logger.error('Add maintenance record error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteProductionLine(id, user.id, companyId, reason);
      return sendDeleted(res, 'Production line deleted successfully');
    } catch (error) {
      logger.error('Delete production line error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FILTERS ============

  async filter(req, res) {
    try {
      const { companyId } = req;
      const { departmentId, ...filters } = req.query;
      const result = await this.service.findWithFilters(filters, departmentId, companyId);
      return sendPaginatedResponse(res, 'Production lines filtered successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Filter production lines error:', error);
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

module.exports = ProductionLineController;