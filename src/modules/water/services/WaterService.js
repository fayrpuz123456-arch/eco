const BaseService = require('../../../core/base/BaseService');
const WaterRepository = require('../repositories/WaterRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class WaterService extends BaseService {
  constructor() {
    super(new WaterRepository(), 'Water');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createWater(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'period.startDate', 'period.endDate']);

      // التحقق من عدم وجود كود مكرر
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Water record with this code already exists');
      }

      // تحضير البيانات
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      
      const waterData = {
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

      const water = new this.repository.model(waterData);
      await water.calculateTotalConsumption();
      await water.calculateQualityScore();

      eventEmitter.emit('water.created', {
        waterId: water._id,
        name: water.name,
        companyId,
        createdBy: userId
      });

      logger.info('Water record created successfully', {
        waterId: water._id,
        name: water.name,
        companyId
      });

      return water;
    } catch (error) {
      logger.error('Error creating water record:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getWaterById(id, companyId) {
    const water = await this.repository.findById(id, companyId);
    if (!water) {
      throw new NotFoundError('Water record not found');
    }
    return water;
  }

  async getWaterByCode(code) {
    const water = await this.repository.findByCode(code);
    if (!water) {
      throw new NotFoundError('Water record not found');
    }
    return water;
  }

  async getWaterRecords(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getWaterRecordsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getWaterByPeriod(companyId, startDate, endDate) {
    return this.repository.findByPeriod(companyId, startDate, endDate);
  }

  async getWaterByType(companyId, type, startDate, endDate) {
    return this.repository.findByType(companyId, type, startDate, endDate);
  }

  async getWaterByYear(companyId, year) {
    return this.repository.findByYear(companyId, year);
  }

  async getWaterByFactory(companyId, factoryId, startDate, endDate) {
    return this.repository.findByFactory(companyId, factoryId, startDate, endDate);
  }

  // ============ UPDATE ============

  async updateWater(id, data, userId, companyId) {
    try {
      const existingWater = await this.repository.findById(id, companyId);
      if (!existingWater) {
        throw new NotFoundError('Water record not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'source', 'usage',
        'period', 'consumption', 'quality', 'leaks', 'cost',
        'efficiency', 'carbonImpact', 'kpis', 'targets',
        'breakdown', 'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.code && data.code.toUpperCase() !== existingWater.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Water record with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedWater = await this.repository.update(id, updateData, companyId);

      if (data.consumption) {
        await updatedWater.calculateTotalConsumption();
      }
      if (data.quality) {
        await updatedWater.calculateQualityScore();
      }

      eventEmitter.emit('water.updated', {
        waterId: updatedWater._id,
        name: updatedWater.name,
        companyId,
        updatedBy: userId
      });

      logger.info('Water record updated successfully', {
        waterId: updatedWater._id,
        name: updatedWater.name,
        companyId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error updating water record:', error);
      throw error;
    }
  }

  async updateConsumption(id, consumptionData, userId, companyId) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const updatedWater = await this.repository.updateConsumption(id, consumptionData);
      await updatedWater.calculateTotalConsumption();

      logger.info('Water consumption updated', {
        waterId: id,
        consumption: consumptionData,
        updatedBy: userId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error updating consumption:', error);
      throw error;
    }
  }

  async updateQuality(id, qualityData, userId, companyId) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const updatedWater = await this.repository.updateQuality(id, qualityData);
      await updatedWater.calculateQualityScore();

      logger.info('Water quality updated', {
        waterId: id,
        quality: qualityData,
        updatedBy: userId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error updating quality:', error);
      throw error;
    }
  }

  async updateTargets(id, targets, userId, companyId) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const updatedWater = await this.repository.updateTargets(id, targets);
      await updatedWater.updateTargetStatus();

      logger.info('Water targets updated', {
        waterId: id,
        targets,
        updatedBy: userId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error updating targets:', error);
      throw error;
    }
  }

  // ============ LEAK MANAGEMENT ============

  async addLeak(id, leakData, userId, companyId) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const updatedWater = await this.repository.addLeak(id, leakData);

      // إرسال تنبيه للتسريب
      if (leakData.severity === 'high' || leakData.severity === 'critical') {
        eventEmitter.emit('water.leak.detected', {
          waterId: id,
          leak: leakData,
          companyId,
          detectedBy: userId
        });
      }

      logger.info('Water leak added', {
        waterId: id,
        leak: leakData,
        addedBy: userId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error adding leak:', error);
      throw error;
    }
  }

  async repairLeak(id, leakId, userId, companyId) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const updatedWater = await this.repository.repairLeak(id, leakId);

      logger.info('Water leak repaired', {
        waterId: id,
        leakId,
        repairedBy: userId
      });

      return updatedWater;
    } catch (error) {
      logger.error('Error repairing leak:', error);
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

  async getLeakStats(companyId, startDate, endDate) {
    return this.repository.getLeakStats(companyId, startDate, endDate);
  }

  async getQualityStats(companyId, startDate, endDate) {
    return this.repository.getQualityStats(companyId, startDate, endDate);
  }

  // ============ RECOMMENDATIONS ============

  async generateRecommendations(waterId, companyId) {
    try {
      const water = await this.repository.findById(waterId, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      const recommendations = [];
      const total = water.consumption.total || 0;
      const cost = water.cost.total || 0;

      if (water.consumption.wasted > total * 0.2) {
        recommendations.push({
          title: 'تقليل هدر المياه',
          description: 'تركيب أجهزة كشف تسرب ومراقبة الضغط',
          potentialSavings: water.consumption.wasted * 0.3,
          potentialCostSaving: cost * 0.2,
          priority: 'high'
        });
      }

      if (water.consumption.reused / total < 0.2) {
        recommendations.push({
          title: 'زيادة إعادة استخدام المياه',
          description: 'تركيب نظام معالجة وتدوير المياه',
          potentialSavings: total * 0.15,
          potentialCostSaving: cost * 0.15,
          priority: 'high'
        });
      }

      if (water.consumption.recycled / total < 0.1) {
        recommendations.push({
          title: 'تدوير المياه المعالجة',
          description: 'إنشاء نظام تدوير مياه الصرف المعالجة',
          potentialSavings: total * 0.1,
          potentialCostSaving: cost * 0.1,
          priority: 'medium'
        });
      }

      if (water.quality.qualityScore < 70) {
        recommendations.push({
          title: 'تحسين جودة المياه',
          description: 'تحديث أنظمة المعالجة والترشيح',
          potentialSavings: 0,
          potentialCostSaving: 0,
          priority: 'high'
        });
      }

      water.recommendations = recommendations;
      await water.save();

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // ============ DASHBOARD ============

  async getWaterDashboard(companyId, startDate, endDate) {
    const [
      totalConsumption,
      distribution,
      trend,
      topFactories,
      leakStats,
      qualityStats
    ] = await Promise.all([
      this.getCompanyTotalConsumption(companyId, startDate, endDate),
      this.getConsumptionDistribution(companyId, startDate, endDate),
      this.getConsumptionTrend(companyId, 12),
      this.getTopConsumingFactories(companyId, startDate, endDate, 5),
      this.getLeakStats(companyId, startDate, endDate),
      this.getQualityStats(companyId, startDate, endDate)
    ]);

    return {
      period: { startDate, endDate },
      totalConsumption,
      distribution,
      trend,
      topFactories,
      leaks: leakStats,
      quality: qualityStats,
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteWater(id, userId, companyId, reason = null) {
    try {
      const water = await this.repository.findById(id, companyId);
      if (!water) {
        throw new NotFoundError('Water record not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('water.deleted', {
        waterId: id,
        name: water.name,
        companyId,
        deletedBy: userId
      });

      logger.info('Water record deleted successfully', {
        waterId: id,
        name: water.name,
        companyId
      });

      return { message: 'Water record deleted successfully' };
    } catch (error) {
      logger.error('Error deleting water record:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportWaterData(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportWaterData(companyId, startDate, endDate, format);
  }
}

module.exports = WaterService;