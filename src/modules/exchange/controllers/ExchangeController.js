const BaseController = require('../../../core/base/BaseController');
const ExchangeService = require('../services/ExchangeService');
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
const logger = require('../../../core/utils/logger');
const Joi = require('joi');
const { idSchema } = require('../../../core/middleware/validation');

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

// ============ CONTROLLER ============

class ExchangeController extends BaseController {
  constructor() {
    super(new ExchangeService(), 'Exchange');
    this.service = this.service;
  }

  // ============ CREATE ============

  async create(req, res) {
    try {
      const { companyId, user } = req;
      const result = await this.service.createExchange(req.body, user.id, companyId);
      return sendCreated(res, 'Exchange listing created successfully', result);
    } catch (error) {
      logger.error('Create exchange error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  async getList(req, res) {
    try {
      const { companyId } = req;
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getExchangesPaginated(
        companyId,
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(res, 'Exchange listings retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error('Get exchanges list error:', error);
      return this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.getExchangeById(id, companyId);
      return sendResponse(res, 200, 'Exchange listing retrieved successfully', result);
    } catch (error) {
      logger.error('Get exchange by id error:', error);
      return this.handleError(res, error);
    }
  }

  async getAvailable(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getAvailableExchanges(companyId);
      return sendResponse(res, 200, 'Available exchanges retrieved successfully', result);
    } catch (error) {
      logger.error('Get available exchanges error:', error);
      return this.handleError(res, error);
    }
  }

  async getByResourceType(req, res) {
    try {
      const { resourceType } = req.params;
      const { companyId } = req;
      const result = await this.service.getExchangesByResourceType(resourceType, companyId);
      return sendResponse(res, 200, 'Exchanges by resource type retrieved successfully', result);
    } catch (error) {
      logger.error('Get exchanges by resource type error:', error);
      return this.handleError(res, error);
    }
  }

  async getMatched(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getMatchedExchanges(companyId);
      return sendResponse(res, 200, 'Matched exchanges retrieved successfully', result);
    } catch (error) {
      logger.error('Get matched exchanges error:', error);
      return this.handleError(res, error);
    }
  }

  async getFactoryExchanges(req, res) {
    try {
      const { factoryId } = req.params;
      const { companyId } = req;
      const result = await this.service.getFactoryExchanges(factoryId, companyId);
      return sendResponse(res, 200, 'Factory exchanges retrieved successfully', result);
    } catch (error) {
      logger.error('Get factory exchanges error:', error);
      return this.handleError(res, error);
    }
  }

  async getStats(req, res) {
    try {
      const { companyId } = req;
      const result = await this.service.getAvailableStats(companyId);
      return sendResponse(res, 200, 'Exchange statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get exchange stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ AI MATCHING ============

  async findMatch(req, res) {
    try {
      const { id } = req.params;
      const { companyId } = req;
      const result = await this.service.findMatch(id, companyId);
      return sendResponse(res, 200, 'AI matching completed successfully', result);
    } catch (error) {
      logger.error('Find match error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ INTERESTS ============

  async addInterest(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.addInterest(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Interest added successfully', result);
    } catch (error) {
      logger.error('Add interest error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  async update(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const result = await this.service.updateExchange(id, req.body, user.id, companyId);
      return sendResponse(res, 200, 'Exchange listing updated successfully', result);
    } catch (error) {
      logger.error('Update exchange error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ RESERVE & SELL ============

  async reserve(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { quantity } = req.body;
      const result = await this.service.reserveResource(id, quantity, user.id, companyId);
      return sendResponse(res, 200, 'Resource reserved successfully', result);
    } catch (error) {
      logger.error('Reserve resource error:', error);
      return this.handleError(res, error);
    }
  }

  async sell(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { quantity } = req.body;
      const result = await this.service.sellResource(id, quantity, user.id, companyId);
      return sendResponse(res, 200, 'Resource sold successfully', result);
    } catch (error) {
      logger.error('Sell resource error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { companyId, user } = req;
      const { reason } = req.body;
      const result = await this.service.deleteExchange(id, user.id, companyId, reason);
      return sendDeleted(res, 'Exchange listing deleted successfully');
    } catch (error) {
      logger.error('Delete exchange error:', error);
      return this.handleError(res, error);
    }
  }

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

module.exports = ExchangeController;