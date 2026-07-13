const BaseService = require('../../../core/base/BaseService');
const WasteRepository = require('../repositories/WasteRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class WasteService extends BaseService {
  constructor() {
    super(new WasteRepository(), 'Waste');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createWaste(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'category', 'period.startDate', 'period.endDate']);

      // التحقق من عدم وجود كود مكرر
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Waste record with this code already exists');
      }

      // تحضير البيانات
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      
      const wasteData = {
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

      const waste = new this.repository.model(wasteData);
      await waste.calculateTotalGeneration();
      await waste.calculateTotalDisposal();
      await waste.calculateCost();

      eventEmitter.emit('waste.created', {
        wasteId: waste._id,
        name: waste.name,
        companyId,
        createdBy: userId
      });

      logger.info('Waste record created successfully', {
        wasteId: waste._id,
        name: waste.name,
        companyId
      });

      return waste;
    } catch (error) {
      logger.error('Error creating waste record:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getWasteById(id, companyId) {
    const waste = await this.repository.findById(id, companyId);
    if (!waste) {
      throw new NotFoundError('Waste record not found');
    }
    return waste;
  }

  async getWasteByCode(code) {
    const waste = await this.repository.findByCode(code);
    if (!waste) {
      throw new NotFoundError('Waste record not found');
    }
    return waste;
  }

  async getWasteRecords(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getWasteRecordsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getWasteByPeriod(companyId, startDate, endDate) {
    return this.repository.findByPeriod(companyId, startDate, endDate);
  }

  async getWasteByType(companyId, type, startDate, endDate) {
    return this.repository.findByType(companyId, type, startDate, endDate);
  }

  async getWasteByCategory(companyId, category, startDate, endDate) {
    return this.repository.findByCategory(companyId, category, startDate, endDate);
  }

  async getWasteByYear(companyId, year) {
    return this.repository.findByYear(companyId, year);
  }

  async getWasteByFactory(companyId, factoryId, startDate, endDate) {
    return this.repository.findByFactory(companyId, factoryId, startDate, endDate);
  }

  // ============ UPDATE ============

  async updateWaste(id, data, userId, companyId) {
    try {
      const existingWaste = await this.repository.findById(id, companyId);
      if (!existingWaste) {
        throw new NotFoundError('Waste record not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'category', 'hazardLevel',
        'period', 'generation', 'disposal', 'recycling',
        'wasteToValue', 'environmentalImpact', 'collection',
        'cost', 'kpis', 'targets', 'breakdown',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.code && data.code.toUpperCase() !== existingWaste.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Waste record with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedWaste = await this.repository.update(id, updateData, companyId);

      if (data.generation) {
        await updatedWaste.calculateTotalGeneration();
      }
      if (data.disposal) {
        await updatedWaste.calculateTotalDisposal();
      }
      if (data.cost) {
        await updatedWaste.calculateCost();
      }

      eventEmitter.emit('waste.updated', {
        wasteId: updatedWaste._id,
        name: updatedWaste.name,
        companyId,
        updatedBy: userId
      });

      logger.info('Waste record updated successfully', {
        wasteId: updatedWaste._id,
        name: updatedWaste.name,
        companyId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating waste record:', error);
      throw error;
    }
  }

  async updateGeneration(id, generationData, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.updateGeneration(id, generationData);
      await updatedWaste.calculateTotalGeneration();

      logger.info('Waste generation updated', {
        wasteId: id,
        generation: generationData,
        updatedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating generation:', error);
      throw error;
    }
  }

  async updateDisposal(id, disposalData, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.updateDisposal(id, disposalData);
      await updatedWaste.calculateTotalDisposal();

      logger.info('Waste disposal updated', {
        wasteId: id,
        disposal: disposalData,
        updatedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating disposal:', error);
      throw error;
    }
  }

  async updateRecycling(id, recyclingData, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.updateRecycling(id, recyclingData);

      logger.info('Waste recycling updated', {
        wasteId: id,
        recycling: recyclingData,
        updatedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating recycling:', error);
      throw error;
    }
  }

  async updateTargets(id, targets, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.updateTargets(id, targets);
      await updatedWaste.updateTargetStatus();

      logger.info('Waste targets updated', {
        wasteId: id,
        targets,
        updatedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating targets:', error);
      throw error;
    }
  }

  // ============ WASTE-TO-VALUE ============

  async addWasteToValueOpportunity(id, opportunity, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.addWasteToValueOpportunity(id, opportunity);

      eventEmitter.emit('waste.opportunity.added', {
        wasteId: id,
        opportunity,
        companyId,
        addedBy: userId
      });

      logger.info('Waste-to-value opportunity added', {
        wasteId: id,
        opportunity,
        addedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error adding waste-to-value opportunity:', error);
      throw error;
    }
  }

  async updateOpportunityStatus(id, opportunityId, status, userId, companyId) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const updatedWaste = await this.repository.updateOpportunityStatus(id, opportunityId, status);

      if (status === 'sold') {
        eventEmitter.emit('waste.opportunity.sold', {
          wasteId: id,
          opportunityId,
          companyId,
          soldBy: userId
        });
      }

      logger.info('Waste opportunity status updated', {
        wasteId: id,
        opportunityId,
        status,
        updatedBy: userId
      });

      return updatedWaste;
    } catch (error) {
      logger.error('Error updating opportunity status:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotalWaste(companyId, startDate, endDate) {
    return this.repository.getCompanyTotalWaste(companyId, startDate, endDate);
  }

  async getWasteDistribution(companyId, startDate, endDate) {
    return this.repository.getWasteDistribution(companyId, startDate, endDate);
  }

  async getWasteTrend(companyId, months = 12) {
    return this.repository.getWasteTrend(companyId, months);
  }

  async getYearlyWaste(companyId, year) {
    return this.repository.getYearlyWaste(companyId, year);
  }

  async getTopWasteGeneratingFactories(companyId, startDate, endDate, limit = 10) {
    return this.repository.getTopWasteGeneratingFactories(companyId, startDate, endDate, limit);
  }

  async getWasteToValueStats(companyId, startDate, endDate) {
    return this.repository.getWasteToValueStats(companyId, startDate, endDate);
  }

  // ============ RECOMMENDATIONS ============

  async generateRecommendations(wasteId, companyId) {
    try {
      const waste = await this.repository.findById(wasteId, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      const recommendations = [];
      const total = waste.generation.total || 0;
      const landfillRate = waste.landfillRate || 0;

      if (landfillRate > 50) {
        recommendations.push({
          title: 'تقليل النفايات المرسلة إلى المكبات',
          description: 'زيادة برامج إعادة التدوير وتحويل النفايات العضوية إلى سماد',
          potentialReduction: total * 0.3,
          potentialCostSaving: waste.cost.total * 0.2,
          priority: 'high'
        });
      }

      if (waste.disposal.recycling / total < 0.2) {
        recommendations.push({
          title: 'زيادة معدل إعادة التدوير',
          description: 'تنفيذ برنامج فصل النفايات عند المصدر وشراكة مع شركات إعادة التدوير',
          potentialReduction: total * 0.15,
          potentialCostSaving: waste.cost.total * 0.1,
          potentialRevenue: total * 0.05 * 100,
          priority: 'high'
        });
      }

      if (waste.wasteToValue.opportunities.length < 3) {
        recommendations.push({
          title: 'استكشاف فرص تحويل النفايات إلى قيمة',
          description: 'دراسة إمكانية بيع النفايات القابلة لإعادة التدوير للمصانع الأخرى',
          potentialReduction: total * 0.1,
          potentialRevenue: total * 0.03 * 100,
          priority: 'medium'
        });
      }

      if (waste.disposal.energy_recovery < total * 0.1) {
        recommendations.push({
          title: 'استعادة الطاقة من النفايات',
          description: 'دراسة إمكانية تحويل النفايات إلى طاقة (Waste-to-Energy)',
          potentialReduction: total * 0.05,
          potentialCostSaving: waste.cost.total * 0.05,
          priority: 'medium'
        });
      }

      waste.recommendations = recommendations;
      await waste.save();

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // ============ DASHBOARD ============

  async getWasteDashboard(companyId, startDate, endDate) {
    const [
      totalWaste,
      distribution,
      trend,
      topFactories,
      wasteToValueStats
    ] = await Promise.all([
      this.getCompanyTotalWaste(companyId, startDate, endDate),
      this.getWasteDistribution(companyId, startDate, endDate),
      this.getWasteTrend(companyId, 12),
      this.getTopWasteGeneratingFactories(companyId, startDate, endDate, 5),
      this.getWasteToValueStats(companyId, startDate, endDate)
    ]);

    return {
      period: { startDate, endDate },
      totalWaste,
      distribution,
      trend,
      topFactories,
      wasteToValue: wasteToValueStats,
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteWaste(id, userId, companyId, reason = null) {
    try {
      const waste = await this.repository.findById(id, companyId);
      if (!waste) {
        throw new NotFoundError('Waste record not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('waste.deleted', {
        wasteId: id,
        name: waste.name,
        companyId,
        deletedBy: userId
      });

      logger.info('Waste record deleted successfully', {
        wasteId: id,
        name: waste.name,
        companyId
      });

      return { message: 'Waste record deleted successfully' };
    } catch (error) {
      logger.error('Error deleting waste record:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportWasteData(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportWasteData(companyId, startDate, endDate, format);
  }
}

module.exports = WasteService;