const express = require('express');
const router = express.Router();
const HeatRecoveryController = require('../controllers/HeatRecoveryController');
const { validate } = require('../../../core/middleware/validation');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, checkRole, PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

// ============ SCHEMAS ============

const createHeatRecoverySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  machineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  heatSource: Joi.object({
    type: Joi.string().valid(
      'boiler', 'furnace', 'engine', 'compressor', 'pump',
      'exhaust', 'steam_trap', 'cooling_tower', 'heat_exchanger',
      'incinerator', 'other'
    ).required(),
    temperature: Joi.number().min(0).required(),
    flowRate: Joi.number().min(0).default(0),
    pressure: Joi.number().min(0).default(0),
    operatingHours: Joi.number().min(0).default(0),
    operatingDays: Joi.number().min(0).default(0),
    fuelType: Joi.string().valid('natural_gas', 'diesel', 'coal', 'biomass', 'electricity', 'other').default('natural_gas')
  }).required(),
  heatCalculation: Joi.object({
    recoveryEfficiency: Joi.number().min(0).max(100).default(70)
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateHeatRecoverySchema = createHeatRecoverySchema.fork(
  ['name', 'factoryId', 'machineId'],
  (schema) => schema.optional()
);

const addSolutionSchema = Joi.object({
  type: Joi.string().valid(
    'heat_exchanger', 'steam_recovery', 'boiler_feed', 'orc_generator',
    'drying_system', 'preheating', 'district_heating', 'absorption_chiller',
    'heat_pump'
  ).required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  potentialRecovery: Joi.number().min(0).required(),
  efficiency: Joi.number().min(0).max(100).default(70),
  cost: Joi.number().min(0).default(0),
  implementationTime: Joi.number().min(0).default(0),
  maintenanceCost: Joi.number().min(0).default(0)
});

const updateImplementationSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').required(),
  startedAt: Joi.date().iso().optional(),
  completedAt: Joi.date().iso().optional(),
  actualSavings: Joi.number().min(0).optional(),
  actualCarbonReduction: Joi.number().min(0).optional(),
  challenges: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  priority: Joi.string().valid('high', 'medium', 'low'),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled'),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }),
  machineId: Joi.string().uuid({ version: 'uuidv4' }),
  minRecoverable: Joi.number().min(0),
  maxRecoverable: Joi.number().min(0),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const deleteHeatRecoverySchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ INSTANTIATE CONTROLLER ============

const controller = new HeatRecoveryController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/heat-recovery
 * @desc    قائمة فرص استعادة الحرارة
 * @access  Private
 */
router.get(
  '/',
  validate(filterSchema, 'query'),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/heat-recovery/high-priority
 * @desc    الفرص ذات الأولوية العالية
 * @access  Private
 */
router.get(
  '/high-priority',
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getHighPriority.bind(controller)
);

/**
 * @route   GET /api/v1/heat-recovery/stats
 * @desc    إحصائيات استعادة الحرارة
 * @access  Private
 */
router.get(
  '/stats',
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/heat-recovery/factory/:factoryId
 * @desc    فرص استعادة الحرارة في مصنع
 * @access  Private
 */
router.get(
  '/factory/:factoryId',
  validate(Joi.object({ factoryId: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getByFactory.bind(controller)
);

/**
 * @route   GET /api/v1/heat-recovery/machine/:machineId
 * @desc    فرص استعادة الحرارة لآلة
 * @access  Private
 */
router.get(
  '/machine/:machineId',
  validate(Joi.object({ machineId: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getByMachine.bind(controller)
);

/**
 * @route   GET /api/v1/heat-recovery/:id
 * @desc    تفاصيل فرصة استعادة الحرارة
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.getById.bind(controller)
);

/**
 * @route   POST /api/v1/heat-recovery
 * @desc    إنشاء فرصة استعادة حرارة
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  validate(createHeatRecoverySchema),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_CREATE]),
  controller.create.bind(controller)
);

/**
 * @route   POST /api/v1/heat-recovery/:id/analyze
 * @desc    تحليل AI لفرصة استعادة الحرارة
 * @access  Private
 */
router.post(
  '/:id/analyze',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_VIEW]),
  controller.analyzeWithAI.bind(controller)
);

/**
 * @route   POST /api/v1/heat-recovery/:id/solution
 * @desc    إضافة حل مقترح
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/solution',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(addSolutionSchema),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_UPDATE]),
  controller.addSolution.bind(controller)
);

/**
 * @route   PUT /api/v1/heat-recovery/:id
 * @desc    تحديث فرصة استعادة الحرارة
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateHeatRecoverySchema),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_UPDATE]),
  controller.update.bind(controller)
);

/**
 * @route   PUT /api/v1/heat-recovery/:id/implementation
 * @desc    تحديث حالة التنفيذ
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id/implementation',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateImplementationSchema),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_UPDATE]),
  controller.updateImplementation.bind(controller)
);

/**
 * @route   DELETE /api/v1/heat-recovery/:id
 * @desc    حذف فرصة استعادة الحرارة
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(deleteHeatRecoverySchema),
  checkRole(['super_admin', 'admin']),
  checkPermissions([PERMISSIONS.HEAT_RECOVERY_DELETE]),
  controller.delete.bind(controller)
);

module.exports = router;