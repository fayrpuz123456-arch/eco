const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { validate } = require('../../../core/middleware/validation');
const authMiddleware = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions } = require('../../../core/middleware/permissions');
const { PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

// ============ SCHEMAS ============

const createDashboardSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'overview', 'sustainability', 'production', 'energy',
    'water', 'carbon', 'waste', 'maintenance', 'financial', 'custom'
  ).required(),
  layout: Joi.string().valid('grid', 'list', 'flex', 'custom').default('grid'),
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
  }).optional()
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
  isVisible: Joi.boolean().optional()
});

const reorderWidgetsSchema = Joi.object({
  widgetIds: Joi.array().items(Joi.string()).min(1).required()
});

const deleteDashboardSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ INSTANTIATE CONTROLLER ============

const controller = new DashboardController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/dashboards
 * @desc    قائمة لوحات التحكم
 * @access  Private
 */
router.get(
  '/',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/default
 * @desc    لوحة التحكم الافتراضية
 * @access  Private
 */
router.get(
  '/default',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getDefault.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/type/:type
 * @desc    لوحات التحكم حسب النوع
 * @access  Private
 */
router.get(
  '/type/:type',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getByType.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/pinned
 * @desc    لوحات التحكم المثبتة
 * @access  Private
 */
router.get(
  '/pinned',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getPinned.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/stats
 * @desc    إحصائيات لوحات التحكم
 * @access  Private
 */
router.get(
  '/stats',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/export
 * @desc    تصدير لوحات التحكم
 * @access  Private
 */
router.get(
  '/export',
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.export.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/:id
 * @desc    لوحة تحكم بالمعرف
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getById.bind(controller)
);

/**
 * @route   GET /api/v1/dashboards/:id/metrics
 * @desc    بيانات لوحة التحكم
 * @access  Private
 */
router.get(
  '/:id/metrics',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.getMetrics.bind(controller)
);

/**
 * @route   POST /api/v1/dashboards/:id/refresh
 * @desc    تحديث بيانات لوحة التحكم
 * @access  Private
 */
router.post(
  '/:id/refresh',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.refreshMetrics.bind(controller)
);

// ============ ADMIN ROUTES ============

/**
 * @route   POST /api/v1/dashboards
 * @desc    إنشاء لوحة تحكم
 * @access  Private
 */
router.post(
  '/',
  validate(createDashboardSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.create.bind(controller)
);

/**
 * @route   PUT /api/v1/dashboards/:id
 * @desc    تحديث لوحة تحكم
 * @access  Private
 */
router.put(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateDashboardSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.update.bind(controller)
);

/**
 * @route   POST /api/v1/dashboards/:id/default
 * @desc    تعيين لوحة تحكم كافتراضية
 * @access  Private
 */
router.post(
  '/:id/default',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.setDefault.bind(controller)
);

/**
 * @route   POST /api/v1/dashboards/:id/widgets
 * @desc    إضافة عنصر واجهة
 * @access  Private
 */
router.post(
  '/:id/widgets',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(addWidgetSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.addWidget.bind(controller)
);

/**
 * @route   DELETE /api/v1/dashboards/:id/widgets/:widgetId
 * @desc    إزالة عنصر واجهة
 * @access  Private
 */
router.delete(
  '/:id/widgets/:widgetId',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.removeWidget.bind(controller)
);

/**
 * @route   PUT /api/v1/dashboards/:id/widgets/:widgetId
 * @desc    تحديث عنصر واجهة
 * @access  Private
 */
router.put(
  '/:id/widgets/:widgetId',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateWidgetSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.updateWidget.bind(controller)
);

/**
 * @route   POST /api/v1/dashboards/:id/widgets/reorder
 * @desc    إعادة ترتيب عناصر الواجهة
 * @access  Private
 */
router.post(
  '/:id/widgets/reorder',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(reorderWidgetsSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.reorderWidgets.bind(controller)
);

/**
 * @route   DELETE /api/v1/dashboards/:id
 * @desc    حذف لوحة تحكم
 * @access  Private
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(deleteDashboardSchema),
  checkPermissions([PERMISSIONS.DASHBOARD_VIEW]),
  controller.delete.bind(controller)
);

module.exports = router;