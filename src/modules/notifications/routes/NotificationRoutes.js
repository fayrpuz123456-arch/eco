const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { validate } = require('../../../core/middleware/validation');
const authMiddleware = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, checkRole } = require('../../../core/middleware/permissions');
const { PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

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
    inApp: Joi.boolean().default(true)
  }).optional(),
  scheduledAt: Joi.date().iso().optional()
});

const bulkNotificationSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  message: Joi.string().min(2).max(1000).required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error', 'alert', 'reminder', 'update', 'report', 'notification', 'system').required(),
  category: Joi.string().valid('system', 'security', 'maintenance', 'production', 'energy', 'water', 'carbon', 'waste', 'alert', 'report', 'user', 'company', 'factory', 'machine', 'sensor').required(),
  userIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).min(1).required()
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

// ============ INSTANTIATE CONTROLLER ============

const controller = new NotificationController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/notifications
 * @desc    قائمة الإشعارات
 * @access  Private
 */
router.get(
  '/',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/notifications/unread
 * @desc    الإشعارات غير المقروءة
 * @access  Private
 */
router.get(
  '/unread',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.getUnread.bind(controller)
);

/**
 * @route   GET /api/v1/notifications/type/:type
 * @desc    الإشعارات حسب النوع
 * @access  Private
 */
router.get(
  '/type/:type',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.getByType.bind(controller)
);

/**
 * @route   GET /api/v1/notifications/stats
 * @desc    إحصائيات الإشعارات
 * @access  Private
 */
router.get(
  '/stats',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/notifications/export
 * @desc    تصدير الإشعارات
 * @access  Private
 */
router.get(
  '/export',
  validate(dateRangeSchema, 'query'),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.export.bind(controller)
);

/**
 * @route   GET /api/v1/notifications/:id
 * @desc    إشعار بالمعرف
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.getById.bind(controller)
);

// ============ ADMIN ROUTES ============

/**
 * @route   POST /api/v1/notifications
 * @desc    إنشاء إشعار
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  validate(createNotificationSchema),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_SEND]),
  controller.create.bind(controller)
);

/**
 * @route   POST /api/v1/notifications/bulk
 * @desc    إنشاء إشعارات متعددة
 * @access  Private (Admin, Manager)
 */
router.post(
  '/bulk',
  validate(bulkNotificationSchema),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_SEND]),
  controller.bulkCreate.bind(controller)
);

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    وضع علامة كمقروء
 * @access  Private
 */
router.put(
  '/:id/read',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.markAsRead.bind(controller)
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    وضع علامة كمقروءة للكل
 * @access  Private
 */
router.put(
  '/read-all',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.markAllAsRead.bind(controller)
);

/**
 * @route   POST /api/v1/notifications/:id/feedback
 * @desc    إضافة ردود فعل
 * @access  Private
 */
router.post(
  '/:id/feedback',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(feedbackSchema),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.addFeedback.bind(controller)
);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    حذف إشعار
 * @access  Private
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.delete.bind(controller)
);

/**
 * @route   DELETE /api/v1/notifications/all
 * @desc    حذف كل الإشعارات
 * @access  Private
 */
router.delete(
  '/all',
  checkPermissions([PERMISSIONS.NOTIFICATIONS_VIEW]),
  controller.deleteAll.bind(controller)
);

module.exports = router;