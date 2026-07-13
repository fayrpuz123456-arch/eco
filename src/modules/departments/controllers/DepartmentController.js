const BaseController = require('../../../core/base/BaseController');
const DepartmentService = require('../services/DepartmentService');
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

const createDepartmentSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(10).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'production', 'maintenance', 'warehouse', 'packaging',
    'quality', 'energy', 'utilities', 'health_safety',
    'environmental', 'logistics', 'research', 'administration',
    'hr', 'it', 'finance', 'procurement', 'sales', 'marketing', 'other'
  ).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  departmentHead: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    employeeId: Joi.string().optional()
  }).optional(),
  location: Joi.object({
    building: Joi.string().optional(),
    floor: Joi.number().min(0).optional(),
    section: Joi.string().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lng: Joi.number().min(-180).max(180).optional()
    }).optional()
  }).optional(),
  productionDetails: Joi.object({
    shiftCount: Joi.number().integer().min(1).max(5).default(1),
    operatingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00')
    }).optional(),
    workingDays: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
      .default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
    productionCapacity: Joi.number().min(0).default(0),
    capacityUnit: Joi.string().default('units/hour')
  }).optional(),
  employees: Joi.object({
    total: Joi.number().min(0).default(0),
    active: Joi.number().min(0).default(0),
    supervisors: Joi.number().min(0).default(0),
    engineers: Joi.number().min(0).default(0),
    technicians: Joi.number().min(0).default(0),
    operators: Joi.number().min(0).default(0)
  }).optional(),
  settings: Joi.object({
    maxEmployees: Joi.number().integer().min(1).default(100),
    maxMachines: Joi.number().integer().min(1).default(20),
    maxSensors: Joi.number().integer().min(1).default(50),
    autoApproveRequests: Joi.boolean().default(false),
    notificationPreferences: Joi.object({
      email: Joi.boolean().default(true),
      push: Joi.boolean().default(true),
      inApp: Joi.boolean().default(true)
    }).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateDepartmentSchema = createDepartmentSchema.fork(
  ['name', 'code', 'type', 'factoryId'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'archived').required()
});

const updateGreenScoreSchema = Joi.object({
  score: Joi.number().min(0).max(100).required()
});

const updateEmployeesSchema = Joi.object({
  total: Joi.number().min(0).optional(),
  active: Joi.number().min(0).optional(),
  supervisors: Joi.number().min(0).optional(),
  engineers: Joi.number().min(0).optional(),
  technicians: Joi.number().min(0).optional(),
  operators: Joi.number().min(0).optional()
});

const updateAssetsSchema = Joi.object({
  totalMachines: Joi.number().min(0).optional(),
  totalSensors: Joi.number().min(0).optional(),
  totalTools: Joi.number().min(0).optional(),
  totalVehicles: Joi.number().min(0).optional(),
  lastAudit: Joi.date().iso().optional()
});

const updateBudgetSchema = Joi.object({
  annual: Joi.number().min(0).optional(),
  spent: Joi.number().min(0).optional(),
  remaining: Joi.number().min(0).optional(),
  currency: Joi.string().optional()
});

const updateKPIsSchema = Joi.object({
  productivity: Joi.number().min(0).max(100).optional(),
  quality: Joi.number().min(0).max(100).optional(),
  efficiency: Joi.number().min(0).max(100).optional(),
  safetyScore: Joi.number().min(0).max(100).optional(),
  employeeSatisfaction: Joi.number().min(0).max(100).optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'archived'),
  type: Joi.string().valid(
    'production', 'maintenance', 'warehouse', 'packaging',
    'quality', 'energy', 'utilities', 'health_safety',
    'environmental', 'logistics', 'research', 'administration',
    'hr', 'it', 'finance', 'procurement', 'sales', 'marketing', 'other'
  ),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }),
  minGreenScore: Joi.number().min(0).max(100),
  maxGreenScore: Joi.number().min(0).max(100),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteDepartmentSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class DepartmentController extends BaseController {
  constructor() {
    super(new DepartmentService(), 'Department');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createDepartment(req.body, user.id, companyId);
      return sendCreated(res, 'Department created successfully', result);
    } catch (error) {
      logger.error('Create department error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getDepartmentsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Departments retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get departments list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentById(id, companyId);
      return sendResponse(res, 200, 'Department retrieved successfully', result);
    } catch (error) {
      logger.error('Get department by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code, factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentByCode(code, factoryId, companyId);
      return sendResponse(res, 200, 'Department retrieved successfully', result);
    } catch (error) {
      logger.error('Get department by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryDepartments(factoryId, companyId);
      return sendResponse(res, 200, 'Factory departments retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory departments error:', error);
      return this.handleError(res, error);
    }
  }

  async getActive(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getActiveDepartments(factoryId, companyId);
      return sendResponse(res, 200, 'Active departments retrieved successfully', result);
    } catch (error) {
      logger.error('Get active departments error:', error);
      return this.handleError(res, error);
    }
  }

  async getHighGreenScore(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const minScore = parseInt(req.query.minScore) || 70;
      const result = await this.service.getHighGreenScoreDepartments(minScore, factoryId, companyId);
      return sendResponse(res, 200, 'High green score departments retrieved successfully', result);
    } catch (error) {
      logger.error('Get high green score departments error:', error);
      return this.handleError(res, error);
    }
  }

  async search(req, res) {
    try {
      const { query, factoryId } = req.query;
      const { companyId } = req;
      const result = await this.service.searchDepartments(query, factoryId, companyId);
      return sendResponse(res, 200, 'Departments found successfully', result);
    } catch (error) {
      logger.error('Search departments error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getDepartmentStats(id);
      return sendResponse(res, 200, 'Department statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get department stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getFactoryStats(req, res) {
    try {
      const { factoryId } = req.params;
      const result = await this.service.getFactoryDepartmentStats(factoryId);
      return sendResponse(res, 200, 'Factory department statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory department stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getTypeDistribution(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getTypeDistribution(factoryId, companyId);
      return sendResponse(res, 200, 'Type distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get type distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getDashboard(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentDashboard(id, companyId);
      return sendResponse(res, 200, 'Department dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get department dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateDepartment(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Department updated successfully', result);
    } catch (error) {
      logger.error('Update department error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'Department status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  async updateEmployees(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateEmployees(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Department employees updated successfully', result);
    } catch (error) {
      logger.error('Update employees error:', error);
      return this.handleError(res, error);
    }
  }

  async updateAssets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateAssets(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Department assets updated successfully', result);
    } catch (error) {
      logger.error('Update assets error:', error);
      return this.handleError(res, error);
    }
  }

  async updateGreenScore(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { score } = req.body;
      const result = await this.service.updateGreenScore(id, score, user.id, companyId);
      return sendResponse(res, 200, 'Department green score updated successfully', result);
    } catch (error) {
      logger.error('Update green score error:', error);
      return this.handleError(res, error);
    }
  }

  async updateBudget(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateBudget(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Department budget updated successfully', result);
    } catch (error) {
      logger.error('Update budget error:', error);
      return this.handleError(res, error);
    }
  }

  async updateKPIs(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateKPIs(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Department KPIs updated successfully', result);
    } catch (error) {
      logger.error('Update KPIs error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteDepartment(id, user.id, companyId, reason);
      return sendDeleted(res, 'Department deleted successfully');
    } catch (error) {
      logger.error('Delete department error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FILTERS ============

  async filter(req, res) {
    try {
      const { companyId } = req;
      const { factoryId, ...filters } = req.query;
      const result = await this.service.findWithFilters(filters, factoryId, companyId);
      return sendPaginatedResponse(res, 'Departments filtered successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Filter departments error:', error);
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

module.exports = DepartmentController;