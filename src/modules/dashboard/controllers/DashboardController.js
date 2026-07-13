const BaseController = require('../../../core/base/BaseController');
const DashboardService = require('../services/DashboardService');
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
const { PERMISSIONS, checkPermissions } = require('../../../core/middleware/permissions');
const logger = require('../../../core/utils/logger');
const Joi = require('joi');
const { idSchema } = require('../../../core/middleware/validation');

// ============ SCHEMAS ============

const createDashboardSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'overview', 'sustainability', 'production', 'energy',
    'water', 'carbon', 'waste', 'maintenance', 'financial', 'custom'
  ).required(),
  layout: Joi.string().valid('grid', 'list', 'flex', 'custom').default('grid'),
  preferences: Joi.object({
    refreshRate: Joi.number().default(30),
    autoRefresh: Joi.boolean().default(true),
    theme: Joi.string().valid('light', 'dark', 'system').default('system'),
    viewMode: Joi.string().valid('compact', 'normal', 'expanded').default('normal'),
    columns: Joi.number().default(4)
  }).optional(),
  timePeriod: Joi.object({
    type: Joi.string().valid('today', 'week', 'month', 'quarter', 'year', 'custom').default('week'),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  }).optional(),
  settings: Joi.object({
    isPublic: Joi.boolean().default(false),
    pinned: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string())
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateDashboardSchema = createDashboardSchema.fork(
  ['name', 'type'],
  (schema) => schema.optional()
);

const addWidgetSchema = Joi.object({
  type: Joi.string().valid(
    'kpi', 'chart', 'table', 'list', 'map', 'gauge',
    'progress', 'calendar', 'alerts', 'notifications', 'reports', 'custom'
  ).required(),
  title: Joi.string().required(),
  description: Joi.string().optional(),
  size: Joi.object({
    width: Joi.number().default(2),
    height: Joi.number().default(2)
  }).optional(),
  position: Joi.object({
    x: Joi.number().default(0),
    y: Joi.number().default(0)
  }).optional(),
  data: Joi.object().optional(),
  config: Joi.object().optional(),
  refreshInterval: Joi.number().default(0)
});

const updateWidgetSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  size: Joi.object({
    width: Joi.number().optional(),
    height: Joi.number().optional()
  }).optional(),
  position: Joi.object({
    x: Joi.number().optional(),
    y: Joi.number().optional()
  }).optional(),
  data: Joi.object().optional(),
  config: Joi.object().optional(),
  refreshInterval: Joi.number().optional(),
  isVisible: Joi.boolean().optional()
});

const reorderWidgetsSchema = Joi.object({
  widgetIds: Joi.array().items(Joi.string()).min(1).required()
});

const deleteDashboardSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

class DashboardController extends BaseController {
  constructor() {
    super(new DashboardService(), 'Dashboard');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createDashboard(req.body, user.id, companyId);
      return sendCreated(res, 'Dashboard created successfully', result);
    } catch (error) {
      logger.error('Create dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { user, companyId } = req;
      const result = await this.service.getUserDashboards(user.id, companyId);
      return sendResponse(res, 200, 'Dashboards retrieved successfully', result);
    } catch (error) {
      logger.error('Get dashboards list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.getDashboardById(id, user.id, companyId);
      return sendResponse(res, 200, 'Dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get dashboard by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getDefault(req, res) {
    try {
      const { user, companyId } = req;
      const result = await this.service.getDefaultDashboard(user.id, companyId);
      return sendResponse(res, 200, 'Default dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get default dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { user, companyId } = req;
      const { type } = req.params;
      const result = await this.service.getDashboardsByType(user.id, companyId, type);
      return sendResponse(res, 200, 'Dashboards by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get dashboards by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getPinned(req, res) {
    try {
      const { user, companyId } = req;
      const result = await this.service.getPinnedDashboards(user.id, companyId);
      return sendResponse(res, 200, 'Pinned dashboards retrieved successfully', result);
    } catch (error) {
      logger.error('Get pinned dashboards error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ METRICS ============

  async getMetrics(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.getDashboardMetrics(id, user.id, companyId);
      return sendResponse(res, 200, 'Dashboard metrics retrieved successfully', result);
    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      return this.handleError(res, error);
    }
  }

  async refreshMetrics(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.refreshDashboardMetrics(id, user.id, companyId);
      return sendResponse(res, 200, 'Dashboard metrics refreshed successfully', result);
    } catch (error) {
      logger.error('Refresh dashboard metrics error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateDashboard(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Dashboard updated successfully', result);
    } catch (error) {
      logger.error('Update dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  async setDefault(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.setDefaultDashboard(id, user.id, companyId);
      return sendResponse(res, 200, 'Default dashboard set successfully', result);
    } catch (error) {
      logger.error('Set default dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ WIDGETS ============

  async addWidget(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addWidget(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Widget added successfully', result);
    } catch (error) {
      logger.error('Add widget error:', error);
      return this.handleError(res, error);
    }
  }

  async removeWidget(req, res) {
    try {
      const { id, widgetId } = req.params;
      const { user, companyId } = req;
      const result = await this.service.removeWidget(id, widgetId, user.id, companyId);
      return sendResponse(res, 200, 'Widget removed successfully', result);
    } catch (error) {
      logger.error('Remove widget error:', error);
      return this.handleError(res, error);
    }
  }

  async updateWidget(req, res) {
    try {
      const { id, widgetId } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateWidget(id, widgetId, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Widget updated successfully', result);
    } catch (error) {
      logger.error('Update widget error:', error);
      return this.handleError(res, error);
    }
  }

  async reorderWidgets(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { widgetIds } = req.body;
      const result = await this.service.reorderWidgets(id, widgetIds, user.id, companyId);
      return sendResponse(res, 200, 'Widgets reordered successfully', result);
    } catch (error) {
      logger.error('Reorder widgets error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteDashboard(id, user.id, companyId, reason);
      return sendDeleted(res, 'Dashboard deleted successfully');
    } catch (error) {
      logger.error('Delete dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  async getStats(req, res) {
    try {
      const { user, companyId } = req;
      const result = await this.service.getDashboardStats(user.id, companyId);
      return sendResponse(res, 200, 'Dashboard statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { user, companyId } = req;
      const { format = 'json' } = req.query;
      
      const data = await this.service.exportDashboards(user.id, companyId, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=dashboards_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Dashboards exported successfully', data);
    } catch (error) {
      logger.error('Export dashboards error:', error);
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

module.exports = DashboardController;