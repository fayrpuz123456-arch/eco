const BaseRepository = require('../../../core/base/BaseRepository');
const Sensor = require('../models/Sensor.model');

/**
 * مستودع الحساسات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالحساسات
 */
class SensorRepository extends BaseRepository {
  constructor() {
    super(Sensor);
    this.model = Sensor;
  }

  // ============ FIND METHODS ============

  async findByCode(code, machineId, companyId) {
    return this.model.findOne({
      code: code.toUpperCase(),
      machineId,
      companyId,
      deletedAt: null
    });
  }

  async findByName(name, machineId, companyId) {
    return this.model.findOne({
      name: name.trim(),
      machineId,
      companyId,
      deletedAt: null
    });
  }

  async findByType(type, machineId, companyId) {
    return this.model.find({
      type,
      machineId,
      companyId,
      deletedAt: null
    });
  }

  async findByCategory(category, machineId, companyId) {
    return this.model.find({
      category,
      machineId,
      companyId,
      deletedAt: null
    });
  }

  async findActive(machineId, companyId) {
    return this.model.find({
      status: 'active',
      machineId,
      companyId,
      deletedAt: null
    });
  }

  async findDueForCalibration(days = 7, machineId, companyId) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    
    return this.model.find({
      'calibration.nextCalibration': { $lte: dueDate },
      machineId,
      companyId,
      deletedAt: null
    }).sort({ 'calibration.nextCalibration': 1 });
  }

  async findLowBattery(threshold = 20, machineId, companyId) {
    return this.model.find({
      'energy.batteryLevel': { $lte: threshold },
      machineId,
      companyId,
      deletedAt: null
    }).sort({ 'energy.batteryLevel': 1 });
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

  async findByProductionLine(productionLineId, companyId) {
    return this.model.find({
      productionLineId,
      companyId,
      deletedAt: null
    });
  }

  async search(searchTerm, machineId, companyId) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      machineId,
      companyId,
      deletedAt: null,
      $or: [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { type: searchRegex },
        { 'manufacturer.name': searchRegex },
        { 'manufacturer.model': searchRegex }
      ]
    });
  }

  async getSensorStats(sensorId) {
    return this.model.getSensorStats(sensorId);
  }

  async getMachineSensorStats(machineId) {
    return this.model.getMachineSensorStats(machineId);
  }

  async getTypeDistribution(machineId, companyId) {
    return this.model.getTypeDistribution(machineId, companyId);
  }

  async getCategoryDistribution(machineId, companyId) {
    return this.model.getCategoryDistribution(machineId, companyId);
  }

  // ============ UPDATE METHODS ============

  async updateLastReading(sensorId, value, timestamp, quality = 'good') {
    const sensor = await this.model.findById(sensorId);
    if (!sensor) return null;
    
    await sensor.updateLastReading(value, timestamp, quality);
    await sensor.updateStatistics();
    return sensor;
  }

  async updateStatus(sensorId, status) {
    return this.model.findOneAndUpdate(
      { _id: sensorId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateCalibration(sensorId, offset, multiplier, performedBy, notes = '') {
    const sensor = await this.model.findById(sensorId);
    if (!sensor) return null;
    
    await sensor.updateCalibration(offset, multiplier, performedBy, notes);
    return sensor;
  }

  async addMaintenanceRecord(sensorId, record) {
    const sensor = await this.model.findById(sensorId);
    if (!sensor) return null;
    
    await sensor.addMaintenanceRecord(record);
    return sensor;
  }

  async updateBatteryLevel(sensorId, batteryLevel) {
    return this.model.findOneAndUpdate(
      { _id: sensorId, deletedAt: null },
      {
        'energy.batteryLevel': Math.min(100, Math.max(0, batteryLevel)),
        'energy.lastBatteryCheck': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  async bulkUpdateStatus(sensorIds, status, machineId, companyId) {
    return this.model.updateMany(
      { _id: { $in: sensorIds }, machineId, companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async findWithFilters(filters = {}, machineId, companyId) {
    const query = { machineId, companyId, deletedAt: null };
    
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.lowBattery !== undefined) {
      const threshold = parseInt(filters.lowBattery) || 20;
      query['energy.batteryLevel'] = { $lte: threshold };
    }
    if (filters.dueForCalibration !== undefined) {
      const days = parseInt(filters.dueForCalibration) || 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      query['calibration.nextCalibration'] = { $lte: dueDate };
    }
    if (filters.hasReadings !== undefined) {
      if (filters.hasReadings === 'true') {
        query['readings.readingCount'] = { $gt: 0 };
      } else {
        query['readings.readingCount'] = { $eq: 0 };
      }
    }
    if (filters.tag) query.tags = filters.tag;
    
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { name: searchRegex },
        { code: searchRegex },
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

module.exports = SensorRepository;