const BaseRepository = require('../../../core/base/BaseRepository');
const Machine = require('../models/Machine.model');

/**
 * مستودع الآلات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالآلات
 */
class MachineRepository extends BaseRepository {
  constructor() {
    super(Machine);
    this.model = Machine;
  }

  // ============ FIND METHODS ============

  async findByCode(code, productionLineId, companyId) {
    return this.model.findOne({
      code: code.toUpperCase(),
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async findBySerialNumber(serialNumber) {
    return this.model.findOne({
      serialNumber: serialNumber.toUpperCase(),
      deletedAt: null
    });
  }

  async findByName(name, productionLineId, companyId) {
    return this.model.findOne({
      name: name.trim(),
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async findByType(type, productionLineId, companyId) {
    return this.model.find({
      type,
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async findByStatus(status, productionLineId, companyId) {
    return this.model.find({
      status,
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async findOperational(productionLineId, companyId) {
    return this.model.find({
      status: 'operational',
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async findHighPerformance(minOEE = 80, productionLineId, companyId) {
    return this.model.find({
      'performance.oee': { $gte: minOEE },
      productionLineId,
      companyId,
      deletedAt: null
    }).sort({ 'performance.oee': -1 });
  }

  async findDueForMaintenance(days = 7, productionLineId, companyId) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    
    return this.model.find({
      'maintenance.nextMaintenance': { $lte: dueDate },
      productionLineId,
      companyId,
      deletedAt: null
    }).sort({ 'maintenance.nextMaintenance': 1 });
  }

  async findByFactory(factoryId, companyId) {
    return this.model.find({
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async findByDepartment(departmentId, companyId) {
    return this.model.find({
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async search(searchTerm, productionLineId, companyId) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      productionLineId,
      companyId,
      deletedAt: null,
      $or: [
        { name: searchRegex },
        { code: searchRegex },
        { serialNumber: searchRegex },
        { description: searchRegex },
        { type: searchRegex },
        { 'manufacturer.name': searchRegex },
        { 'manufacturer.model': searchRegex }
      ]
    });
  }

  async getMachineStats(machineId) {
    return this.model.getMachineStats(machineId);
  }

  async getProductionLineMachineStats(productionLineId) {
    return this.model.getProductionLineMachineStats(productionLineId);
  }

  async getTypeDistribution(productionLineId, companyId) {
    return this.model.getTypeDistribution(productionLineId, companyId);
  }

  async getStatusDistribution(productionLineId, companyId) {
    return this.model.getStatusDistribution(productionLineId, companyId);
  }

  // ============ UPDATE METHODS ============

  async updatePerformance(machineId, performance) {
    const updateFields = {};
    for (const key of Object.keys(performance)) {
      updateFields[`performance.${key}`] = performance[key];
    }
    updateFields['performance.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateSensors(machineId, sensors) {
    const updateFields = {};
    for (const key of Object.keys(sensors)) {
      updateFields[`sensors.${key}`] = sensors[key];
    }
    updateFields['sensors.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateEnergy(machineId, energy) {
    const updateFields = {};
    for (const key of Object.keys(energy)) {
      updateFields[`energy.${key}`] = energy[key];
    }
    updateFields['energy.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateGreenScore(machineId, score) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        'environmental.greenScore': Math.min(100, Math.max(0, score)),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateCost(machineId, cost) {
    const updateFields = {};
    for (const key of Object.keys(cost)) {
      updateFields[`cost.${key}`] = cost[key];
    }
    updateFields['cost.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateStatus(machineId, status) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async startMachine(machineId) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        status: 'operational',
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async stopMachine(machineId) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        status: 'idle',
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async setMaintenance(machineId) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        status: 'maintenance',
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async addMaintenanceRecord(machineId, record) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        $push: { 'maintenance.maintenanceHistory': record },
        'maintenance.lastMaintenance': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateNextMaintenance(machineId, nextMaintenance) {
    return this.model.findOneAndUpdate(
      { _id: machineId, deletedAt: null },
      {
        'maintenance.nextMaintenance': nextMaintenance,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  async bulkUpdateStatus(machineIds, status, productionLineId, companyId) {
    return this.model.updateMany(
      { _id: { $in: machineIds }, productionLineId, companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async findWithFilters(filters = {}, productionLineId, companyId) {
    const query = { productionLineId, companyId, deletedAt: null };
    
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.priority) query.priority = filters.priority;
    if (filters.minOEE) {
      query['performance.oee'] = { $gte: parseInt(filters.minOEE) };
    }
    if (filters.maxOEE) {
      if (!query['performance.oee']) query['performance.oee'] = {};
      query['performance.oee']['$lte'] = parseInt(filters.maxOEE);
    }
    if (filters.minGreenScore) {
      query['environmental.greenScore'] = { $gte: parseInt(filters.minGreenScore) };
    }
    if (filters.maxGreenScore) {
      if (!query['environmental.greenScore']) query['environmental.greenScore'] = {};
      query['environmental.greenScore']['$lte'] = parseInt(filters.maxGreenScore);
    }
    if (filters.isOperational !== undefined) {
      query.status = filters.isOperational === 'true' ? 'operational' : { $ne: 'operational' };
    }
    if (filters.dueForMaintenance !== undefined) {
      const days = parseInt(filters.dueForMaintenance) || 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      query['maintenance.nextMaintenance'] = { $lte: dueDate };
    }
    if (filters.tag) query.tags = filters.tag;
    
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { serialNumber: searchRegex },
        { description: searchRegex }
      ];
    }
    
    if (filters.fromDate) {
      query.createdAt = { $gte: new Date(filters.fromDate) };
    }
    if (filters.toDate) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.toDate) };
    }
    
    const sort = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }
    
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(query)
    ]);
    
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = MachineRepository;