const BaseController = require('../../../core/base/BaseController');
const ReportService = require('../services/ReportService');
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

const createReportSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'carbon', 'energy', 'water', 'waste', 'production',
    'sustainability', 'custom', 'compliance', 'esg', 'summary'
  ).required(),
  format: Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html').default('pdf'),
  language: Joi.string().valid('en', 'ar', 'fr', 'es', 'de').default('en'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  period: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required()
  }).required(),
  filters: Joi.object({
    departments: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })),
    productionLines: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })),
    machines: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })),
    sensors: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' }))
  }).optional(),
  scheduling: Joi.object({
    enabled: Joi.boolean().default(false),
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').default('monthly'),
    dayOfWeek: Joi.number().min(1).max(7).optional(),
    dayOfMonth: Joi.number().min(1).max(31).optional(),
    time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00')
  }).optional(),
  delivery: Joi.object({
    email: Joi.boolean().default(false),
    recipients: Joi.array().items(Joi.string().email()),
    subject: Joi.string().optional(),
    message: Joi.string().optional(),
    push: Joi.boolean().default(false),
    download: Joi.boolean().default(true)
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateReportSchema = createReportSchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const generateSchema = Joi.object({
  generate: Joi.boolean().default(true)
});

const commentSchema = Joi.object({
  content: Joi.string().min(2).max(500).required()
});

const shareSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).min(1).required()
});

const scheduleSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').required(),
  dayOfWeek: Joi.number().min(1).max(7).optional(),
  dayOfMonth: Joi.number().min(1).max(31).optional(),
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json')
});

const deleteReportSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class ReportController extends BaseController {
  constructor() {
    super(new ReportService(), 'Report');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createReport(req.body, user.id, companyId);
      return sendCreated(res, 'Report created successfully', result);
    } catch (error) {
      logger.error('Create report error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ GENERATE ============

  async generate(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.generateReport(id, user.id, companyId);
      return sendResponse(res, 200, 'Report generated successfully', result);
    } catch (error) {
      logger.error('Generate report error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getReportsPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Reports retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get reports list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getReportById(id, companyId);
      return sendResponse(res, 200, 'Report retrieved successfully', result);
    } catch (error) {
      logger.error('Get report by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getReportByCode(code);
      return sendResponse(res, 200, 'Report retrieved successfully', result);
    } catch (error) {
      logger.error('Get report by code error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { companyId } = req;
      const { type } = req.params;
      const result = await this.service.getReportsByType(companyId, type);
      return sendResponse(res, 200, 'Reports by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get reports by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getByPeriod(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate } = req.query;
      
      const result = await this.service.getReportsByPeriod(companyId, startDate, endDate);
      return sendResponse(res, 200, 'Reports by period retrieved successfully', result);
    } catch (error) {
      logger.error('Get reports by period error:', error);
      return this.handleError(res, error);
    }
  }

  async getByStatus(req, res) {
    try {
      const { companyId } = req;
      const { status } = req.params;
      const result = await this.service.getReportsByStatus(companyId, status);
      return sendResponse(res, 200, 'Reports by status retrieved successfully', result);
    } catch (error) {
      logger.error('Get reports by status error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getReportStats(companyId);
      return sendResponse(res, 200, 'Report statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get report stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateReport(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Report updated successfully', result);
    } catch (error) {
      logger.error('Update report error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ COMMENTS ============

  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { content } = req.body;
      const result = await this.service.addComment(
        id,
        user.id,
        user.displayName || user.email,
        content,
        companyId
      );
      return sendResponse(res, 200, 'Comment added successfully', result);
    } catch (error) {
      logger.error('Add comment error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ SHARING ============

  async share(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { userIds } = req.body;
      const result = await this.service.shareReport(id, userIds, companyId);
      return sendResponse(res, 200, 'Report shared successfully', result);
    } catch (error) {
      logger.error('Share report error:', error);
      return this.handleError(res, error);
    }
  }

  async unshare(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { userIds } = req.body;
      const result = await this.service.unshareReport(id, userIds, companyId);
      return sendResponse(res, 200, 'Report unshared successfully', result);
    } catch (error) {
      logger.error('Unshare report error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ SCHEDULING ============

  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateSchedule(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Schedule updated successfully', result);
    } catch (error) {
      logger.error('Update schedule error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteReport(id, user.id, companyId, reason);
      return sendDeleted(res, 'Report deleted successfully');
    } catch (error) {
      logger.error('Delete report error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { companyId } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportReports(companyId, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=reports_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Reports exported successfully', data);
    } catch (error) {
      logger.error('Export reports error:', error);
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

module.exports = ReportController;