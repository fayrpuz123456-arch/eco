const BaseService = require('../../../core/base/BaseService');
const HeatRecoveryRepository = require('../repositories/HeatRecoveryRepository');
const {
  AppError,
  ValidationError,
  NotFoundError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const aiService = require('../../../core/services/AIService');
const logger = require('../../../core/utils/logger');

class HeatRecoveryService extends BaseService {
  constructor() {
    super(new HeatRecoveryRepository(), 'HeatRecovery');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createHeatRecovery(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'factoryId', 'machineId', 'heatSource.type', 'heatSource.temperature']);

      const heatRecoveryData = {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const heatRecovery = await this.repository.create(heatRecoveryData);

      // تحليل AI للفرصة
      await this.analyzeWithAI(heatRecovery._id, companyId);

      eventEmitter.emit('heatrecovery.created', {
        heatRecoveryId: heatRecovery._id,
        name: heatRecovery.name,
        companyId
      });

      logger.info('Heat recovery opportunity created successfully', {
        heatRecoveryId: heatRecovery._id,
        name: heatRecovery.name,
        companyId
      });

      return heatRecovery;
    } catch (error) {
      logger.error('Error creating heat recovery opportunity:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getHeatRecoveryById(id, companyId) {
    const heatRecovery = await this.repository.findById(id, companyId);
    if (!heatRecovery) {
      throw new NotFoundError('Heat recovery opportunity not found');
    }
    return heatRecovery;
  }

  async getHeatRecoveryByFactory(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  async getHeatRecoveryByMachine(machineId, companyId) {
    return this.repository.findByMachine(machineId, companyId);
  }

  async getHighPriority(companyId) {
    return this.repository.findHighPriority(companyId);
  }

  async getStats(companyId) {
    return this.repository.getStats(companyId);
  }

  // ============ AI ANALYSIS ============

  async analyzeWithAI(id, companyId) {
    try {
      const heatRecovery = await this.repository.findById(id, companyId);
      if (!heatRecovery) {
        throw new NotFoundError('Heat recovery opportunity not found');
      }

      // تجهيز البيانات للـ AI
      const data = {
        heatSource: heatRecovery.heatSource,
        wasteHeat: heatRecovery.heatCalculation.wasteHeat,
        recoverableHeat: heatRecovery.heatCalculation.recoverableHeat,
        factoryId: heatRecovery.factoryId,
        machineId: heatRecovery.machineId,
        companyId: companyId
      };

      // استدعاء AI Service
      const analysis = await aiService.analyzeHeatRecovery(data);

      // تحديث تحليل AI
      await this.repository.updateAIAnalysis(id, {
        analyzed: true,
        analyzedAt: new Date(),
        recommendations: analysis.recommendations || [],
        feasibilityScore: analysis.feasibilityScore || 0,
        priority: analysis.priority || 'medium',
        optimizedSolutions: analysis.solutions || []
      });

      // إضافة الحلول المقترحة من AI
      if (analysis.solutions && analysis.solutions.length > 0) {
        for (const solution of analysis.solutions) {
          await this.repository.addSolution(id, solution);
        }
      }

      logger.info('AI analysis completed for heat recovery', {
        heatRecoveryId: id,
        feasibilityScore: analysis.feasibilityScore
      });

      return heatRecovery;
    } catch (error) {
      logger.error('Error analyzing with AI:', error);
      return null;
    }
  }

  // ============ SOLUTIONS ============

  async addSolution(id, solution, userId, companyId) {
    try {
      const heatRecovery = await this.repository.findById(id, companyId);
      if (!heatRecovery) {
        throw new NotFoundError('Heat recovery opportunity not found');
      }

      const result = await this.repository.addSolution(id, solution);

      // إعادة حساب التحليل المالي
      await heatRecovery.calculateFinancialAnalysis();
      await heatRecovery.save();

      logger.info('Solution added to heat recovery', {
        heatRecoveryId: id,
        solutionType: solution.type,
        addedBy: userId
      });

      return result;
    } catch (error) {
      logger.error('Error adding solution:', error);
      throw error;
    }
  }

  // ============ IMPLEMENTATION ============

  async updateImplementation(id, data, userId, companyId) {
    try {
      const heatRecovery = await this.repository.findById(id, companyId);
      if (!heatRecovery) {
        throw new NotFoundError('Heat recovery opportunity not found');
      }

      const result = await this.repository.updateImplementation(id, data);

      if (data.status === 'completed') {
        eventEmitter.emit('heatrecovery.implemented', {
          heatRecoveryId: id,
          name: heatRecovery.name,
          companyId,
          implementedBy: userId
        });
      }

      logger.info('Implementation status updated', {
        heatRecoveryId: id,
        status: data.status,
        updatedBy: userId
      });

      return result;
    } catch (error) {
      logger.error('Error updating implementation:', error);
      throw error;
    }
  }

  // ============ UPDATE ============

  async updateHeatRecovery(id, data, userId, companyId) {
    try {
      const existing = await this.repository.findById(id, companyId);
      if (!existing) {
        throw new NotFoundError('Heat recovery opportunity not found');
      }

      const allowedUpdates = [
        'name', 'description', 'heatSource', 'heatCalculation',
        'solutions', 'financialAnalysis', 'environmentalImpact',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      updateData.updatedBy = userId;

      const updated = await this.repository.update(id, updateData, companyId);

      // إعادة التحليل المالي
      await updated.calculateFinancialAnalysis();
      await updated.save();

      return updated;
    } catch (error) {
      logger.error('Error updating heat recovery:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteHeatRecovery(id, userId, companyId, reason = null) {
    try {
      const heatRecovery = await this.repository.findById(id, companyId);
      if (!heatRecovery) {
        throw new NotFoundError('Heat recovery opportunity not found');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('heatrecovery.deleted', {
        heatRecoveryId: id,
        name: heatRecovery.name,
        companyId,
        deletedBy: userId
      });

      return { message: 'Heat recovery opportunity deleted successfully' };
    } catch (error) {
      logger.error('Error deleting heat recovery:', error);
      throw error;
    }
  }
}

module.exports = HeatRecoveryService;