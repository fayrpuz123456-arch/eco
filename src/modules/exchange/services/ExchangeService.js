const BaseService = require('../../../core/base/BaseService');
const ExchangeRepository = require('../repositories/ExchangeRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const aiService = require('../../../core/services/AIService');
const logger = require('../../../core/utils/logger');

class ExchangeService extends BaseService {
  constructor() {
    super(new ExchangeRepository(), 'Exchange');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createExchange(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'resourceType', 'factoryId']);

      const exchangeData = {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const exchange = await this.repository.create(exchangeData);
      
      // حساب القيمة الإجمالية
      await exchange.calculateTotalValue();
      await exchange.calculateEnvironmentalImpact();
      await exchange.save();

      // محاولة العثور على مطابقة عبر AI
      await this.findMatch(exchange._id, companyId);

      eventEmitter.emit('exchange.created', {
        exchangeId: exchange._id,
        name: exchange.name,
        resourceType: exchange.resourceType,
        companyId
      });

      logger.info('Exchange listing created successfully', {
        exchangeId: exchange._id,
        name: exchange.name,
        companyId
      });

      return exchange;
    } catch (error) {
      logger.error('Error creating exchange listing:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getExchangeById(id, companyId) {
    const exchange = await this.repository.findById(id, companyId);
    if (!exchange) {
      throw new NotFoundError('Exchange listing not found');
    }
    return exchange;
  }

  async getAvailableExchanges(companyId) {
    return this.repository.findAvailable(companyId);
  }

  async getExchangesByResourceType(resourceType, companyId) {
    return this.repository.findByResourceType(resourceType, companyId);
  }

  async getMatchedExchanges(companyId) {
    return this.repository.findMatched(companyId);
  }

  async getFactoryExchanges(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  async getAvailableStats(companyId) {
    return this.repository.getAvailableStats(companyId);
  }

  // ============ AI MATCHING ============

  async findMatch(id, companyId) {
    try {
      const exchange = await this.repository.findById(id, companyId);
      if (!exchange) {
        throw new NotFoundError('Exchange listing not found');
      }

      // تجهيز البيانات للـ AI
      const data = {
        resourceType: exchange.resourceType,
        quantity: exchange.resourceDetails.quantity,
        unit: exchange.resourceDetails.unit,
        location: exchange.logistics.pickupLocation,
        companyId: companyId,
        factoryId: exchange.factoryId
      };

      // استدعاء AI Matching
      const matchResult = await aiService.findIndustrialMatch(data);

      if (matchResult.matches && matchResult.matches.length > 0) {
        const bestMatch = matchResult.matches[0];
        await this.repository.updateMatch(id, {
          matchedCompanyId: bestMatch.companyId,
          matchedFactoryId: bestMatch.factoryId,
          matchScore: bestMatch.score,
          recommendations: matchResult.recommendations || [],
          alternativeUses: matchResult.alternativeUses || []
        });

        logger.info('AI match found for exchange', {
          exchangeId: id,
          matchedCompanyId: bestMatch.companyId,
          score: bestMatch.score
        });
      }

      return exchange;
    } catch (error) {
      logger.error('Error finding AI match:', error);
      return null;
    }
  }

  // ============ INTERESTS ============

  async addInterest(id, interestData, userId, companyId) {
    try {
      const exchange = await this.repository.findById(id, companyId);
      if (!exchange) {
        throw new NotFoundError('Exchange listing not found');
      }

      const interest = {
        ...interestData,
        companyId: interestData.companyId || companyId,
        userEmail: interestData.userEmail,
        createdAt: new Date()
      };

      const updated = await this.repository.addInterest(id, interest);

      // إرسال إشعار
      eventEmitter.emit('exchange.interest.added', {
        exchangeId: id,
        interest: interest,
        companyId
      });

      return updated;
    } catch (error) {
      logger.error('Error adding interest:', error);
      throw error;
    }
  }

  // ============ UPDATE ============

  async updateExchange(id, data, userId, companyId) {
    try {
      const existing = await this.repository.findById(id, companyId);
      if (!existing) {
        throw new NotFoundError('Exchange listing not found');
      }

      const allowedUpdates = [
        'name', 'description', 'resourceType', 'resourceDetails',
        'availability', 'pricing', 'logistics', 'tags',
        'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      updateData.updatedBy = userId;

      const updated = await this.repository.update(id, updateData, companyId);

      // إعادة حساب القيم
      await updated.calculateTotalValue();
      await updated.calculateEnvironmentalImpact();
      await updated.save();

      // إعادة البحث عن مطابقة
      if (data.resourceType || data.resourceDetails) {
        await this.findMatch(id, companyId);
      }

      return updated;
    } catch (error) {
      logger.error('Error updating exchange listing:', error);
      throw error;
    }
  }

  // ============ RESERVE & SELL ============

  async reserveResource(id, quantity, userId, companyId) {
    try {
      const exchange = await this.repository.findById(id, companyId);
      if (!exchange) {
        throw new NotFoundError('Exchange listing not found');
      }

      if (!exchange.isAvailable) {
        throw new ValidationError('Resource is not available');
      }

      const updated = await this.repository.reserveQuantity(id, quantity);

      logger.info('Resource reserved', {
        exchangeId: id,
        quantity,
        userId
      });

      return updated;
    } catch (error) {
      logger.error('Error reserving resource:', error);
      throw error;
    }
  }

  async sellResource(id, quantity, userId, companyId) {
    try {
      const exchange = await this.repository.findById(id, companyId);
      if (!exchange) {
        throw new NotFoundError('Exchange listing not found');
      }

      const updated = await this.repository.sellQuantity(id, quantity);

      eventEmitter.emit('exchange.sold', {
        exchangeId: id,
        quantity,
        userId
      });

      logger.info('Resource sold', {
        exchangeId: id,
        quantity,
        userId
      });

      return updated;
    } catch (error) {
      logger.error('Error selling resource:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteExchange(id, userId, companyId, reason = null) {
    try {
      const exchange = await this.repository.findById(id, companyId);
      if (!exchange) {
        throw new NotFoundError('Exchange listing not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('exchange.deleted', {
        exchangeId: id,
        name: exchange.name,
        companyId
      });

      return { message: 'Exchange listing deleted successfully' };
    } catch (error) {
      logger.error('Error deleting exchange listing:', error);
      throw error;
    }
  }
}

module.exports = ExchangeService;