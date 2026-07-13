const express = require('express');
const router = express.Router();
const ProductionLineController = require('../controllers/ProductionLineController');
const { validate } = require('../../../core/middleware/validation');
const authMiddleware = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, checkRole } = require('../../../core/middleware/permissions');
const { PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

// ============ SCHEMAS ============

const createProductionLineSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(10).uppercase().required(),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid(
    'assembly', 'packaging', 'processing', 'manufacturing',
    'filling', 'cutting', 'welding', 'painting',
    'quality_control', 'testing', 'maintenance', 'material_handling', 'other'
  ).required(),
  category: Joi.string().valid('manual', 'semi_automated', 'fully_automated', 'robotic', 'hybrid')
    .default('semi_automated'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateProductionLineSchema = createProductionLineSchema.fork(
  ['name', 'code', 'type', 'departmentId', 'factoryId'],
  (schema) => schema.optional()
);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'stopped', 'archived').required()
});

const updatePerformanceSchema = Joi.object({
  oee: Joi.number().min(0).max(100).optional(),
  availability: Joi.number().min(0).max(100).optional(),
  performance: Joi.number().min(0).max(100).optional(),
  quality: Joi.number().min(0).max(100).optional(),
  throughput: Joi.number().min(0).optional(),
  cycleTime: Joi.number().min(0).optional(),
  changeoverTime: Joi.number().min(0).optional()
});

const updateGreenScoreSchema = Joi.object({
  score: Joi.number().min(0).max(100).required()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'stopped', 'archived'),
  type: Joi.string().valid(
    'assembly', 'packaging', 'processing', 'manufacturing',
    'filling', 'cutting', 'welding', 'painting',
    'quality_control', 'testing', 'maintenance', 'material_handling', 'other'
  ),
  category: Joi.string().valid('manual', 'semi_automated', 'fully_automated', 'robotic', 'hybrid'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  departmentId: Joi.string().uuid({ version: 'uuidv4' }),
  minOEE: Joi.number().min(0).max(100),
  maxOEE: Joi.number().min(0).max(100),
  minGreenScore: Joi.number().min(0).max(100),
  maxGreenScore: Joi.number().min(0).max(100),
  isRunning: Joi.boolean(),
  tag: Joi.string(),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteProductionLineSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

const addMaintenanceRecordSchema = Joi.object({
  type: Joi.string().required(),
  description: Joi.string().required(),
  duration: Joi.number().min(0).optional(),
  performedBy: Joi.string().optional(),
  cost: Joi.number().min(0).optional(),
  nextMaintenance: Joi.date().iso().optional()
});

// ============ INSTANTIATE CONTROLLER ============

const controller = new ProductionLineController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/production-lines
 * @desc    قائمة خطوط الإنتاج
 * @access  Private
 */
router.get(
  '/',
  validate(filterSchema, 'query'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId
 * @desc    خطوط إنتاج القسم
 * @access  Private
 */
router.get(
  '/department/:departmentId',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getByDepartment.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId/active
 * @desc    خطوط الإنتاج النشطة في القسم
 * @access  Private
 */
router.get(
  '/department/:departmentId/active',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getActive.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId/high-performance
 * @desc    خطوط الإنتاج ذات الأداء العالي
 * @access  Private
 */
router.get(
  '/department/:departmentId/high-performance',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getHighPerformance.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId/stats
 * @desc    إحصائيات خطوط الإنتاج في القسم
 * @access  Private
 */
router.get(
  '/department/:departmentId/stats',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getDepartmentStats.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId/distribution/type
 * @desc    توزيع خطوط الإنتاج حسب النوع
 * @access  Private
 */
router.get(
  '/department/:departmentId/distribution/type',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getTypeDistribution.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/department/:departmentId/distribution/category
 * @desc    توزيع خطوط الإنتاج حسب الفئة
 * @access  Private
 */
router.get(
  '/department/:departmentId/distribution/category',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getCategoryDistribution.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/factory/:factoryId
 * @desc    خطوط إنتاج المصنع
 * @access  Private
 */
router.get(
  '/factory/:factoryId',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getByFactory.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/search
 * @desc    بحث عن خطوط الإنتاج
 * @access  Private
 */
router.get(
  '/search',
  validate(Joi.object({ 
    query: Joi.string().min(2).required(),
    departmentId: Joi.string().uuid({ version: 'uuidv4' }).optional()
  }), 'query'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.search.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/filter
 * @desc    تصفية خطوط الإنتاج
 * @access  Private
 */
router.get(
  '/filter',
  validate(filterSchema, 'query'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.filter.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/code/:code/department/:departmentId
 * @desc    خط إنتاج بالكود
 * @access  Private
 */
router.get(
  '/code/:code/department/:departmentId',
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getByCode.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/:id
 * @desc    خط إنتاج بالمعرف
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getById.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/:id/stats
 * @desc    إحصائيات خط الإنتاج
 * @access  Private
 */
router.get(
  '/:id/stats',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/production-lines/:id/dashboard
 * @desc    لوحة تحكم خط الإنتاج
 * @access  Private
 */
router.get(
  '/:id/dashboard',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_VIEW]),
  controller.getDashboard.bind(controller)
);

// ============ ADMIN ROUTES ============

/**
 * @route   POST /api/v1/production-lines
 * @desc    إنشاء خط إنتاج
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  validate(createProductionLineSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_CREATE]),
  controller.create.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id
 * @desc    تحديث خط إنتاج
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateProductionLineSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.update.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/status
 * @desc    تحديث حالة خط الإنتاج
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/status',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateStatusSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateStatus.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/performance
 * @desc    تحديث أداء خط الإنتاج
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/performance',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updatePerformanceSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updatePerformance.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/machines
 * @desc    تحديث إحصائيات الآلات
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/machines',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updatePerformanceSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateMachines.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/sensors
 * @desc    تحديث إحصائيات الحساسات
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/sensors',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updatePerformanceSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateSensors.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/quality
 * @desc    تحديث الجودة
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/quality',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updatePerformanceSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateQuality.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/green-score
 * @desc    تحديث درجة الخضرة
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/green-score',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateGreenScoreSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateGreenScore.bind(controller)
);

/**
 * @route   PUT /api/v1/production-lines/:id/cost
 * @desc    تحديث التكاليف
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/cost',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updatePerformanceSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.updateCost.bind(controller)
);

/**
 * @route   POST /api/v1/production-lines/:id/start
 * @desc    تشغيل خط الإنتاج
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/start',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.start.bind(controller)
);

/**
 * @route   POST /api/v1/production-lines/:id/stop
 * @desc    إيقاف خط الإنتاج
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/stop',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.stop.bind(controller)
);

/**
 * @route   POST /api/v1/production-lines/:id/maintenance
 * @desc    إضافة سجل صيانة
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/maintenance',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(addMaintenanceRecordSchema),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_UPDATE]),
  controller.addMaintenanceRecord.bind(controller)
);

/**
 * @route   DELETE /api/v1/production-lines/:id
 * @desc    حذف خط إنتاج
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(deleteProductionLineSchema),
  checkRole(['super_admin', 'admin']),
  checkPermissions([PERMISSIONS.PRODUCTION_LINES_DELETE]),
  controller.delete.bind(controller)
);

module.exports = router;