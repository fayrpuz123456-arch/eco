const BaseService = require('../../../core/base/BaseService');
const FactoryRepository = require('../repositories/FactoryRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class FactoryService extends BaseService {
  constructor() {
    super(new FactoryRepository(), 'Factory');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createFactory(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'industry', 'contactEmail']);

      // التحقق من عدم وجود مصنع بنفس الاسم
      const existingName = await this.repository.findByName(data.name, companyId);
      if (existingName) {
        throw new ConflictError('Factory with this name already exists');
      }

      // التحقق من عدم وجود مصنع بنفس الكود
      const existingCode = await this.repository.findByCode(data.code, companyId);
      if (existingCode) {
        throw new ConflictError('Factory with this code already exists');
      }

      const factoryData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const factory = await this.repository.create(factoryData);

      eventEmitter.emit('factory.created', {
        factoryId: factory._id,
        name: factory.name,
        code: factory.code,
        companyId,
        createdBy: userId
      });

      logger.info('Factory created successfully', {
        factoryId: factory._id,
        name: factory.name,
        companyId
      });

      return factory;
    } catch (error) {
      logger.error('Error creating factory:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getFactoryById(id, companyId) {
    const factory = await this.repository.findById(id, companyId);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }
    return factory;
  }

  async getFactoryByCode(code, companyId) {
    const factory = await this.repository.findByCode(code, companyId);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }
    return factory;
  }

  async getFactories(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getFactoriesPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getActiveFactories(companyId) {
    return this.repository.findActive(companyId);
  }

  async getHighGreenScoreFactories(minScore = 70, companyId) {
    return this.repository.findHighGreenScore(minScore, companyId);
  }

  async searchFactories(query, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, companyId);
  }

  async getFactoryStats(id) {
    const stats = await this.repository.getFactoryStats(id);
    if (!stats) {
      throw new NotFoundError('Factory not found');
    }
    return stats;
  }

  async getCompanyFactoryStats(companyId) {
    return this.repository.getCompanyFactoryStats(companyId);
  }

  // ============ UPDATE ============

  async updateFactory(id, data, userId, companyId) {
    try {
      const existingFactory = await this.repository.findById(id, companyId);
      if (!existingFactory) {
        throw new NotFoundError('Factory not found');
      }

      const allowedUpdates = [
        'name', 'description', 'industry', 'industrySubtype',
        'logo', 'contactEmail', 'contactPhone', 'contactPerson',
        'address', 'type', 'size', 'area', 'establishedDate',
        'timezone', 'productionCapacity', 'productionUnit',
        'shiftCount', 'operatingHours', 'sustainability',
        'safety', 'settings', 'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.name && data.name !== existingFactory.name) {
        const nameExists = await this.repository.findByName(data.name, companyId);
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Factory with this name already exists');
        }
        updateData.name = data.name;
      }

      if (data.code && data.code.toUpperCase() !== existingFactory.code) {
        const codeExists = await this.repository.findByCode(data.code, companyId);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Factory with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedFactory = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('factory.updated', {
        factoryId: updatedFactory._id,
        name: updatedFactory.name,
        companyId,
        updatedBy: userId
      });

      logger.info('Factory updated successfully', {
        factoryId: updatedFactory._id,
        name: updatedFactory.name,
        companyId
      });

      return updatedFactory;
    } catch (error) {
      logger.error('Error updating factory:', error);
      throw error;
    }
  }

  async updateStatus(id, status, userId, companyId) {
    try {
      const factory = await this.repository.findById(id, companyId);
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }

      const updatedFactory = await this.repository.updateStatus(id, status);

      logger.info('Factory status updated', {
        factoryId: id,
        oldStatus: factory.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedFactory;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  async updateGreenScore(id, score, userId, companyId) {
    try {
      const factory = await this.repository.findById(id, companyId);
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }

      const updatedFactory = await this.repository.updateGreenScore(id, score);

      logger.info('Green score updated', {
        factoryId: id,
        oldScore: factory.sustainability.greenScore,
        newScore: score,
        updatedBy: userId
      });

      return updatedFactory;
    } catch (error) {
      logger.error('Error updating green score:', error);
      throw error;
    }
  }

  async calculateGreenScore(id, userId, companyId) {
    try {
      const factory = await this.repository.findById(id, companyId);
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }

      await factory.calculateGreenScore();
      const updatedFactory = await factory.save();

      logger.info('Green score calculated', {
        factoryId: id,
        newScore: updatedFactory.sustainability.greenScore,
        updatedBy: userId
      });

      return updatedFactory;
    } catch (error) {
      logger.error('Error calculating green score:', error);
      throw error;
    }
  }

  async updateStatistics(id, statsData, userId, companyId) {
    try {
      const factory = await this.repository.findById(id, companyId);
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }

      const updatedFactory = await this.repository.updateStatistics(id, statsData);

      logger.info('Factory statistics updated', {
        factoryId: id,
        stats: statsData,
        updatedBy: userId
      });

      return updatedFactory;
    } catch (error) {
      logger.error('Error updating statistics:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteFactory(id, userId, companyId, reason = null) {
    try {
      const factory = await this.repository.findById(id, companyId);
      if (!factory) {
        throw new NotFoundError('Factory not found');
      }

      // التحقق من عدم وجود بيانات مرتبطة
      const stats = await this.repository.getFactoryStats(id);
      if (stats && (stats.statistics?.totalDepartments > 0 || 
                    stats.statistics?.totalMachines > 0 || 
                    stats.statistics?.totalSensors > 0)) {
        throw new ValidationError('Cannot delete factory with active data. Please delete all associated data first.');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('factory.deleted', {
        factoryId: id,
        name: factory.name,
        companyId,
        deletedBy: userId
      });

      logger.info('Factory deleted successfully', {
        factoryId: id,
        name: factory.name,
        companyId
      });

      return { message: 'Factory deleted successfully' };
    } catch (error) {
      logger.error('Error deleting factory:', error);
      throw error;
    }
  }

  // ============ FILTERS ============

  async findWithFilters(filters = {}, companyId) {
    return this.repository.findWithFilters(filters, companyId);
  }

  async getIndustryDistribution(companyId) {
    return this.repository.getIndustryDistribution(companyId);
  }

  async getCountryDistribution(companyId) {
    return this.repository.getCountryDistribution(companyId);
  }

  // ============ DASHBOARD ============

  async getFactoryDashboard(id, companyId) {
    const stats = await this.getFactoryStats(id);
    const factory = await this.getFactoryById(id, companyId);
    
    return {
      factory: {
        id: factory._id,
        name: factory.name,
        code: factory.code,
        industry: factory.industry,
        logo: factory.logo,
        status: factory.status,
        type: factory.type,
        size: factory.size
      },
      address: factory.address,
      sustainability: {
        greenScore: factory.sustainability.greenScore,
        carbonFootprint: factory.sustainability.carbonFootprint,
        renewableEnergyPercentage: factory.sustainability.renewableEnergyPercentage,
        certifications: factory.sustainability.certifications
      },
      statistics: {
        departments: stats.statistics?.totalDepartments || 0,
        productionLines: stats.statistics?.totalProductionLines || 0,
        machines: stats.statistics?.totalMachines || 0,
        sensors: stats.statistics?.totalSensors || 0,
        readings: stats.statistics?.totalReadings || 0,
        uptime: factory.statistics.uptime || 0,
        productionEfficiency: factory.statistics.productionEfficiency || 0
      },
      safety: factory.safety,
      createdAt: factory.createdAt
    };
  }
}

module.exports = FactoryService;