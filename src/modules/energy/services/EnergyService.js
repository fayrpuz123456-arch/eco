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

// ============ استيراد AI Service ============
const aiService = require('../../../core/services/AIService');

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

      if (energy.kpis?.renewablePercentage < 20) {
        recommendations.push({
          title: 'زيادة استخدام الطاقة المتجددة',
          description: 'تركيب ألواح شمسية أو شراء طاقة خضراء',
          potentialSavings: total * 0.1,
          potentialCostSaving: cost * 0.08,
          priority: 'medium'
        });
      }

      if (energy.efficiency?.overall < 70) {
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

  // ============ 🤖 AI INTEGRATION ============

  /**
   * 🟡 استدعاء AI Service لتوقع استهلاك الطاقة
   * هذا الميثود يستدعي خدمة AI الخارجية لتوقع استهلاك الطاقة المستقبلي
   * 
   * 📌 عند جاهزية AI Service:
   * 1. تأكد من أن `config.features.enableAI = true`
   * 2. تأكد من أن `config.ai.serviceUrl` يشير إلى عنوان AI Service الصحيح
   * 3. الدالة حالياً ترجع Mock Data في حالة عدم توفر AI Service
   */
  async predictConsumption(energyId, companyId, hours = 24) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      // تجهيز البيانات المرسلة لـ AI Service
      const data = {
        id: energy._id,
        type: energy.type,
        source: energy.source,
        currentConsumption: energy.consumption?.total || 0,
        electricity: energy.consumption?.electricity?.total || 0,
        fuel: energy.consumption?.fuel?.total || 0,
        gas: energy.consumption?.gas?.total || 0,
        renewable: energy.consumption?.renewable?.total || 0,
        historicalData: await this.getHistoricalConsumption(energy.factoryId, companyId),
        hours: hours,
        period: energy.period,
        factoryId: energy.factoryId,
        companyId: companyId
      };

      // استدعاء AI Service
      const prediction = await aiService.predictConsumption(data);
      
      // حفظ التوقع في الطاقة (إذا كان الحقل موجوداً)
      if (energy.prediction !== undefined) {
        energy.prediction = prediction;
        await energy.save();
      }

      logger.info('Energy consumption prediction completed', {
        energyId: energyId,
        predictedConsumption: prediction.prediction,
        confidence: prediction.confidence
      });

      return prediction;
    } catch (error) {
      logger.error('Error predicting energy consumption:', error);
      throw error;
    }
  }

  /**
   * الحصول على البيانات التاريخية للاستهلاك
   * تستخدم كمدخل لـ AI Service
   */
  async getHistoricalConsumption(factoryId, companyId, months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const records = await this.repository.find({
      factoryId,
      'period.startDate': { $gte: startDate },
    }, companyId);

    return records.map(r => ({
      date: r.period?.startDate || r.createdAt,
      consumption: r.consumption?.total || 0,
      electricity: r.consumption?.electricity?.total || 0,
      fuel: r.consumption?.fuel?.total || 0,
      gas: r.consumption?.gas?.total || 0,
      renewable: r.consumption?.renewable?.total || 0,
      cost: r.cost?.total || 0
    }));
  }

  /**
   * 🟡 تحليل استعادة الحرارة المهدرة (Heat Recovery)
   * يستدعي AI Service لتحليل الحرارة المهدرة واقتراح حلول
   */
  async analyzeHeatRecovery(energyId, companyId) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const data = {
        energyId: energy._id,
        type: energy.type,
        source: energy.source,
        totalConsumption: energy.consumption?.total || 0,
        fuelConsumption: energy.consumption?.fuel?.total || 0,
        gasConsumption: energy.consumption?.gas?.total || 0,
        efficiency: energy.efficiency?.overall || 0,
        temperature: energy.metadata?.temperature || 0,
        factoryId: energy.factoryId,
        companyId: companyId
      };

      const analysis = await aiService.analyzeHeatRecovery(data);

      logger.info('Heat recovery analysis completed', {
        energyId: energyId,
        recoverableHeat: analysis.recoverableHeat,
        potentialSavings: analysis.potentialSavings
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing heat recovery:', error);
      throw error;
    }
  }

  /**
   * 🟡 اكتشاف الشذوذ في استهلاك الطاقة
   * يستدعي AI Service لاكتشاف القراءات غير الطبيعية
   */
  async detectEnergyAnomalies(energyId, companyId, startDate, endDate) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      // جلب القراءات للفترة المطلوبة
      const readings = await this.repository.getReadingsInRange(
        energyId,
        startDate,
        endDate,
        1000
      );

      const data = {
        energyId: energy._id,
        type: energy.type,
        readings: readings.map(r => ({
          timestamp: r.timestamp,
          value: r.value,
          unit: r.unit || 'kWh'
        })),
        threshold: 3,
        factoryId: energy.factoryId,
        companyId: companyId
      };

      const anomalies = await aiService.detectAnomalies(data);

      logger.info('Energy anomaly detection completed', {
        energyId: energyId,
        anomaliesFound: anomalies.anomalies?.length || 0
      });

      return anomalies;
    } catch (error) {
      logger.error('Error detecting energy anomalies:', error);
      throw error;
    }
  }

  /**
   * 🟡 تحليل What-If للطاقة
   * يستدعي AI Service لتحليل سيناريوهات مختلفة لتوفير الطاقة
   */
  async analyzeEnergyWhatIf(energyId, companyId, scenario) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const data = {
        energyId: energy._id,
        currentConsumption: energy.consumption?.total || 0,
        currentCost: energy.cost?.total || 0,
        scenario: scenario || {
          type: 'solar_panels',
          investment: 50000,
          expectedSavings: 20 // نسبة مئوية
        },
        factoryId: energy.factoryId,
        companyId: companyId
      };

      const analysis = await aiService.whatIfAnalysis(data);

      logger.info('Energy what-if analysis completed', {
        energyId: energyId,
        scenario: data.scenario.type
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing energy what-if:', error);
      throw error;
    }
  }

  /**
   * 🟡 توليد توصيات ذكية من AI للطاقة
   * يستدعي AI Service لتوليد توصيات مخصصة بناءً على بيانات الطاقة
   */
  async generateAIRecommendations(energyId, companyId) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      // تجهيز البيانات
      const data = {
        energyId: energy._id,
        currentConsumption: energy.consumption?.total || 0,
        electricity: energy.consumption?.electricity?.total || 0,
        fuel: energy.consumption?.fuel?.total || 0,
        gas: energy.consumption?.gas?.total || 0,
        renewable: energy.consumption?.renewable?.total || 0,
        cost: energy.cost?.total || 0,
        efficiency: energy.efficiency?.overall || 0,
        reductionTarget: energy.targets?.consumptionReduction || 0,
        renewableTarget: energy.targets?.renewableTarget || 0,
        factoryId: energy.factoryId,
        companyId: companyId,
        type: energy.type,
        source: energy.source
      };

      const recommendations = await aiService.generateRecommendations(data);

      // حفظ التوصيات في الطاقة
      energy.recommendations = recommendations.recommendations || [];
      await energy.save();

      logger.info('AI energy recommendations generated', {
        energyId: energyId,
        count: recommendations.recommendations?.length || 0
      });

      return recommendations;
    } catch (error) {
      logger.error('Error generating AI recommendations:', error);
      throw error;
    }
  }

  /**
   * 🟡 تحليل الأثر المالي لتوفير الطاقة
   * يستدعي AI Service لحساب التوفير المالي وتقليل الكربون
   */
  async analyzeEnergyFinancialImpact(energyId, companyId, options = {}) {
    try {
      const energy = await this.repository.findById(energyId, companyId);
      if (!energy) {
        throw new NotFoundError('Energy record not found');
      }

      const data = {
        energyId: energy._id,
        currentConsumption: energy.consumption?.total || 0,
        currentCost: energy.cost?.total || 0,
        estimatedSavings: options.estimatedSavings || energy.consumption?.total * 0.15,
        estimatedCost: options.estimatedCost || 10000,
        energyPrice: options.energyPrice || 0.15, // دولار لكل كيلوواط
        timeframe: options.timeframe || 5 // سنوات
      };

      const analysis = await aiService.analyzeFinancialImpact(data);

      logger.info('Energy financial impact analysis completed', {
        energyId: energyId,
        savings: analysis.savings,
        roi: analysis.roi
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing energy financial impact:', error);
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