const BaseController = require('../../../core/base/BaseController');
const AlertService = require('../services/AlertService');
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

const createAlertSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'threshold', 'anomaly', 'maintenance', 'system',
    'safety', 'quality', 'production', 'energy',
    'water', 'carbon', 'waste', 'sensor', 'machine', 'security'
  ).required(),
  severity: Joi.string().valid('info', 'warning', 'critical', 'emergency').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  source: Joi.object({
    sensorId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
    machineId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
    productionLineId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
    departmentId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
    sourceType: Joi.string().valid('sensor', 'machine', 'production_line', 'department', 'factory', 'system').required()
  }).required(),
  condition: Joi.object({
    operator: Joi.string().valid('>', '>=', '<', '<=', '==', '!=', 'between', 'outside').required(),
    value: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    value2: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    threshold: Joi.number().optional(),
    duration: Joi.number().optional(),
    frequency: Joi.number().optional()
  }).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  triggeredValue: Joi.number().optional(),
  notifications: Joi.object({
    email: Joi.boolean().default(true),
    push: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    inApp: Joi.boolean().default(true),
    webhook: Joi.boolean().default(false)
  }).optional(),
  recipients: Joi.object({
    users: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })),
    emails: Joi.array().items(Joi.string().email()),
    phones: Joi.array().items(Joi.string())
  }).optional(),
  escalation: Joi.object({
    enabled: Joi.boolean().default(false),
    levels: Joi.array().items(Joi.object({
      level: Joi.number().required(),
      delayMinutes: Joi.number().required(),
      recipients: Joi.object({
        users: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })),
        emails: Joi.array().items(Joi.string().email()),
        phones: Joi.array().items(Joi.string())
      }).required()
    }))
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateAlertSchema = createAlertSchema.fork(
  ['name', 'type', 'severity'],
  (schema) => schema.optional()
);

const acknowledgeSchema = Joi.object({
  note: Joi.string().max(500).optional()
});

const resolveSchema = Joi.object({
  note: Joi.string().max(500).optional(),
  action: Joi.string().max(200).optional()
});

const reopenSchema = Joi.object({
  note: Joi.string().max(500).optional()
});

const bulkActionSchema = Joi.object({
  alertIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).min(1).required()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json')
});

const deleteAlertSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class AlertController extends BaseController {
  constructor() {
    super(new AlertService(), 'Alert');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createAlert(req.body, user.id, companyId);
      return sendCreated(res, 'Alert created successfully', result);
    } catch (error) {
      logger.error('Create alert error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getAlertsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Alerts retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get alerts list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getAlertById(id, companyId);
      return sendResponse(res, 200, 'Alert retrieved successfully', result);
    } catch (error) {
      logger.error('Get alert by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getActive(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getActiveAlerts(companyId);
      return sendResponse(res, 200, 'Active alerts retrieved successfully', result);
    } catch (error) {
      logger.error('Get active alerts error:', error);
      return this.handleError(res, error);
    }
  }

  async getBySeverity(req, res) {
    try {
      const { companyId } = req;
      const { severity } = req.params;
      const result = await this.service.getAlertsBySeverity(companyId, severity);
      return sendResponse(res, 200, 'Alerts by severity retrieved successfully', result);
    } catch (error) {
      logger.error('Get alerts by severity error:', error);
      return this.handleError(res, error);
    }
  }

  async getBySource(req, res) {
    try {
      const { companyId } = req;
      const { sourceType, sourceId } = req.params;
      const result = await this.service.getAlertsBySource(companyId, sourceType, sourceId);
      return sendResponse(res, 200, 'Alerts by source retrieved successfully', result);
    } catch (error) {
      logger.error('Get alerts by source error:', error);
      return this.handleError(res, error);
    }
  }

  async getCritical(req, res) {
    try {
      const { companyId } = req;
      const hours = parseInt(req.query.hours) || 24;
      const result = await this.service.getCriticalAlerts(companyId, hours);
      return sendResponse(res, 200, 'Critical alerts retrieved successfully', result);
    } catch (error) {
      logger.error('Get critical alerts error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getStats(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getAlertStats(companyId);
      return sendResponse(res, 200, 'Alert statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get alert stats error:', error);
      return this.handleError(res, error);
    }
  }

  async getDistribution(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getTypeDistribution(companyId);
      return sendResponse(res, 200, 'Alert distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get alert distribution error:', error);
      return this.handleError(res, error);
    }
  }

  async getTrend(req, res) {
    try {
      const { companyId } = req;
      const days = parseInt(req.query.days) || 30;
      const result = await this.service.getAlertTrend(companyId, days);
      return sendResponse(res, 200, 'Alert trend retrieved successfully', result);
    } catch (error) {
      logger.error('Get alert trend error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateAlert(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Alert updated successfully', result);
    } catch (error) {
      logger.error('Update alert error:', error);
      return this.handleError(res, error);
    }
  }

  async acknowledge(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { note } = req.body;
      const result = await this.service.acknowledgeAlert(id, user.id, companyId, note);
      return sendResponse(res, 200, 'Alert acknowledged successfully', result);
    } catch (error) {
      logger.error('Acknowledge alert error:', error);
      return this.handleError(res, error);
    }
  }

  async resolve(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { note, action } = req.body;
      const result = await this.service.resolveAlert(id, user.id, companyId, note, action);
      return sendResponse(res, 200, 'Alert resolved successfully', result);
    } catch (error) {
      logger.error('Resolve alert error:', error);
      return this.handleError(res, error);
    }
  }

  async reopen(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { note } = req.body;
      const result = await this.service.reopenAlert(id, user.id, companyId, note);
      return sendResponse(res, 200, 'Alert reopened successfully', result);
    } catch (error) {
      logger.error('Reopen alert error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ BULK OPERATIONS ============

  async bulkAcknowledge(req, res) {
    try {
      const { companyId, user } = req;
      const { alertIds } = req.body;
      const result = await this.service.bulkAcknowledge(alertIds, user.id, companyId);
      return sendResponse(res, 200, 'Alerts acknowledged successfully', result);
    } catch (error) {
      logger.error('Bulk acknowledge alerts error:', error);
      return this.handleError(res, error);
    }
  }

  async bulkResolve(req, res) {
    try {
      const { companyId, user } = req;
      const { alertIds } = req.body;
      const result = await this.service.bulkResolve(alertIds, user.id, companyId);
      return sendResponse(res, 200, 'Alerts resolved successfully', result);
    } catch (error) {
      logger.error('Bulk resolve alerts error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DASHBOARD ============

  async getDashboard(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getAlertDashboard(companyId);
      return sendResponse(res, 200, 'Alert dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get alert dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteAlert(id, user.id, companyId, reason);
      return sendDeleted(res, 'Alert deleted successfully');
    } catch (error) {
      logger.error('Delete alert error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportAlerts(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=alerts_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Alerts exported successfully', data);
    } catch (error) {
      logger.error('Export alerts error:', error);
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

module.exports = AlertController;