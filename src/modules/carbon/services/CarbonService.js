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

// ============ استيراد AI Service ============
const aiService = require('../../../core/services/AIService');

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

      if (carbon.energyData && carbon.energyData.renewablePercentage < 20) {
        recommendations.push({
          title: 'زيادة استخدام الطاقة المتجددة',
          description: 'تركيب ألواح شمسية أو شراء طاقة متجددة من الموردين',
          potentialReduction: carbon.emissions.totalEmissions * 0.1,
          priority: 'medium'
        });
      }

      if (!carbon.reductionActions || carbon.reductionActions.length < 3) {
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

  // ============ 🤖 AI INTEGRATION ============

  /**
   * 🟡 استدعاء AI Service لتوقع الكربون
   * هذا الميثود يستدعي خدمة AI الخارجية لتوقع انبعاثات الكربون المستقبلية
   * 
   * 📌 عند جاهزية AI Service:
   * 1. تأكد من أن `config.features.enableAI = true`
   * 2. تأكد من أن `config.ai.serviceUrl` يشير إلى عنوان AI Service الصحيح
   * 3. الدالة حالياً ترجع Mock Data في حالة عدم توفر AI Service
   */
  async predictCarbonEmissions(carbonId, companyId) {
    try {
      const carbon = await this.repository.findById(carbonId, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      // تجهيز البيانات المرسلة لـ AI Service
      const data = {
        id: carbon._id,
        type: carbon.type,
        currentEmissions: carbon.emissions?.totalEmissions || 0,
        scope1: carbon.emissions?.scope1?.total || 0,
        scope2: carbon.emissions?.scope2?.total || 0,
        scope3: carbon.emissions?.scope3?.total || 0,
        historicalData: await this.getHistoricalEmissions(carbon.factoryId, companyId),
        period: carbon.period,
        factoryId: carbon.factoryId,
        companyId: companyId
      };

      // استدعاء AI Service
      const prediction = await aiService.predictCarbon(data);
      
      // حفظ التوقع في الكربون (إذا كان الحقل موجوداً)
      if (carbon.prediction !== undefined) {
        carbon.prediction = prediction;
        await carbon.save();
      }

      logger.info('Carbon prediction completed', {
        carbonId: carbonId,
        predictedEmissions: prediction.predictedEmissions,
        confidence: prediction.confidence
      });

      return prediction;
    } catch (error) {
      logger.error('Error predicting carbon emissions:', error);
      throw error;
    }
  }

  /**
   * الحصول على البيانات التاريخية للانبعاثات
   * تستخدم كمدخل لـ AI Service
   */
  async getHistoricalEmissions(factoryId, companyId, months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const records = await this.repository.find({
      factoryId,
      'period.startDate': { $gte: startDate },
    }, companyId);

    return records.map(r => ({
      date: r.period?.startDate || r.createdAt,
      emissions: r.emissions?.totalEmissions || 0,
      scope1: r.emissions?.scope1?.total || 0,
      scope2: r.emissions?.scope2?.total || 0,
      scope3: r.emissions?.scope3?.total || 0
    }));
  }

  /**
   * 🟡 تحليل الأثر المالي لتقليل الكربون
   * يستدعي AI Service لحساب التوفير المالي وتقليل الكربون
   */
  async analyzeCarbonFinancialImpact(carbonId, companyId, options = {}) {
    try {
      const carbon = await this.repository.findById(carbonId, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const data = {
        carbonId: carbon._id,
        currentEmissions: carbon.emissions?.totalEmissions || 0,
        reductionTarget: carbon.targets?.reductionTarget || 0,
        estimatedCost: options.estimatedCost || 10000,
        estimatedSavings: options.estimatedSavings || 5000,
        carbonPrice: options.carbonPrice || 50, // دولار لكل طن
        timeframe: options.timeframe || 5 // سنوات
      };

      const analysis = await aiService.analyzeFinancialImpact(data);

      logger.info('Carbon financial impact analysis completed', {
        carbonId: carbonId,
        savings: analysis.savings,
        roi: analysis.roi
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing carbon financial impact:', error);
      throw error;
    }
  }

  /**
   * 🟡 تحليل What-If لتقليل الكربون
   * يستدعي AI Service لتحليل سيناريوهات مختلفة
   */
  async analyzeCarbonWhatIf(carbonId, companyId, scenario) {
    try {
      const carbon = await this.repository.findById(carbonId, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      const data = {
        carbonId: carbon._id,
        currentEmissions: carbon.emissions?.totalEmissions || 0,
        scenario: scenario || {
          type: 'renewable_energy',
          investment: 50000,
          expectedReduction: 30 // نسبة مئوية
        },
        factoryId: carbon.factoryId,
        companyId: companyId
      };

      const analysis = await aiService.whatIfAnalysis(data);

      logger.info('Carbon what-if analysis completed', {
        carbonId: carbonId,
        scenario: data.scenario.type
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing carbon what-if:', error);
      throw error;
    }
  }

  /**
   * 🟡 توليد توصيات ذكية من AI
   * يستدعي AI Service لتوليد توصيات مخصصة بناءً على بيانات الكربون
   */
  async generateAIRecommendations(carbonId, companyId) {
    try {
      const carbon = await this.repository.findById(carbonId, companyId);
      if (!carbon) {
        throw new NotFoundError('Carbon record not found');
      }

      // تجهيز البيانات
      const data = {
        carbonId: carbon._id,
        currentEmissions: carbon.emissions?.totalEmissions || 0,
        scope1: carbon.emissions?.scope1?.total || 0,
        scope2: carbon.emissions?.scope2?.total || 0,
        scope3: carbon.emissions?.scope3?.total || 0,
        reductionTarget: carbon.targets?.reductionTarget || 0,
        factoryId: carbon.factoryId,
        companyId: companyId,
        industry: carbon.industry || 'manufacturing',
        period: carbon.period
      };

      const recommendations = await aiService.generateRecommendations(data);

      // حفظ التوصيات في الكربون
      carbon.recommendations = recommendations.recommendations || [];
      await carbon.save();

      logger.info('AI recommendations generated', {
        carbonId: carbonId,
        count: recommendations.recommendations?.length || 0
      });

      return recommendations;
    } catch (error) {
      logger.error('Error generating AI recommendations:', error);
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