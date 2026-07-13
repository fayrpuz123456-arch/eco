const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { validate } = require('../../../core/middleware/validation');
const authMiddleware = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, checkRole } = require('../../../core/middleware/permissions');
const { PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

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
  tags: Joi.array().items(Joi.string()).default([])
});

const updateReportSchema = createReportSchema.fork(
  ['name', 'code', 'type'],
  (schema) => schema.optional()
);

const commentSchema = Joi.object({
  content: Joi.string().min(2).max(500).required()
});

const shareSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })).min(1).required()
});

const scheduleSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').required(),
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

// ============ INSTANTIATE CONTROLLER ============

const controller = new ReportController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/reports
 * @desc    قائمة التقارير
 * @access  Private
 */
router.get(
  '/',
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/reports/type/:type
 * @desc    التقارير حسب النوع
 * @access  Private
 */
router.get(
  '/type/:type',
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getByType.bind(controller)
);

/**
 * @route   GET /api/v1/reports/period
 * @desc    التقارير حسب الفترة
 * @access  Private
 */
router.get(
  '/period',
  validate(dateRangeSchema, 'query'),
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getByPeriod.bind(controller)
);

/**
 * @route   GET /api/v1/reports/status/:status
 * @desc    التقارير حسب الحالة
 * @access  Private
 */
router.get(
  '/status/:status',
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getByStatus.bind(controller)
);

/**
 * @route   GET /api/v1/reports/stats
 * @desc    إحصائيات التقارير
 * @access  Private
 */
router.get(
  '/stats',
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/reports/export
 * @desc    تصدير التقارير
 * @access  Private
 */
router.get(
  '/export',
  validate(dateRangeSchema, 'query'),
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.export.bind(controller)
);

/**
 * @route   GET /api/v1/reports/code/:code
 * @desc    تقرير بالكود
 * @access  Private
 */
router.get(
  '/code/:code',
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getByCode.bind(controller)
);

/**
 * @route   GET /api/v1/reports/:id
 * @desc    تقرير بالمعرف
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.getById.bind(controller)
);

/**
 * @route   POST /api/v1/reports/:id/generate
 * @desc    توليد تقرير
 * @access  Private
 */
router.post(
  '/:id/generate',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.REPORTS_CREATE]),
  controller.generate.bind(controller)
);

// ============ ADMIN ROUTES ============

/**
 * @route   POST /api/v1/reports
 * @desc    إنشاء تقرير
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  validate(createReportSchema),
  checkPermissions([PERMISSIONS.REPORTS_CREATE]),
  controller.create.bind(controller)
);

/**
 * @route   PUT /api/v1/reports/:id
 * @desc    تحديث تقرير
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateReportSchema),
  checkPermissions([PERMISSIONS.REPORTS_UPDATE]),
  controller.update.bind(controller)
);

/**
 * @route   POST /api/v1/reports/:id/comments
 * @desc    إضافة تعليق
 * @access  Private
 */
router.post(
  '/:id/comments',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(commentSchema),
  checkPermissions([PERMISSIONS.REPORTS_VIEW]),
  controller.addComment.bind(controller)
);

/**
 * @route   POST /api/v1/reports/:id/share
 * @desc    مشاركة التقرير
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/share',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(shareSchema),
  checkPermissions([PERMISSIONS.REPORTS_UPDATE]),
  controller.share.bind(controller)
);

/**
 * @route   POST /api/v1/reports/:id/unshare
 * @desc    إلغاء المشاركة
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/unshare',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(shareSchema),
  checkPermissions([PERMISSIONS.REPORTS_UPDATE]),
  controller.unshare.bind(controller)
);

/**
 * @route   PUT /api/v1/reports/:id/schedule
 * @desc    تحديث الجدولة
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/schedule',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(scheduleSchema),
  checkPermissions([PERMISSIONS.REPORTS_UPDATE]),
  controller.updateSchedule.bind(controller)
);

/**
 * @route   DELETE /api/v1/reports/:id
 * @desc    حذف تقرير
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(deleteReportSchema),
  checkRole(['super_admin', 'admin']),
  checkPermissions([PERMISSIONS.REPORTS_DELETE]),
  controller.delete.bind(controller)
);

module.exports = router;