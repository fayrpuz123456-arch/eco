const BaseController = require('../../../core/base/BaseController');
const SensorService = require('../services/SensorService');
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

const createSensorSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'PZEM004T', 'Current', 'Voltage', 'Power', 'Energy',
    'WaterFlow', 'FuelFlow', 'WaterLevel', 'Pressure',
    'MQ135', 'MQ2', 'MQ7', 'CO2',
    'Temperature', 'Humidity', 'Rain', 'Ultrasonic', 'HeatSensor',
    'Vibration', 'Accelerometer', 'Gyroscope',
    'Light', 'Sound', 'Proximity', 'IR', 'GPS', 'RPM', 'Torque',
    'Force', 'Flow', 'Level', 'pH', 'Conductivity', 'Turbidity',
    'DissolvedOxygen', 'Other'
  ).required(),
  category: Joi.string().valid(
    'energy', 'water', 'fuel', 'air_quality',
    'environment', 'mechanical', 'vibration',
    'position', 'optical', 'acoustic', 'chemical', 'other'
  ).required(),
  unit: Joi.string().required(),
  precision: Joi.number().min(0).max(10).default(2),
  machineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  productionLineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  manufacturer: Joi.object({
    name: Joi.string().optional(),
    model: Joi.string().optional(),
    serialNumber: Joi.string().optional(),
    year: Joi.number().min(1900).max(new Date().getFullYear() + 5).optional()
  }).optional(),
  specifications: Joi.object({
    measurementRange: Joi.object({
      min: Joi.number().default(0),
      max: Joi.number().default(100)
    }).optional(),
    accuracy: Joi.number().default(0),
    resolution: Joi.number().default(0),
    responseTime: Joi.number().default(0),
    operatingTemperature: Joi.object({
      min: Joi.number().default(-10),
      max: Joi.number().default(50)
    }).optional(),
    powerSupply: Joi.object({
      voltage: Joi.number().default(5),
      current: Joi.number().default(0.02),
      power: Joi.number().default(0.1)
    }).optional(),
    communication: Joi.object({
      protocol: Joi.string().valid('MQTT', 'Modbus', 'I2C', 'SPI', 'UART', 'CAN', 'WiFi', 'BLE', 'LoRa', 'Zigbee', 'Other')
        .default('MQTT'),
      address: Joi.string().optional(),
      baudRate: Joi.number().default(9600)
    }).optional()
  }).optional(),
  thresholds: Joi.object({
    min: Joi.number().allow(null).optional(),
    max: Joi.number().allow(null).optional(),
    warning: Joi.object({
      min: Joi.number().allow(null).optional(),
      max: Joi.number().allow(null).optional()
    }).optional(),
    critical: Joi.object({
      min: Joi.number().allow(null).optional(),
      max: Joi.number().allow(null).optional()
    }).optional(),
    alertDelay: Joi.number().default(0)
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateSensorSchema = createSensorSchema.fork(
  ['name', 'code', 'type', 'category', 'unit', 'machineId', 'factoryId', 'departmentId', 'productionLineId'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'offline', 'maintenance', 'error', 'archived').required()
});

const updateReadingSchema = Joi.object({
  value: Joi.number().required(),
  quality: Joi.string().valid('good', 'average', 'poor', 'unknown').default('good')
});

const updateCalibrationSchema = Joi.object({
  offset: Joi.number().required(),
  multiplier: Joi.number().required(),
  performedBy: Joi.string().optional(),
  notes: Joi.string().optional()
});

const updateBatterySchema = Joi.object({
  batteryLevel: Joi.number().min(0).max(100).required()
});

const addMaintenanceRecordSchema = Joi.object({
  type: Joi.string().valid('calibration', 'cleaning', 'repair', 'replacement').required(),
  description: Joi.string().required(),
  performedBy: Joi.string().optional(),
  cost: Joi.number().min(0).optional(),
  notes: Joi.string().optional(),
  nextMaintenance: Joi.date().iso().optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('active', 'inactive', 'offline', 'maintenance', 'error', 'archived'),
  type: Joi.string().valid(
    'PZEM004T', 'Current', 'Voltage', 'Power', 'Energy',
    'WaterFlow', 'FuelFlow', 'WaterLevel', 'Pressure',
    'MQ135', 'MQ2', 'MQ7', 'CO2',
    'Temperature', 'Humidity', 'Rain', 'Ultrasonic', 'HeatSensor',
    'Vibration', 'Accelerometer', 'Gyroscope',
    'Light', 'Sound', 'Proximity', 'IR', 'GPS', 'RPM', 'Torque',
    'Force', 'Flow', 'Level', 'pH', 'Conductivity', 'Turbidity',
    'DissolvedOxygen', 'Other'
  ),
  category: Joi.string().valid(
    'energy', 'water', 'fuel', 'air_quality',
    'environment', 'mechanical', 'vibration',
    'position', 'optical', 'acoustic', 'chemical', 'other'
  ),
  machineId: Joi.string().uuid({ version: 'uuidv4' }),
  lowBattery: Joi.number().min(0).max(100),
  dueForCalibration: Joi.number().min(1).max(365),
  hasReadings: Joi.boolean(),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteSensorSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class SensorController extends BaseController {
  constructor() {
    super(new SensorService(), 'Sensor');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createSensor(req.body, user.id, companyId);
      return sendCreated(res, 'Sensor created successfully', result);
    } catch (error) {
      logger.error('Create sensor error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getSensorsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Sensors retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get sensors list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getSensorById(id, companyId);
      return sendResponse(res, 200, 'Sensor retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code, machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getSensorByCode(code, machineId, companyId);
      return sendResponse(res, 200, 'Sensor retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByMachine(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getMachineSensors(machineId, companyId);
      return sendResponse(res, 200, 'Machine sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getActive(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getActiveSensors(machineId, companyId);
      return sendResponse(res, 200, 'Active sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get active sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { type, machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getSensorsByType(type, machineId, companyId);
      return sendResponse(res, 200, 'Sensors by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensors by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getDueForCalibration(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const days = parseInt(req.query.days) || 7;
      const result = await this.service.getSensorsDueForCalibration(days, machineId, companyId);
      return sendResponse(res, 200, 'Sensors due for calibration retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensors due for calibration error:', error);
      return this.handleError(res, error);
    }
  }

  async getLowBattery(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const threshold = parseInt(req.query.threshold) || 20;
      const result = await this.service.getLowBatterySensors(threshold, machineId, companyId);
      return sendResponse(res, 200, 'Low battery sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get low battery sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactorySensors(factoryId, companyId);
      return sendResponse(res, 200, 'Factory sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { companyId } = req;
      const result = await this.service.getDepartmentSensors(departmentId, companyId);
      return sendResponse(res, 200, 'Department sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get department sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getByProductionLine(req, res) {
    try {
      const { productionLineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getProductionLineSensors(productionLineId, companyId);
      return sendResponse(res, 200, 'Production line sensors retrieved successfully', result);
    } catch (error) {
      logger.error('Get production line sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async search(req, res) {
    try {
      const { query, machineId } = req.query;
      const { companyId } = req;
      const result = await this.service.searchSensors(query, machineId, companyId);
      return sendResponse(res, 200, 'Sensors found successfully', result);
    } catch (error) {
      logger.error('Search sensors error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getSensorStats(id);
      return sendResponse(res, 200, 'Sensor statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getMachineStats(req, res) {
    try {
      const { machineId } = req.params;
      const result = await this.service.getMachineSensorStats(machineId);
      return sendResponse(res, 200, 'Machine sensor statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine sensor stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getTypeDistribution(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getTypeDistribution(machineId, companyId);
      return sendResponse(res, 200, 'Type distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get type distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getCategoryDistribution(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const result = await this.service.getCategoryDistribution(machineId, companyId);
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
      const result = await this.service.getSensorDashboard(id, companyId);
      return sendResponse(res, 200, 'Sensor dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateSensor(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Sensor updated successfully', result);
    } catch (error) {
      logger.error('Update sensor error:', error);
      return this.handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id, companyId);
      return sendResponse(res, 200, 'Sensor status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  async updateReading(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { value, quality } = req.body;
      const result = await this.service.updateLastReading(id, value, user.id, companyId);
      return sendResponse(res, 200, 'Sensor reading updated successfully', result);
    } catch (error) {
      logger.error('Update reading error:', error);
      return this.handleError(res, error);
    }
  }

  async updateCalibration(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { offset, multiplier, performedBy, notes } = req.body;
      const result = await this.service.updateCalibration(
        id,
        offset,
        multiplier,
        performedBy || user.displayName,
        user.id,
        companyId
      );
      return sendResponse(res, 200, 'Sensor calibration updated successfully', result);
    } catch (error) {
      logger.error('Update calibration error:', error);
      return this.handleError(res, error);
    }
  }

  async updateBattery(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { batteryLevel } = req.body;
      const result = await this.service.updateBatteryLevel(id, batteryLevel, user.id, companyId);
      return sendResponse(res, 200, 'Sensor battery updated successfully', result);
    } catch (error) {
      logger.error('Update battery error:', error);
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
      const result = await this.service.deleteSensor(id, user.id, companyId, reason);
      return sendDeleted(res, 'Sensor deleted successfully');
    } catch (error) {
      logger.error('Delete sensor error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FILTERS ============

  async filter(req, res) {
    try {
      const { companyId } = req;
      const { machineId, ...filters } = req.query;
      const result = await this.service.findWithFilters(filters, machineId, companyId);
      return sendPaginatedResponse(res, 'Sensors filtered successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Filter sensors error:', error);
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

module.exports = SensorController;