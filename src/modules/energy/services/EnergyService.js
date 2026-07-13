const BaseService = require('../../../core/base/BaseService');
const EnergyRepository = require('../repositories/EnergyRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class EnergyService extends BaseService {
  constructor() {
    super(new EnergyRepository(), 'Energy');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createEnergy(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'period.startDate', 'period.endDate']);

      // التحقق من عدم وجود كود مكرر
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Energy record with this code already exists');
      }

      // تحضير البيانات
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      
      const energyData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId,
        period: {
          ...data.period,
          startDate,
          endDate,
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1
        }
      };

      const energy = new this.repository.model(energyData);
      await energy.calculateTotalConsumption();

      eventEmitter.emit('energy.created', {
        energyId: energy._id,
        name: energy.name,
        companyId,
        createdBy: userId
      });

      logger.info('Energy record created successfully', {
        energyId: energy._id,
        name: energy.name,
        companyId
      });

      return energy;
    } catch (error) {
      logger.error('Error creating energy record:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getEnergyById(id, companyId) {
    const energy = await this.repository.findById(id, companyId);
    if (!energy) {
      throw new NotFoundError('Energy record not found');
    }
    return energy;
  }

  async getEnergyByCode(code) {
    const energy = await this.repository.findByCode(code);
    if (!energy) {
      throw new NotFoundError('Energy record not found');
    }
    return energy;
  }

  async getEnergyRecords(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getEnergyRecordsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getEnergyByPeriod(companyId, startDate, endDate) {
    return this.repository.findByPeriod(companyId, startDate, endDate);
  }

  async getEnergyByType(companyId, type, startDate, endDate) {
    return this.repository.findByType(companyId, type, startDate, endDate);
  }

  async getEnergyByYear(companyId, year) {
    return this.repository.findByYear(companyId, year);
  }

  async getEnergyByFactory(companyId, factoryId, startDate, endDate) {
    return this.repository.findByFactory(companyId, factoryId, startDate, endDate);
  }

  // ============ UPDATE ============

  async updateEnergy(id, data, userId, companyId) {
    try {
      const existingEnergy = await this.repository.findById(id, companyId);
      if (!existingEnergy) {
        throw new NotFoundError('Energy record not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'source',
        'period', 'consumption', 'cost', 'efficiency',
        'carbonImpact', 'kpis', 'targets', 'breakdown',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.code && data.code.toUpperCase() !== existingEnergy.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Energy record with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedEnergy = await this.repository.update(id, updateData, companyId);

      if (data.consumption) {
        await updatedEnergy.calculateTotalConsumption();
      }

      eventEmitter.emit('energy.updated', {
        energyId: updatedEnergy._id,
        name: updatedEnergy.name,
        companyId,
        updatedBy: userId
      });

      logger.info('Energy record updated successfully', {
        energyId: updatedEnergy._id,
        name: updatedEnergy.name,
        companyId
      });

      return updatedEnergy;
    } catch (error) {
      logger.error('Error updating energy record:', error);
      throw error;
    }
  }

  async updateConsumption(id, consumptionData, userId, companyId) {
    try {
      const energy = await this.repository.findById(id, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const updatedEnergy = await this.repository.updateConsumption(id, consumptionData);
      await updatedEnergy.calculateTotalConsumption();

      logger.info('Energy consumption updated', {
        energyId: id,
        consumption: consumptionData,
        updatedBy: userId
      });

      return updatedEnergy;
    } catch (error) {
      logger.error('Error updating consumption:', error);
      throw error;
    }
  }

  async updateCost(id, costData, userId, companyId) {
    try {
      const energy = await this.repository.findById(id, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const updatedEnergy = await this.repository.updateCost(id, costData);
      await updatedEnergy.calculateTotalConsumption();

      logger.info('Energy cost updated', {
        energyId: id,
        cost: costData,
        updatedBy: userId
      });

      return updatedEnergy;
    } catch (error) {
      logger.error('Error updating cost:', error);
      throw error;
    }
  }

  async updateTargets(id, targets, userId, companyId) {
    try {
      const energy = await this.repository.findById(id, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const updatedEnergy = await this.repository.updateTargets(id, targets);
      await updatedEnergy.updateTargetStatus();

      logger.info('Energy targets updated', {
        energyId: id,
        targets,
        updatedBy: userId
      });

      return updatedEnergy;
    } catch (error) {
      logger.error('Error updating targets:', error);
      throw error;
    }
  }

  async updateEfficiency(id, efficiency, userId, companyId) {
    try {
      const energy = await this.repository.findById(id, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const updatedEnergy = await this.repository.updateEfficiency(id, efficiency);

      logger.info('Energy efficiency updated', {
        energyId: id,
        efficiency,
        updatedBy: userId
      });

      return updatedEnergy;
    } catch (error) {
      logger.error('Error updating efficiency:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotalConsumption(companyId, startDate, endDate) {
    return this.repository.getCompanyTotalConsumption(companyId, startDate, endDate);
  }

  async getConsumptionDistribution(companyId, startDate, endDate) {
    return this.repository.getConsumptionDistribution(companyId, startDate, endDate);
  }

  async getConsumptionTrend(companyId, months = 12) {
    return this.repository.getConsumptionTrend(companyId, months);
  }

  async getYearlyConsumption(companyId, year) {
    return this.repository.getYearlyConsumption(companyId, year);
  }

  async getMonthlyConsumption(companyId, year, month) {
    return this.repository.getMonthlyConsumption(companyId, year, month);
  }

  async getTopConsumingFactories(companyId, startDate, endDate, limit = 10) {
    return this.repository.getTopConsumingFactories(companyId, startDate, endDate, limit);
  }

  async getEfficiencyStats(companyId, startDate, endDate) {
    return this.repository.getEfficiencyStats(companyId, startDate, endDate);
  }

  async getRecommendations(companyId) {
    return this.repository.getRecommendations(companyId);
  }

  // ============ RECOMMENDATIONS ============

  async generateRecommendations(energyId, companyId) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const recommendations = [];
      const total = energy.consumption.total || 0;
      const cost = energy.cost.total || 0;

      // توصيات بناءً على الاستهلاك
      if (energy.consumption.electricity.total > total * 0.4) {
        recommendations.push({
          title: 'تحسين كفاءة الكهرباء',
          description: 'استبدال الإضاءة بـ LED وتركيب محركات عالية الكفاءة',
          potentialSavings: energy.consumption.electricity.total * 0.15,
          potentialCostSaving: cost * 0.15,
          priority: 'high'
        });
      }

      if (energy.consumption.fuel.total > total * 0.3) {
        recommendations.push({
          title: 'تحسين كفاءة الوقود',
          description: 'صيانة دورية للمعدات وتحسين عمليات الاحتراق',
          potentialSavings: energy.consumption.fuel.total * 0.1,
          potentialCostSaving: cost * 0.1,
          priority: 'high'
        });
      }

      if (energy.kpis.renewablePercentage < 20) {
        recommendations.push({
          title: 'زيادة استخدام الطاقة المتجددة',
          description: 'تركيب ألواح شمسية أو شراء طاقة خضراء',
          potentialSavings: total * 0.1,
          potentialCostSaving: cost * 0.08,
          priority: 'medium'
        });
      }

      if (energy.efficiency.overall < 70) {
        recommendations.push({
          title: 'تحسين الكفاءة العامة',
          description: 'تطبيق نظام إدارة الطاقة ISO 50001',
          potentialSavings: total * 0.08,
          potentialCostSaving: cost * 0.08,
          priority: 'medium'
        });
      }

      energy.recommendations = recommendations;
      await energy.save();

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // ============ DASHBOARD ============

  async getEnergyDashboard(companyId, startDate, endDate) {
    const [
      totalConsumption,
      distribution,
      trend,
      topFactories,
      efficiencyStats
    ] = await Promise.all([
      this.getCompanyTotalConsumption(companyId, startDate, endDate),
      this.getConsumptionDistribution(companyId, startDate, endDate),
      this.getConsumptionTrend(companyId, 12),
      this.getTopConsumingFactories(companyId, startDate, endDate, 5),
      this.getEfficiencyStats(companyId, startDate, endDate)
    ]);

    return {
      period: { startDate, endDate },
      totalConsumption,
      distribution,
      trend,
      topFactories,
      efficiency: efficiencyStats,
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteEnergy(id, userId, companyId, reason = null) {
    try {
      const energy = await this.repository.findById(id, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('energy.deleted', {
        energyId: id,
        name: energy.name,
        companyId,
        deletedBy: userId
      });

      logger.info('Energy record deleted successfully', {
        energyId: id,
        name: energy.name,
        companyId
      });

      return { message: 'Energy record deleted successfully' };
    } catch (error) {
      logger.error('Error deleting energy record:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportEnergyData(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportEnergyData(companyId, startDate, endDate, format);
  }
}

module.exports = EnergyService;