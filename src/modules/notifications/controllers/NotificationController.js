const BaseController = require('../../../core/base/BaseController');
const NotificationService = require('../services/NotificationService');
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

const createNotificationSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  message: Joi.string().min(2).max(1000).required(),
  body: Joi.string().max(500).optional(),
  type: Joi.string().valid('info', 'success', 'warning', 'error', 'alert', 'reminder', 'update', 'report', 'notification', 'system').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  category: Joi.string().valid('system', 'security', 'maintenance', 'production', 'energy', 'water', 'carbon', 'waste', 'alert', 'report', 'user', 'company', 'factory', 'machine', 'sensor').required(),
  userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  channels: Joi.object({
    email: Joi.boolean().default(true),
    push: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    inApp: Joi.boolean().default(true),
    webhook: Joi.boolean().default(false)
  }).optional(),
  recipients: Joi.object({
    emails: Joi.array().items(Joi.string().email()),
    phones: Joi.array().items(Joi.string()),
    deviceTokens: Joi.array().items(Joi.string())
  }).optional(),
  actions: Joi.array().items(Joi.object({
    label: Joi.string().required(),
    url: Joi.string().required(),
    type: Joi.string().valid('link', 'button', 'action')
  })).optional(),
  data: Joi.object().optional(),
  scheduledAt: Joi.date().iso().optional(),
  expiresAt: Joi.date().iso().optional()
});

const bulkNotificationSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  message: Joi.string().min(2).max(1000).required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error', 'alert', 'reminder', 'update', 'report', 'notification', 'system').required(),
  category: Joi.string().valid('system', 'security', 'maintenance', 'production', 'energy', 'water', 'carbon', 'waste', 'alert', 'report', 'user', 'company', 'factory', 'machine', 'sensor').required(),
  userIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).min(1).required(),
  channels: Joi.object({
    email: Joi.boolean().default(true),
    push: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    inApp: Joi.boolean().default(true)
  }).optional()
});

const feedbackSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(500).optional()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  format: Joi.string().valid('json', 'csv').default('json')
});

// ============ CONTROLLER ============

class NotificationController extends BaseController {
  constructor() {
    super(new NotificationService(), 'Notification');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createNotification(req.body, user.id, companyId);
      return sendCreated(res, 'Notification created successfully', result);
    } catch (error) {
      logger.error('Create notification error:', error);
      return this.handleError(res, error);
    }
  }

  async bulkCreate(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.sendBulkNotifications(req.body, user.id, companyId);
      return sendCreated(res, 'Bulk notifications created successfully', result);
    } catch (error) {
      logger.error('Bulk create notifications error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { user, companyId } = req;
      const { page, limit, status, type } = req.query;
      
      const result = await this.service.getUserNotifications(
        user.id,
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          status,
          type
        }
      );
      
      return sendPaginatedResponse(res, 'Notifications retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get notifications list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.getNotificationById(id, user.id, companyId);
      return sendResponse(res, 200, 'Notification retrieved successfully', result);
    } catch (error) {
      logger.error('Get notification by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getUnread(req, res) {
    try {
      const { user } = req;
      const result = await this.service.getUnreadNotifications(user.id);
      return sendResponse(res, 200, 'Unread notifications retrieved successfully', result);
    } catch (error) {
      logger.error('Get unread notifications error:', error);
      return this.handleError(res, error);
    }
  }

  async getByType(req, res) {
    try {
      const { user } = req;
      const { type } = req.params;
      const result = await this.service.getNotificationsByType(user.id, type);
      return sendResponse(res, 200, 'Notifications by type retrieved successfully', result);
    } catch (error) {
      logger.error('Get notifications by type error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { user } = req;
      const result = await this.service.getNotificationStats(user.id);
      return sendResponse(res, 200, 'Notification statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get notification stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.markAsRead(id, user.id, companyId);
      return sendResponse(res, 200, 'Notification marked as read successfully', result);
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      return this.handleError(res, error);
    }
  }

  async markAllAsRead(req, res) {
    try {
      const { user } = req;
      const result = await this.service.markAllAsRead(user.id);
      return sendResponse(res, 200, 'All notifications marked as read successfully', result);
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      return this.handleError(res, error);
    }
  }

  async addFeedback(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const { rating, comment } = req.body;
      const result = await this.service.addFeedback(id, rating, comment, user.id, companyId);
      return sendResponse(res, 200, 'Feedback added successfully', result);
    } catch (error) {
      logger.error('Add feedback error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { user, companyId } = req;
      const result = await this.service.deleteNotification(id, user.id, companyId);
      return sendDeleted(res, 'Notification deleted successfully');
    } catch (error) {
      logger.error('Delete notification error:', error);
      return this.handleError(res, error);
    }
  }

  async deleteAll(req, res) {
    try {
      const { user } = req;
      const result = await this.service.deleteAllNotifications(user.id);
      return sendDeleted(res, 'All notifications deleted successfully');
    } catch (error) {
      logger.error('Delete all notifications error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  async export(req, res) {
    try {
      const { user } = req;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await this.service.exportNotifications(user.id, startDate, endDate, format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=notifications_${Date.now()}.csv`);
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Notifications exported successfully', data);
    } catch (error) {
      logger.error('Export notifications error:', error);
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

module.exports = NotificationController;