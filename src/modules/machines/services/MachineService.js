const BaseService = require('../../../core/base/BaseService');
const MachineRepository = require('../repositories/MachineRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class MachineService extends BaseService {
  constructor() {
    super(new MachineRepository(), 'Machine');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createMachine(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'productionLineId', 'factoryId', 'departmentId']);

      // التحقق من عدم وجود آلة بنفس الاسم في خط الإنتاج
      const existingName = await this.repository.findByName(data.name, data.productionLineId, companyId);
      if (existingName) {
        throw new ConflictError('Machine with this name already exists in this production line');
      }

      // التحقق من عدم وجود آلة بنفس الكود في خط الإنتاج
      const existingCode = await this.repository.findByCode(data.code, data.productionLineId, companyId);
      if (existingCode) {
        throw new ConflictError('Machine with this code already exists in this production line');
      }

      // التحقق من عدم وجود آلة بنفس الرقم المسلسل
      if (data.serialNumber) {
        const existingSerial = await this.repository.findBySerialNumber(data.serialNumber);
        if (existingSerial) {
          throw new ConflictError('Machine with this serial number already exists');
        }
      }

      const machineData = {
        ...data,
        code: data.code.toUpperCase(),
        serialNumber: data.serialNumber ? data.serialNumber.toUpperCase() : undefined,
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const machine = await this.repository.create(machineData);

      eventEmitter.emit('machine.created', {
        machineId: machine._id,
        name: machine.name,
        productionLineId: machine.productionLineId,
        companyId,
        createdBy: userId
      });

      logger.info('Machine created successfully', {
        machineId: machine._id,
        name: machine.name,
        productionLineId: machine.productionLineId,
        companyId
      });

      return machine;
    } catch (error) {
      logger.error('Error creating machine:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getMachineById(id, companyId) {
    const machine = await this.repository.findById(id, companyId);
    if (!machine) {
      throw new NotFoundError('Machine not found');
    }
    return machine;
  }

  async getMachineByCode(code, productionLineId, companyId) {
    const machine = await this.repository.findByCode(code, productionLineId, companyId);
    if (!machine) {
      throw new NotFoundError('Machine not found');
    }
    return machine;
  }

  async getMachineBySerialNumber(serialNumber) {
    const machine = await this.repository.findBySerialNumber(serialNumber);
    if (!machine) {
      throw new NotFoundError('Machine not found');
    }
    return machine;
  }

  async getMachines(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getMachinesPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getProductionLineMachines(productionLineId, companyId) {
    return this.repository.find({ productionLineId }, companyId);
  }

  async getOperationalMachines(productionLineId, companyId) {
    return this.repository.findOperational(productionLineId, companyId);
  }

  async getMachinesByStatus(status, productionLineId, companyId) {
    return this.repository.findByStatus(status, productionLineId, companyId);
  }

  async getHighPerformanceMachines(minOEE = 80, productionLineId, companyId) {
    return this.repository.findHighPerformance(minOEE, productionLineId, companyId);
  }

  async getMachinesDueForMaintenance(days = 7, productionLineId, companyId) {
    return this.repository.findDueForMaintenance(days, productionLineId, companyId);
  }

  async getFactoryMachines(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  async getDepartmentMachines(departmentId, companyId) {
    return this.repository.findByDepartment(departmentId, companyId);
  }

  async searchMachines(query, productionLineId, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, productionLineId, companyId);
  }

  async getMachineStats(id) {
    const stats = await this.repository.getMachineStats(id);
    if (!stats) {
      throw new NotFoundError('Machine not found');
    }
    return stats;
  }

  async getProductionLineMachineStats(productionLineId) {
    return this.repository.getProductionLineMachineStats(productionLineId);
  }

  async getTypeDistribution(productionLineId, companyId) {
    return this.repository.getTypeDistribution(productionLineId, companyId);
  }

  async getStatusDistribution(productionLineId, companyId) {
    return this.repository.getStatusDistribution(productionLineId, companyId);
  }

  // ============ UPDATE ============

  async updateMachine(id, data, userId, companyId) {
    try {
      const existingMachine = await this.repository.findById(id, companyId);
      if (!existingMachine) {
        throw new NotFoundError('Machine not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'category', 'priority',
        'manufacturer', 'specifications', 'installation',
        'lifetime', 'settings', 'safety', 'documentation',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.name && data.name !== existingMachine.name) {
        const nameExists = await this.repository.findByName(
          data.name,
          existingMachine.productionLineId,
          companyId
        );
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Machine with this name already exists in this production line');
        }
        updateData.name = data.name;
      }

      if (data.code && data.code.toUpperCase() !== existingMachine.code) {
        const codeExists = await this.repository.findByCode(
          data.code,
          existingMachine.productionLineId,
          companyId
        );
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Machine with this code already exists in this production line');
        }
        updateData.code = data.code.toUpperCase();
      }

      if (data.serialNumber && data.serialNumber.toUpperCase() !== existingMachine.serialNumber) {
        const serialExists = await this.repository.findBySerialNumber(data.serialNumber);
        if (serialExists && serialExists._id !== id) {
          throw new ConflictError('Machine with this serial number already exists');
        }
        updateData.serialNumber = data.serialNumber.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedMachine = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('machine.updated', {
        machineId: updatedMachine._id,
        name: updatedMachine.name,
        productionLineId: updatedMachine.productionLineId,
        companyId,
        updatedBy: userId
      });

      logger.info('Machine updated successfully', {
        machineId: updatedMachine._id,
        name: updatedMachine.name,
        companyId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating machine:', error);
      throw error;
    }
  }

  async updateStatus(id, status, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updateStatus(id, status);

      logger.info('Machine status updated', {
        machineId: id,
        oldStatus: machine.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  async updatePerformance(id, performance, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updatePerformance(id, performance);

      // حساب OEE تلقائياً
      await updatedMachine.calculateOEE();

      logger.info('Machine performance updated', {
        machineId: id,
        performance,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating performance:', error);
      throw error;
    }
  }

  async updateSensors(id, sensors, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updateSensors(id, sensors);

      logger.info('Machine sensors updated', {
        machineId: id,
        sensors,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating sensors:', error);
      throw error;
    }
  }

  async updateEnergy(id, energy, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updateEnergy(id, energy);

      logger.info('Machine energy updated', {
        machineId: id,
        energy,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating energy:', error);
      throw error;
    }
  }

  async updateGreenScore(id, score, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updateGreenScore(id, score);

      logger.info('Machine green score updated', {
        machineId: id,
        oldScore: machine.environmental.greenScore,
        newScore: score,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating green score:', error);
      throw error;
    }
  }

  async updateCost(id, cost, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.updateCost(id, cost);

      logger.info('Machine cost updated', {
        machineId: id,
        cost,
        updatedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error updating cost:', error);
      throw error;
    }
  }

  async startMachine(id, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.startMachine(id);

      eventEmitter.emit('machine.started', {
        machineId: id,
        name: machine.name,
        companyId,
        startedBy: userId
      });

      logger.info('Machine started', {
        machineId: id,
        name: machine.name,
        startedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error starting machine:', error);
      throw error;
    }
  }

  async stopMachine(id, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.stopMachine(id);

      eventEmitter.emit('machine.stopped', {
        machineId: id,
        name: machine.name,
        companyId,
        stoppedBy: userId
      });

      logger.info('Machine stopped', {
        machineId: id,
        name: machine.name,
        stoppedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error stopping machine:', error);
      throw error;
    }
  }

  async setMaintenance(id, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.setMaintenance(id);

      logger.info('Machine set to maintenance', {
        machineId: id,
        name: machine.name,
        setBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error setting machine to maintenance:', error);
      throw error;
    }
  }

  async addMaintenanceRecord(id, record, userId, companyId) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      const updatedMachine = await this.repository.addMaintenanceRecord(id, record);

      // تحديث موعد الصيانة القادم إذا تم توفيره
      if (record.nextMaintenance) {
        await this.repository.updateNextMaintenance(id, record.nextMaintenance);
      }

      logger.info('Maintenance record added', {
        machineId: id,
        record,
        addedBy: userId
      });

      return updatedMachine;
    } catch (error) {
      logger.error('Error adding maintenance record:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteMachine(id, userId, companyId, reason = null) {
    try {
      const machine = await this.repository.findById(id, companyId);
      if (!machine) {
        throw new NotFoundError('Machine not found');
      }

      // التحقق من عدم وجود حساسات مرتبطة
      const stats = await this.repository.getMachineStats(id);
      if (stats && stats.statistics?.totalSensors > 0) {
        throw new ValidationError('Cannot delete machine with active sensors. Please delete all associated sensors first.');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('machine.deleted', {
        machineId: id,
        name: machine.name,
        productionLineId: machine.productionLineId,
        companyId,
        deletedBy: userId
      });

      logger.info('Machine deleted successfully', {
        machineId: id,
        name: machine.name,
        companyId
      });

      return { message: 'Machine deleted successfully' };
    } catch (error) {
      logger.error('Error deleting machine:', error);
      throw error;
    }
  }

  // ============ FILTERS ============

  async findWithFilters(filters = {}, productionLineId, companyId) {
    return this.repository.findWithFilters(filters, productionLineId, companyId);
  }

  // ============ DASHBOARD ============

  async getMachineDashboard(id, companyId) {
    const stats = await this.getMachineStats(id);
    const machine = await this.getMachineById(id, companyId);
    
    return {
      machine: {
        id: machine._id,
        name: machine.name,
        code: machine.code,
        serialNumber: machine.serialNumber,
        type: machine.type,
        category: machine.category,
        priority: machine.priority,
        status: machine.status,
        isOperational: machine.isOperational
      },
      manufacturer: machine.manufacturer,
      specifications: machine.specifications,
      installation: machine.installation,
      lifetime: machine.lifetime,
      performance: {
        oee: machine.performance.oee,
        availability: machine.performance.availability,
        performance: machine.performance.performance,
        quality: machine.performance.quality,
        throughput: machine.performance.throughput,
        cycleTime: machine.performance.cycleTime,
        uptime: machine.performance.uptime,
        downtime: machine.performance.downtime,
        efficiency: machine.performance.efficiency
      },
      maintenance: {
        type: machine.maintenance.type,
        frequency: machine.maintenance.frequency,
        lastMaintenance: machine.maintenance.lastMaintenance,
        nextMaintenance: machine.maintenance.nextMaintenance,
        history: machine.maintenance.maintenanceHistory.slice(-5) // آخر 5 سجلات
      },
      energy: {
        consumption: machine.energy.consumption,
        powerFactor: machine.energy.powerFactor,
        efficiency: machine.energy.efficiency,
        costPerHour: machine.energy.costPerHour
      },
      environmental: {
        greenScore: machine.environmental.greenScore,
        carbonFootprint: machine.environmental.carbonFootprint,
        noiseLevel: machine.environmental.noiseLevel,
        temperature: machine.environmental.temperature
      },
      cost: machine.cost,
      statistics: stats.statistics || {},
      createdAt: machine.createdAt
    };
  }
}

module.exports = MachineService;