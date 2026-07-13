const BaseService = require('../../../core/base/BaseService');
const ProductionLineRepository = require('../repositories/ProductionLineRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class ProductionLineService extends BaseService {
  constructor() {
    super(new ProductionLineRepository(), 'ProductionLine');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createProductionLine(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'departmentId', 'factoryId']);

      // التحقق من عدم وجود خط إنتاج بنفس الاسم في القسم
      const existingName = await this.repository.findByName(data.name, data.departmentId, companyId);
      if (existingName) {
        throw new ConflictError('Production line with this name already exists in this department');
      }

      // التحقق من عدم وجود خط إنتاج بنفس الكود في القسم
      const existingCode = await this.repository.findByCode(data.code, data.departmentId, companyId);
      if (existingCode) {
        throw new ConflictError('Production line with this code already exists in this department');
      }

      const productionLineData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const productionLine = await this.repository.create(productionLineData);

      eventEmitter.emit('productionLine.created', {
        productionLineId: productionLine._id,
        name: productionLine.name,
        departmentId: productionLine.departmentId,
        factoryId: productionLine.factoryId,
        companyId,
        createdBy: userId
      });

      logger.info('Production line created successfully', {
        productionLineId: productionLine._id,
        name: productionLine.name,
        departmentId: productionLine.departmentId,
        companyId
      });

      return productionLine;
    } catch (error) {
      logger.error('Error creating production line:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getProductionLineById(id, companyId) {
    const productionLine = await this.repository.findById(id, companyId);
    if (!productionLine) {
      throw new NotFoundError('Production line not found');
    }
    return productionLine;
  }

  async getProductionLineByCode(code, departmentId, companyId) {
    const productionLine = await this.repository.findByCode(code, departmentId, companyId);
    if (!productionLine) {
      throw new NotFoundError('Production line not found');
    }
    return productionLine;
  }

  async getProductionLines(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getProductionLinesPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getDepartmentProductionLines(departmentId, companyId) {
    return this.repository.find({ departmentId }, companyId);
  }

  async getActiveProductionLines(departmentId, companyId) {
    return this.repository.findActive(departmentId, companyId);
  }

  async getHighPerformanceLines(minOEE = 80, departmentId, companyId) {
    return this.repository.findHighPerformance(minOEE, departmentId, companyId);
  }

  async getFactoryProductionLines(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  async searchProductionLines(query, departmentId, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, departmentId, companyId);
  }

  async getProductionLineStats(id) {
    const stats = await this.repository.getProductionLineStats(id);
    if (!stats) {
      throw new NotFoundError('Production line not found');
    }
    return stats;
  }

  async getDepartmentProductionLineStats(departmentId) {
    return this.repository.getDepartmentProductionLineStats(departmentId);
  }

  async getTypeDistribution(departmentId, companyId) {
    return this.repository.getTypeDistribution(departmentId, companyId);
  }

  async getCategoryDistribution(departmentId, companyId) {
    return this.repository.getCategoryDistribution(departmentId, companyId);
  }

  // ============ UPDATE ============

  async updateProductionLine(id, data, userId, companyId) {
    try {
      const existingLine = await this.repository.findById(id, companyId);
      if (!existingLine) {
        throw new NotFoundError('Production line not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'category', 'priority',
        'productionDetails', 'operatingDetails', 'settings',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.name && data.name !== existingLine.name) {
        const nameExists = await this.repository.findByName(
          data.name,
          existingLine.departmentId,
          companyId
        );
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Production line with this name already exists in this department');
        }
        updateData.name = data.name;
      }

      if (data.code && data.code.toUpperCase() !== existingLine.code) {
        const codeExists = await this.repository.findByCode(
          data.code,
          existingLine.departmentId,
          companyId
        );
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Production line with this code already exists in this department');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedLine = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('productionLine.updated', {
        productionLineId: updatedLine._id,
        name: updatedLine.name,
        departmentId: updatedLine.departmentId,
        companyId,
        updatedBy: userId
      });

      logger.info('Production line updated successfully', {
        productionLineId: updatedLine._id,
        name: updatedLine.name,
        companyId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating production line:', error);
      throw error;
    }
  }

  async updateStatus(id, status, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateStatus(id, status);

      logger.info('Production line status updated', {
        productionLineId: id,
        oldStatus: line.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  async updatePerformance(id, performance, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updatePerformance(id, performance);

      // حساب OEE تلقائياً
      await updatedLine.calculateOEE();

      logger.info('Production line performance updated', {
        productionLineId: id,
        performance,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating performance:', error);
      throw error;
    }
  }

  async updateMachines(id, machines, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateMachines(id, machines);

      logger.info('Production line machines updated', {
        productionLineId: id,
        machines,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating machines:', error);
      throw error;
    }
  }

  async updateSensors(id, sensors, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateSensors(id, sensors);

      logger.info('Production line sensors updated', {
        productionLineId: id,
        sensors,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating sensors:', error);
      throw error;
    }
  }

  async updateQuality(id, quality, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateQuality(id, quality);

      logger.info('Production line quality updated', {
        productionLineId: id,
        quality,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating quality:', error);
      throw error;
    }
  }

  async updateGreenScore(id, score, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateGreenScore(id, score);

      logger.info('Production line green score updated', {
        productionLineId: id,
        oldScore: line.environmental.greenScore,
        newScore: score,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating green score:', error);
      throw error;
    }
  }

  async updateCost(id, cost, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.updateCost(id, cost);

      logger.info('Production line cost updated', {
        productionLineId: id,
        cost,
        updatedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error updating cost:', error);
      throw error;
    }
  }

  async startLine(id, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.startLine(id);

      eventEmitter.emit('productionLine.started', {
        productionLineId: id,
        name: line.name,
        companyId,
        startedBy: userId
      });

      logger.info('Production line started', {
        productionLineId: id,
        name: line.name,
        startedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error starting production line:', error);
      throw error;
    }
  }

  async stopLine(id, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.stopLine(id);

      eventEmitter.emit('productionLine.stopped', {
        productionLineId: id,
        name: line.name,
        companyId,
        stoppedBy: userId
      });

      logger.info('Production line stopped', {
        productionLineId: id,
        name: line.name,
        stoppedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error stopping production line:', error);
      throw error;
    }
  }

  async addMaintenanceRecord(id, record, userId, companyId) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      const updatedLine = await this.repository.addMaintenanceRecord(id, record);

      logger.info('Maintenance record added', {
        productionLineId: id,
        record,
        addedBy: userId
      });

      return updatedLine;
    } catch (error) {
      logger.error('Error adding maintenance record:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteProductionLine(id, userId, companyId, reason = null) {
    try {
      const line = await this.repository.findById(id, companyId);
      if (!line) {
        throw new NotFoundError('Production line not found');
      }

      // التحقق من عدم وجود بيانات مرتبطة
      const stats = await this.repository.getProductionLineStats(id);
      if (stats && (stats.statistics?.totalMachines > 0 || 
                    stats.statistics?.totalSensors > 0)) {
        throw new ValidationError('Cannot delete production line with active machines or sensors.');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('productionLine.deleted', {
        productionLineId: id,
        name: line.name,
        departmentId: line.departmentId,
        companyId,
        deletedBy: userId
      });

      logger.info('Production line deleted successfully', {
        productionLineId: id,
        name: line.name,
        companyId
      });

      return { message: 'Production line deleted successfully' };
    } catch (error) {
      logger.error('Error deleting production line:', error);
      throw error;
    }
  }

  // ============ FILTERS ============

  async findWithFilters(filters = {}, departmentId, companyId) {
    return this.repository.findWithFilters(filters, departmentId, companyId);
  }

  // ============ DASHBOARD ============

  async getProductionLineDashboard(id, companyId) {
    const stats = await this.getProductionLineStats(id);
    const line = await this.getProductionLineById(id, companyId);
    
    return {
      productionLine: {
        id: line._id,
        name: line.name,
        code: line.code,
        type: line.type,
        category: line.category,
        priority: line.priority,
        status: line.status,
        isRunning: line.isRunning
      },
      production: {
        capacityPerHour: line.productionDetails.capacityPerHour,
        capacityPerDay: line.productionDetails.capacityPerDay,
        currentProduction: line.productionDetails.currentProduction,
        targetProduction: line.productionDetails.targetProduction,
        efficiency: line.productionDetails.efficiency,
        utilization: line.productionDetails.utilization
      },
      performance: {
        oee: line.performance.oee,
        availability: line.performance.availability,
        performance: line.performance.performance,
        quality: line.performance.quality,
        throughput: line.performance.throughput,
        cycleTime: line.performance.cycleTime
      },
      quality: {
        totalProduced: line.quality.totalProduced,
        totalDefects: line.quality.totalDefects,
        defectRate: line.quality.defectRate,
        qualityScore: line.quality.qualityScore
      },
      environmental: {
        greenScore: line.environmental.greenScore,
        energyConsumption: line.environmental.energyConsumption,
        carbonFootprint: line.environmental.carbonFootprint
      },
      machines: {
        total: line.machines.total,
        active: line.machines.active,
        idle: line.machines.idle,
        maintenance: line.machines.maintenance
      },
      statistics: stats.statistics || {},
      createdAt: line.createdAt
    };
  }
}

module.exports = ProductionLineService;