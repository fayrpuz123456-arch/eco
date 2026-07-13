const BaseController = require('../../../core/base/BaseController');
const MachineService = require('../services/MachineService');
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

const createMachineSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  serialNumber: Joi.string().optional(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'cnc_machine', 'lathe', 'milling', 'drilling', 'grinding',
    'welding', 'press', 'injection_molding', 'extrusion', 'stamping',
    'laser', 'waterjet', 'plasma', 'packaging', 'labeling',
    'capping', 'filling', 'conveyor', 'forklift', 'crane',
    'hoist', 'generator', 'compressor', 'boiler', 'chiller',
    'pump', 'quality_inspection', 'testing', 'measurement',
    'maintenance', 'cleaning', 'lubrication', 'robotic_arm',
    '3d_printer', 'other'
  ).required(),
  category: Joi.string().valid('mechanical', 'electrical', 'electronic', 'hydraulic', 'pneumatic', 'robotic', 'other')
    .default('mechanical'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  productionLineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  manufacturer: Joi.object({
    name: Joi.string().optional(),
    model: Joi.string().optional(),
    year: Joi.number().min(1900).max(new Date().getFullYear() + 5).optional(),
    country: Joi.string().optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateMachineSchema = createMachineSchema.fork(
  ['name', 'code', 'type', 'productionLineId', 'factoryId', 'departmentId'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('operational', 'maintenance', 'idle', 'offline', 'error', 'warning', 'archived').required()
});

const updatePerformanceSchema = Joi.object({
  oee: Joi.number().min(0).max(100).optional(),
  availability: Joi.number().min(0).max(100).optional(),
  performance: Joi.number().min(0).max(100).optional(),
  quality: Joi.number().min(0).max(100).optional(),
  throughput: Joi.number().min(0).optional(),
  cycleTime: Joi.number().min(0).optional(),
  uptime: Joi.number().min(0).max(100).optional(),
  downtime: Joi.number().min(0).optional(),
  efficiency: Joi.number().min(0).max(100).optional()
});

const updateSensorsSchema = Joi.object({
  total: Joi.number().min(0).optional(),
  active: Joi.number().min(0).optional(),
  offline: Joi.number().min(0).optional(),
  sensorIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).optional()
});

const updateEnergySchema = Joi.object({
  consumption: Joi.number().min(0).optional(),
  powerFactor: Joi.number().min(0).max(1).optional(),
  peakDemand: Joi.number().min(0).optional(),
  efficiency: Joi.number().min(0).max(100).optional(),
  costPerHour: Joi.number().min(0).optional()
});

const updateGreenScoreSchema = Joi.object({
  score: Joi.number().min(0).max(100).required()
});

const updateCostSchema = Joi.object({
  purchasePrice: Joi.number().min(0).optional(),
  installationCost: Joi.number().min(0).optional(),
  annualMaintenance: Joi.number().min(0).optional(),
  operatingCost: Joi.number().min(0).optional(),
  totalCost: Joi.number().min(0).optional(),
  currency: Joi.string().optional(),
  depreciation: Joi.object({
    method: Joi.string().valid('straight_line', 'declining_balance').optional(),
    rate: Joi.number().min(0).max(100).optional(),
    currentValue: Joi.number().min(0).optional()
  }).optional()
});

const addMaintenanceRecordSchema = Joi.object({
  type: Joi.string().valid('preventive', 'corrective', 'emergency', 'overhaul').required(),
  description: Joi.string().required(),
  duration: Joi.number().min(0).optional(),
  performedBy: Joi.string().optional(),
  cost: Joi.number().min(0).optional(),
  partsReplaced: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional(),
  nextMaintenance: Joi.date().iso().optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('operational', 'maintenance', 'idle', 'offline', 'error', 'warning', 'archived'),
  type: Joi.string().valid(
    'cnc_machine', 'lathe', 'milling', 'drilling', 'grinding',
    'welding', 'press', 'injection_molding', 'extrusion', 'stamping',
    'laser', 'waterjet', 'plasma', 'packaging', 'labeling',
    'capping', 'filling', 'conveyor', 'forklift', 'crane',
    'hoist', 'generator', 'compressor', 'boiler', 'chiller',
    'pump', 'quality_inspection', 'testing', 'measurement',
    'maintenance', 'cleaning', 'lubrication', 'robotic_arm',
    '3d_printer', 'other'
  ),
  category: Joi.string().valid('mechanical', 'electrical', 'electronic', 'hydraulic', 'pneumatic', 'robotic', 'other'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  productionLineId: Joi.string().uuid({ version: 'uuidv4' }),
  minOEE: Joi.number().min(0).max(100),
  maxOEE: Joi.number().min(0).max(100),
  minGreenScore: Joi.number().min(0).max(100),
  maxGreenScore: Joi.number().min(0).max(100),
  isOperational: Joi.boolean(),
  dueForMaintenance: Joi.number().min(1).max(365),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteMachineSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class MachineController extends BaseController {
  constructor() {
    super(new MachineService(), 'Machine');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createMachine(req.body, user.id, companyId);
      return sendCreated(res, 'Machine created successfully', result);
    } catch (error) {
      logger.error('Create machine error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getMachinesPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Machines retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get machines list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getMachineById(id, companyId);
      return sendResponse(res, 200, 'Machine retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code, productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getMachineByCode(code, productionLineId, companyId);
      return sendResponse(res, 200, 'Machine retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getBySerialNumber(req, res) {
    try {
      const { serialNumber } = req.params;
      const result = await this.service.getMachineBySerialNumber(serialNumber);
      return sendResponse(res, 200, 'Machine retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine by serial number error:', error);
      return this.handleError(res, error);
    }
  }

  async getByProductionLine(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getProductionLineMachines(productionLineId, companyId);
      return sendResponse(res, 200, 'Production line machines retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line machines error:', error);
      return this.handleError(res, error);
    }
  }

  async getOperational(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getOperationalMachines(productionLineId, companyId);
      return sendResponse(res, 200, 'Operational machines retrieved successfully', result);
    } catch (error) {
      logger.error('Get operational machines error:', error);
      return this.handleError(res, error);
    }
  }

  async getByStatus(req, res) {
    try {
      const { status, productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getMachinesByStatus(status, productionLineId, companyId);
      return sendResponse(res, 200, 'Machines by status retrieved successfully', result);
    } catch (error) {
      logger.error('Get machines by status error:', error);
      return this.handleError(res, error);
    }
  }

  async getHighPerformance(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const minOEE = parseInt(req.query.minOEE) || 80;
      const result = await this.service.getHighPerformanceMachines(minOEE, productionLineId, companyId);
      return sendResponse(res, 200, 'High performance machines retrieved successfully', result);
    } catch (error) {
      logger.error('Get high performance machines error:', error);
      return this.handleError(res, error);
    }
  }

  async getDueForMaintenance(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const days = parseInt(req.query.days) || 7;
      const result = await this.service.getMachinesDueForMaintenance(days, productionLineId, companyId);
      return sendResponse(res, 200, 'Machines due for maintenance retrieved successfully', result);
    } catch (error) {
      logger.error('Get machines due for maintenance error:', error);
      return this.handleError(res, error);
    }
  }

  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryMachines(factoryId, companyId);
      return sendResponse(res, 200, 'Factory machines retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory machines error:', error);
      return this.handleError(res, error);
    }
  }

  async getByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentMachines(departmentId, companyId);
      return sendResponse(res, 200, 'Department machines retrieved successfully', result);
    } catch (error) {
      logger.error('Get department machines error:', error);
      return this.handleError(res, error);
    }
  }

  async search(req, res) {
    try {
      const { query, productionLineId } = req.query;
      const { companyId } = req;
      const result = await this.service.searchMachines(query, productionLineId, companyId);
      return sendResponse(res, 200, 'Machines found successfully', result);
    } catch (error) {
      logger.error('Search machines error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getMachineStats(id);
      return sendResponse(res, 200, 'Machine statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getProductionLineStats(req, res) {
    try {
      const { productionLineId } = req.params;
      const result = await this.service.getProductionLineMachineStats(productionLineId);
      return sendResponse(res, 200, 'Production line machine statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line machine stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getTypeDistribution(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getTypeDistribution(productionLineId, companyId);
      return sendResponse(res, 200, 'Type distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get type distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getStatusDistribution(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getStatusDistribution(productionLineId, companyId);
      return sendResponse(res, 200, 'Status distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get status distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getDashboard(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getMachineDashboard(id, companyId);
      return sendResponse(res, 200, 'Machine dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateMachine(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Machine updated successfully', result);
    } catch (error) {
      logger.error('Update machine error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'Machine status updated successfully', result);
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
      return sendResponse(res, 200, 'Machine performance updated successfully', result);
    } catch (error) {
      logger.error('Update performance error:', error);
      return this.handleError(res, error);
    }
  }

  async updateSensors(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateSensors(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Machine sensors updated successfully', result);
    } catch (error) {
      logger.error('Update sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async updateEnergy(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateEnergy(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Machine energy updated successfully', result);
    } catch (error) {
      logger.error('Update energy error:', error);
      return this.handleError(res, error);
    }
  }

  async updateGreenScore(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { score } = req.body;
      const result = await this.service.updateGreenScore(id, score, user.id, companyId);
      return sendResponse(res, 200, 'Machine green score updated successfully', result);
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
      return sendResponse(res, 200, 'Machine cost updated successfully', result);
    } catch (error) {
      logger.error('Update cost error:', error);
      return this.handleError(res, error);
    }
  }

  async start(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.startMachine(id, user.id, companyId);
      return sendResponse(res, 200, 'Machine started successfully', result);
    } catch (error) {
      logger.error('Start machine error:', error);
      return this.handleError(res, error);
    }
  }

  async stop(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.stopMachine(id, user.id, companyId);
      return sendResponse(res, 200, 'Machine stopped successfully', result);
    } catch (error) {
      logger.error('Stop machine error:', error);
      return this.handleError(res, error);
    }
  }

  async setMaintenance(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.setMaintenance(id, user.id, companyId);
      return sendResponse(res, 200, 'Machine set to maintenance mode successfully', result);
    } catch (error) {
      logger.error('Set maintenance error:', error);
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
      const result = await this.service.deleteMachine(id, user.id, companyId, reason);
      return sendDeleted(res, 'Machine deleted successfully');
    } catch (error) {
      logger.error('Delete machine error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FILTERS ============

  async filter(req, res) {
    try {
      const { companyId } = req;
      const { productionLineId, ...filters } = req.query;
      const result = await this.service.findWithFilters(filters, productionLineId, companyId);
      return sendPaginatedResponse(res, 'Machines filtered successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Filter machines error:', error);
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

module.exports = MachineController;