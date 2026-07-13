const BaseRepository = require('../../../core/base/BaseRepository');
const ProductionLine = require('../models/ProductionLine.model');

/**
 * مستودع خطوط الإنتاج - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بخطوط الإنتاج
 */
class ProductionLineRepository extends BaseRepository {
  constructor() {
    super(ProductionLine);
    this.model = ProductionLine;
  }

  // ============ FIND METHODS ============

  async findByCode(code, departmentId, companyId) {
    return this.model.findOne({
      code: code.toUpperCase(),
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async findByName(name, departmentId, companyId) {
    return this.model.findOne({
      name: name.trim(),
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async findByType(type, departmentId, companyId) {
    return this.model.find({
      type,
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async findByCategory(category, departmentId, companyId) {
    return this.model.find({
      category,
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async findActive(departmentId, companyId) {
    return this.model.find({
      status: 'active',
      departmentId,
      companyId,
      deletedAt: null
    });
  }

  async findHighPerformance(minOEE = 80, departmentId, companyId) {
    return this.model.find({
      'performance.oee': { $gte: minOEE },
      departmentId,
      companyId,
      deletedAt: null
    }).sort({ 'performance.oee': -1 });
  }

  async findByFactory(factoryId, companyId) {
    return this.model.find({
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async search(searchTerm, departmentId, companyId) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      departmentId,
      companyId,
      deletedAt: null,
      $or: [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { type: searchRegex }
      ]
    });
  }

  async getProductionLineStats(productionLineId) {
    return this.model.getProductionLineStats(productionLineId);
  }

  async getDepartmentProductionLineStats(departmentId) {
    return this.model.getDepartmentProductionLineStats(departmentId);
  }

  async getTypeDistribution(departmentId, companyId) {
    return this.model.getTypeDistribution(departmentId, companyId);
  }

  async getCategoryDistribution(departmentId, companyId) {
    return this.model.getCategoryDistribution(departmentId, companyId);
  }

  // ============ UPDATE METHODS ============

  async updatePerformance(productionLineId, performance) {
    const updateFields = {};
    for (const key of Object.keys(performance)) {
      updateFields[`performance.${key}`] = performance[key];
    }
    updateFields['performance.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateMachines(productionLineId, machines) {
    const updateFields = {};
    for (const key of Object.keys(machines)) {
      updateFields[`machines.${key}`] = machines[key];
    }
    updateFields['machines.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateSensors(productionLineId, sensors) {
    const updateFields = {};
    for (const key of Object.keys(sensors)) {
      updateFields[`sensors.${key}`] = sensors[key];
    }
    updateFields['sensors.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateQuality(productionLineId, quality) {
    const updateFields = {};
    for (const key of Object.keys(quality)) {
      updateFields[`quality.${key}`] = quality[key];
    }
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateGreenScore(productionLineId, score) {
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      {
        'environmental.greenScore': Math.min(100, Math.max(0, score)),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateCost(productionLineId, cost) {
    const updateFields = {};
    for (const key of Object.keys(cost)) {
      updateFields[`cost.${key}`] = cost[key];
    }
    updateFields['cost.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateStatus(productionLineId, status) {
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async startLine(productionLineId) {
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      {
        status: 'active',
        'operatingDetails.lastStartTime': new Date(),
        'operatingDetails.lastStopTime': null,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async stopLine(productionLineId) {
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      {
        status: 'stopped',
        'operatingDetails.lastStopTime': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async addMaintenanceRecord(productionLineId, record) {
    return this.model.findOneAndUpdate(
      { _id: productionLineId, deletedAt: null },
      {
        $push: { 'maintenance.maintenanceHistory': record },
        'maintenance.lastMaintenance': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  async bulkUpdateStatus(productionLineIds, status, departmentId, companyId) {
    return this.model.updateMany(
      { _id: { $in: productionLineIds }, departmentId, companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async findWithFilters(filters = {}, departmentId, companyId) {
    const query = { departmentId, companyId, deletedAt: null };
    
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
    if (filters.isRunning !== undefined) {
      if (filters.isRunning === 'true') {
        query.status = 'active';
        query['operatingDetails.lastStartTime'] = { $ne: null };
        query['operatingDetails.lastStopTime'] = null;
      } else {
        query.$or = [
          { status: { $ne: 'active' } },
          { 'operatingDetails.lastStopTime': { $ne: null } }
        ];
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

module.exports = ProductionLineRepository;