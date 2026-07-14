const express = require('express');
const router = express.Router();
const ExchangeController = require('../controllers/ExchangeController');
const { validate } = require('../../../core/middleware/validation');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, checkRole, PERMISSIONS } = require('../../../core/middleware/permissions');
const { idSchema } = require('../../../core/middleware/validation');
const Joi = require('joi');

// ============ SCHEMAS ============

const createExchangeSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  resourceType: Joi.string().valid(
    'heat', 'steam', 'plastic', 'metal', 'paper', 'glass',
    'wood', 'treated_water', 'chemicals', 'waste_oil', 'biomass', 'other'
  ).required(),
  resourceDetails: Joi.object({
    quantity: Joi.number().min(0).required(),
    unit: Joi.string().valid('kg', 'ton', 'm3', 'liter', 'kWh', 'MW', 'GJ', 'units', 'other').default('kg'),
    quality: Joi.string().optional(),
    purity: Joi.number().min(0).max(100).default(0),
    temperature: Joi.number().default(0),
    pressure: Joi.number().default(0),
    composition: Joi.string().optional(),
    specifications: Joi.object().optional()
  }).required(),
  availability: Joi.object({
    status: Joi.string().valid('available', 'reserved', 'sold', 'expired').default('available'),
    availableFrom: Joi.date().iso().default(Date.now),
    availableUntil: Joi.date().iso().optional(),
    expiryDate: Joi.date().iso().optional(),
    isRecurring: Joi.boolean().default(false),
    recurringFrequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').optional()
  }).optional(),
  pricing: Joi.object({
    pricePerUnit: Joi.number().min(0).default(0),
    currency: Joi.string().default('USD'),
    negotiable: Joi.boolean().default(true)
  }).optional(),
  logistics: Joi.object({
    pickupLocation: Joi.object({
      address: Joi.string().optional(),
      city: Joi.string().optional(),
      country: Joi.string().optional(),
      coordinates: Joi.object({
        lat: Joi.number().optional(),
        lng: Joi.number().optional()
      }).optional()
    }).optional(),
    deliveryAvailable: Joi.boolean().default(false),
    deliveryRadius: Joi.number().min(0).default(0),
    pickupRequired: Joi.boolean().default(true),
    packaging: Joi.string().optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).default([])
});

const updateExchangeSchema = createExchangeSchema.fork(
  ['name', 'resourceType', 'factoryId'],
  (schema) => schema.optional()
);

const addInterestSchema = Joi.object({
  companyId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  userEmail: Joi.string().email().required(),
  message: Joi.string().max(500).optional(),
  quantity: Joi.number().min(0).optional(),
  priceOffer: Joi.number().min(0).optional()
});

const reserveSchema = Joi.object({
  quantity: Joi.number().min(1).required()
});

const deleteExchangeSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

const filterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  resourceType: Joi.string().valid(
    'heat', 'steam', 'plastic', 'metal', 'paper', 'glass',
    'wood', 'treated_water', 'chemicals', 'waste_oil', 'biomass', 'other'
  ),
  status: Joi.string().valid('available', 'reserved', 'sold', 'expired', 'archived'),
  minQuantity: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  factoryId: Joi.string().uuid({ version: 'uuidv4' }),
  search: Joi.string(),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// ============ INSTANTIATE CONTROLLER ============

const controller = new ExchangeController();

// ============ APPLY MIDDLEWARE ============

router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ ROUTES ============

/**
 * @route   GET /api/v1/exchange
 * @desc    قائمة عروض التبادل الصناعي
 * @access  Private
 */
router.get(
  '/',
  validate(filterSchema, 'query'),
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getList.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/available
 * @desc    العروض المتاحة
 * @access  Private
 */
router.get(
  '/available',
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getAvailable.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/matched
 * @desc    العروض المتطابقة مع AI
 * @access  Private
 */
router.get(
  '/matched',
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getMatched.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/resource-type/:resourceType
 * @desc    العروض حسب نوع المورد
 * @access  Private
 */
router.get(
  '/resource-type/:resourceType',
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getByResourceType.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/factory/:factoryId
 * @desc    عروض مصنع معين
 * @access  Private
 */
router.get(
  '/factory/:factoryId',
  validate(Joi.object({ factoryId: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getFactoryExchanges.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/stats
 * @desc    إحصائيات التبادل الصناعي
 * @access  Private
 */
router.get(
  '/stats',
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getStats.bind(controller)
);

/**
 * @route   GET /api/v1/exchange/:id
 * @desc    عرض تفاصيل عرض تبادل
 * @access  Private
 */
router.get(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.getById.bind(controller)
);

/**
 * @route   POST /api/v1/exchange
 * @desc    إنشاء عرض تبادل صناعي
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  validate(createExchangeSchema),
  checkPermissions([PERMISSIONS.EXCHANGE_CREATE]),
  controller.create.bind(controller)
);

/**
 * @route   POST /api/v1/exchange/:id/match
 * @desc    البحث عن مطابقة AI
 * @access  Private
 */
router.post(
  '/:id/match',
  validate(Joi.object({ id: idSchema }), 'params'),
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.findMatch.bind(controller)
);

/**
 * @route   POST /api/v1/exchange/:id/interest
 * @desc    إضافة اهتمام بعرض
 * @access  Private
 */
router.post(
  '/:id/interest',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(addInterestSchema),
  checkPermissions([PERMISSIONS.EXCHANGE_VIEW]),
  controller.addInterest.bind(controller)
);

/**
 * @route   PUT /api/v1/exchange/:id
 * @desc    تحديث عرض تبادل
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(updateExchangeSchema),
  checkPermissions([PERMISSIONS.EXCHANGE_UPDATE]),
  controller.update.bind(controller)
);

/**
 * @route   PUT /api/v1/exchange/:id/reserve
 * @desc    حجز مورد
 * @access  Private
 */
router.put(
  '/:id/reserve',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(reserveSchema),
  checkPermissions([PERMISSIONS.EXCHANGE_UPDATE]),
  controller.reserve.bind(controller)
);

/**
 * @route   PUT /api/v1/exchange/:id/sell
 * @desc    بيع مورد
 * @access  Private
 */
router.put(
  '/:id/sell',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(reserveSchema),
  checkPermissions([PERMISSIONS.EXCHANGE_UPDATE]),
  controller.sell.bind(controller)
);

/**
 * @route   DELETE /api/v1/exchange/:id
 * @desc    حذف عرض تبادل
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  validate(Joi.object({ id: idSchema }), 'params'),
  validate(deleteExchangeSchema),
  checkRole(['super_admin', 'admin']),
  checkPermissions([PERMISSIONS.EXCHANGE_DELETE]),
  controller.delete.bind(controller)
);

module.exports = router;