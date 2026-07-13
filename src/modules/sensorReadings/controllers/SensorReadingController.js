const BaseController = require('../../../core/base/BaseController');
const SensorReadingService = require('../services/SensorReadingService');
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

const createReadingSchema = Joi.object({
  sensorId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  value: Joi.number().required(),
  unit: Joi.string().optional(),
  timestamp: Joi.date().iso().optional(),
  quality: Joi.string().valid('good', 'average', 'poor', 'unknown').optional(),
  rawValue: Joi.number().optional(),
  metadata: Joi.object().optional()
});

const bulkReadingsSchema = Joi.object({
  readings: Joi.array().items(createReadingSchema).min(1).max(1000).required()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  limit: Joi.number().integer().min(1).max(10000).default(1000),
  interval: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').optional(),
  format: Joi.string().valid('json', 'csv').default('json'),
  threshold: Joi.number().min(1).max(10).default(3),
  days: Joi.number().integer().min(1).default(30)
});

const deleteOldReadingsSchema = Joi.object({
  days: Joi.number().integer().min(1).max(3650).required()
});

// ============ CONTROLLER ============

class SensorReadingController extends BaseController {
  constructor() {
    super(new SensorReadingService(), 'SensorReading');
    this.service = this.service;
  }

  // ============ CREATE ============

  /**
   * إنشاء قراءة جديدة
   * POST /api/v1/sensor-readings
   */
  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createReading(req.body, user.id, companyId);
      return sendCreated(res, 'Sensor reading created successfully', result);
    } catch (error) {
      logger.error('Create sensor reading error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إنشاء قراءات متعددة
   * POST /api/v1/sensor-readings/bulk
   */
  async bulkCreate(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.bulkCreateReadings(req.body.readings, user.id, companyId);
      return sendCreated(res, 'Bulk sensor readings created successfully', result);
    } catch (error) {
      logger.error('Bulk create sensor readings error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  /**
   * آخر قراءة لحساس
   * GET /api/v1/sensor-readings/last/:sensorId
   */
  async getLast(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const result = await this.service.getLastReading(sensorId, companyId);
      return sendResponse(res, 200, 'Last reading retrieved successfully', result);
    } catch (error) {
      logger.error('Get last reading error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * قراءات حساس في فترة زمنية
   * GET /api/v1/sensor-readings/sensor/:sensorId
   */
  async getBySensor(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getReadingsInRange(
        sensorId,
        startDate,
        endDate,
        parseInt(limit) || 1000,
        companyId
      );
      
      return sendResponse(res, 200, 'Sensor readings retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor readings error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إحصائيات قراءات حساس
   * GET /api/v1/sensor-readings/sensor/:sensorId/stats
   */
  async getStats(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getReadingsStats(sensorId, startDate, endDate, companyId);
      return sendResponse(res, 200, 'Sensor reading statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor reading stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * قراءات مقسمة حسب الفترة
   * GET /api/v1/sensor-readings/sensor/:sensorId/interval
   */
  async getByInterval(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, interval } = req.query;
      
      const result = await this.service.getReadingsByInterval(
        sensorId,
        startDate,
        endDate,
        interval,
        companyId
      );
      
      return sendResponse(res, 200, 'Sensor readings by interval retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor readings by interval error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * ملخص قراءات حساس
   * GET /api/v1/sensor-readings/sensor/:sensorId/summary
   */
  async getSummary(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getSensorSummary(sensorId, startDate, endDate, companyId);
      return sendResponse(res, 200, 'Sensor reading summary retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor reading summary error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الكشف عن الشذوذ
   * GET /api/v1/sensor-readings/sensor/:sensorId/anomalies
   */
  async getAnomalies(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, threshold } = req.query;
      
      const result = await this.service.detectAnomalies(
        sensorId,
        startDate,
        endDate,
        parseFloat(threshold) || 3,
        companyId
      );
      
      return sendResponse(res, 200, 'Anomalies detected successfully', result);
    } catch (error) {
      logger.error('Detect anomalies error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * قراءات آلة
   * GET /api/v1/sensor-readings/machine/:machineId
   */
  async getByMachine(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getMachineReadings(
        machineId,
        startDate,
        endDate,
        parseInt(limit) || 1000,
        companyId
      );
      
      return sendResponse(res, 200, 'Machine readings retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine readings error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إحصائيات قراءات آلة
   * GET /api/v1/sensor-readings/machine/:machineId/stats
   */
  async getMachineStats(req, res) {
    try {
      const { machineId } = req.params;
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getMachineReadingsStats(machineId, startDate, endDate, companyId);
      return sendResponse(res, 200, 'Machine reading statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get machine reading stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * قراءات مصنع
   * GET /api/v1/sensor-readings/factory/:factoryId
   */
  async getByFactory(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, limit } = req.query;
      
      const result = await this.service.getFactoryReadings(
        factoryId,
        startDate,
        endDate,
        parseInt(limit) || 1000,
        companyId
      );
      
      return sendResponse(res, 200, 'Factory readings retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory readings error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إحصائيات قراءات مصنع
   * GET /api/v1/sensor-readings/factory/:factoryId/stats
   */
  async getFactoryStats(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getFactoryReadingsStats(factoryId, startDate, endDate, companyId);
      return sendResponse(res, 200, 'Factory reading statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory reading stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إحصائيات قراءات الشركة
   * GET /api/v1/sensor-readings/company/stats
   */
  async getCompanyStats(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getCompanyReadingsStats(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Company reading statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get company reading stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * لوحة تحكم قراءات الحساس
   * GET /api/v1/sensor-readings/sensor/:sensorId/dashboard
   */
  async getDashboard(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getSensorReadingsDashboard(
        sensorId,
        startDate,
        endDate,
        companyId
      );
      
      return sendResponse(res, 200, 'Sensor readings dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get sensor readings dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * القراءات اللحظية
   * GET /api/v1/sensor-readings/realtime
   */
  async getRealtime(req, res) {
    try {
      const { companyId } = req;
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await this.service.getRealtimeReadings(companyId, limit);
      return sendResponse(res, 200, 'Realtime readings retrieved successfully', result);
    } catch (error) {
      logger.error('Get realtime readings error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تصدير القراءات
   * GET /api/v1/sensor-readings/sensor/:sensorId/export
   */
  async exportReadings(req, res) {
    try {
      const { sensorId } = req.params;
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportReadings(
        sensorId,
        startDate,
        endDate,
        format,
        companyId
      );
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=readings_${sensorId}_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Readings exported successfully', data);
    } catch (error) {
      logger.error('Export readings error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  /**
   * حذف القراءات القديمة
   * DELETE /api/v1/sensor-readings/old
   */
  async deleteOld(req, res) {
    try {
      const { companyId } = req;
      const { days } = req.body;
      
      const result = await this.service.deleteOldReadings(days, companyId);
      return sendDeleted(res, `Deleted ${result.deletedCount} old readings`);
    } catch (error) {
      logger.error('Delete old readings error:', error);
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
      case 'BadRequestError':
        return sendError(res, 400, error.message);
      default:
        return sendError(res, error.statusCode || 500, error.message);
    }
  }
}

module.exports = SensorReadingController;