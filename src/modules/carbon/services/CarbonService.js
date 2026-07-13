const BaseService = require('../../../core/base/BaseService');
const CarbonRepository = require('../repositories/CarbonRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class CarbonService extends BaseService {
  constructor() {
    super(new CarbonRepository(), 'Carbon');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createCarbon(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'period.startDate', 'period.endDate']);

      // التحقق من عدم وجود كود مكرر
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Carbon record with this code already exists');
      }

      // تحضير البيانات
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      
      const carbonData = {
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

      // حساب الإجمالي
      const carbon = new this.repository.model(carbonData);
      await carbon.calculateTotalEmissions();

      // إرسال حدث
      eventEmitter.emit('carbon.created', {
        carbonId: carbon._id,
        name: carbon.name,
        companyId,
        createdBy: userId
      });

      logger.info('Carbon record created successfully', {
        carbonId: carbon._id,
        name: carbon.name,
        companyId
      });

      return carbon;
    } catch (error) {
      logger.error('Error creating carbon record:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getCarbonById(id, companyId) {
    const carbon = await this.repository.findById(id, companyId);
    if (!carbon) {
      throw new NotFoundError('Carbon record not found');
    }
    return carbon;
  }

  async getCarbonByCode(code) {
    const carbon = await this.repository.findByCode(code);
    if (!carbon) {
      throw new NotFoundError('Carbon record not found');
    }
    return carbon;
  }

  async getCarbonRecords(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getCarbonRecordsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getCarbonByPeriod(companyId, startDate, endDate) {
    return this.repository.findByPeriod(companyId, startDate, endDate);
  }

  async getCarbonByType(companyId, type, startDate, endDate) {
    return this.repository.findByType(companyId, type, startDate, endDate);
  }

  async getCarbonByYear(companyId, year) {
    return this.repository.findByYear(companyId, year);
  }

  async getCarbonByFactory(companyId, factoryId, startDate, endDate) {
    return this.repository.findByFactory(companyId, factoryId, startDate, endDate);
  }

  // ============ UPDATE ============

  async updateCarbon(id, data, userId, companyId) {
    try {
      const existingCarbon = await this.repository.findById(id, companyId);
      if (!existingCarbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'period',
        'emissions', 'intensity', 'targets',
        'emissionFactors', 'reductionActions',
        'offsets', 'energyData', 'tags',
        'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.code && data.code.toUpperCase() !== existingCarbon.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Carbon record with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedCarbon = await this.repository.update(id, updateData, companyId);

      // إعادة حساب الإجمالي
      if (data.emissions) {
        await updatedCarbon.calculateTotalEmissions();
      }

      eventEmitter.emit('carbon.updated', {
        carbonId: updatedCarbon._id,
        name: updatedCarbon.name,
        companyId,
        updatedBy: userId
      });

      logger.info('Carbon record updated successfully', {
        carbonId: updatedCarbon._id,
        name: updatedCarbon.name,
        companyId
      });

      return updatedCarbon;
    } catch (error) {
      logger.error('Error updating carbon record:', error);
      throw error;
    }
  }

  async updateEmissions(id, emissionsData, userId, companyId) {
    try {
      const carbon = await this.repository.findById(id, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const updatedCarbon = await this.repository.updateEmissions(id, emissionsData);
      await updatedCarbon.calculateTotalEmissions();

      logger.info('Carbon emissions updated', {
        carbonId: id,
        emissions: emissionsData,
        updatedBy: userId
      });

      return updatedCarbon;
    } catch (error) {
      logger.error('Error updating emissions:', error);
      throw error;
    }
  }

  async updateTargets(id, targets, userId, companyId) {
    try {
      const carbon = await this.repository.findById(id, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const updatedCarbon = await this.repository.updateTargets(id, targets);
      await updatedCarbon.updateTargetStatus();

      logger.info('Carbon targets updated', {
        carbonId: id,
        targets,
        updatedBy: userId
      });

      return updatedCarbon;
    } catch (error) {
      logger.error('Error updating targets:', error);
      throw error;
    }
  }

  async verifyCarbon(id, verificationData, userId, companyId) {
    try {
      const carbon = await this.repository.findById(id, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const updatedCarbon = await this.repository.updateVerification(id, {
        ...verificationData,
        verified: true,
        verifiedDate: new Date(),
        verifiedBy: userId
      });

      logger.info('Carbon record verified', {
        carbonId: id,
        verifiedBy: userId
      });

      return updatedCarbon;
    } catch (error) {
      logger.error('Error verifying carbon record:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  async getCompanyTotalEmissions(companyId, startDate, endDate) {
    return this.repository.getCompanyTotalEmissions(companyId, startDate, endDate);
  }

  async getEmissionsDistribution(companyId, startDate, endDate) {
    return this.repository.getEmissionsDistribution(companyId, startDate, endDate);
  }

  async getEmissionsTrend(companyId, months = 12) {
    return this.repository.getEmissionsTrend(companyId, months);
  }

  async getYearlyEmissions(companyId, year) {
    return this.repository.getYearlyEmissions(companyId, year);
  }

  async getMonthlyEmissions(companyId, year, month) {
    return this.repository.getMonthlyEmissions(companyId, year, month);
  }

  async getTopEmittingFactories(companyId, startDate, endDate, limit = 10) {
    return this.repository.getTopEmittingFactories(companyId, startDate, endDate, limit);
  }

  async getReductionActions(companyId) {
    return this.repository.getReductionActions(companyId);
  }

  // ============ RECOMMENDATIONS ============

  async generateRecommendations(carbonId, companyId) {
    try {
      const carbon = await this.repository.findById(carbonId, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const recommendations = [];
      const total = carbon.emissions.totalEmissions || 0;

      // توصيات بناءً على الانبعاثات
      if (carbon.emissions.scope1.total > total * 0.3) {
        recommendations.push({
          title: 'تقليل الانبعاثات المباشرة',
          description: 'استبدال المعدات القديمة بمعدات أكثر كفاءة واستخدام مصادر طاقة أنظف',
          potentialReduction: carbon.emissions.scope1.total * 0.2,
          priority: 'high'
        });
      }

      if (carbon.emissions.scope2.total > total * 0.4) {
        recommendations.push({
          title: 'تحسين كفاءة الطاقة',
          description: 'تركيب أنظمة إدارة الطاقة واستخدام الإضاءة LED وتحسين العزل',
          potentialReduction: carbon.emissions.scope2.total * 0.15,
          priority: 'high'
        });
      }

      if (carbon.energyData.renewablePercentage < 20) {
        recommendations.push({
          title: 'زيادة استخدام الطاقة المتجددة',
          description: 'تركيب ألواح شمسية أو شراء طاقة متجددة من الموردين',
          potentialReduction: carbon.emissions.totalEmissions * 0.1,
          priority: 'medium'
        });
      }

      if (carbon.reductionActions.length < 3) {
        recommendations.push({
          title: 'تنفيذ إجراءات تخفيض إضافية',
          description: 'تطوير خطة عمل لتقليل الانبعاثات في جميع النطاقات',
          potentialReduction: carbon.emissions.totalEmissions * 0.05,
          priority: 'medium'
        });
      }

      // حفظ التوصيات
      carbon.recommendations = recommendations;
      await carbon.save();

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // ============ DASHBOARD ============

  async getCarbonDashboard(companyId, startDate, endDate) {
    const [
      totalEmissions,
      distribution,
      trend,
      topFactories,
      actions
    ] = await Promise.all([
      this.getCompanyTotalEmissions(companyId, startDate, endDate),
      this.getEmissionsDistribution(companyId, startDate, endDate),
      this.getEmissionsTrend(companyId, 12),
      this.getTopEmittingFactories(companyId, startDate, endDate, 5),
      this.getReductionActions(companyId)
    ]);

    return {
      period: { startDate, endDate },
      totalEmissions,
      distribution,
      trend,
      topFactories,
      reductionActions: actions,
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteCarbon(id, userId, companyId, reason = null) {
    try {
      const carbon = await this.repository.findById(id, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('carbon.deleted', {
        carbonId: id,
        name: carbon.name,
        companyId,
        deletedBy: userId
      });

      logger.info('Carbon record deleted successfully', {
        carbonId: id,
        name: carbon.name,
        companyId
      });

      return { message: 'Carbon record deleted successfully' };
    } catch (error) {
      logger.error('Error deleting carbon record:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportCarbonData(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportCarbonData(companyId, startDate, endDate, format);
  }
}

module.exports = CarbonService;