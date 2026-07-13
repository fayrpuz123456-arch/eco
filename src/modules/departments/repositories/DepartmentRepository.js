const BaseRepository = require('../../../core/base/BaseRepository');
const Department = require('../models/Department.model');

/**
 * مستودع الأقسام - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالأقسام
 */
class DepartmentRepository extends BaseRepository {
  constructor() {
    super(Department);
    this.model = Department;
  }

  // ============ FIND METHODS ============

  async findByCode(code, factoryId, companyId) {
    return this.model.findOne({
      code: code.toUpperCase(),
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async findByName(name, factoryId, companyId) {
    return this.model.findOne({
      name: name.trim(),
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async findByType(type, factoryId, companyId) {
    return this.model.find({
      type,
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async findActive(factoryId, companyId) {
    return this.model.find({
      status: 'active',
      factoryId,
      companyId,
      deletedAt: null
    });
  }

  async findHighGreenScore(minScore = 70, factoryId, companyId) {
    return this.model.find({
      'environmental.greenScore': { $gte: minScore },
      factoryId,
      companyId,
      deletedAt: null
    }).sort({ 'environmental.greenScore': -1 });
  }

  async search(searchTerm, factoryId, companyId) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      factoryId,
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

  async getDepartmentStats(departmentId) {
    return this.model.getDepartmentStats(departmentId);
  }

  async getFactoryDepartmentStats(factoryId) {
    return this.model.getFactoryDepartmentStats(factoryId);
  }

  async getTypeDistribution(factoryId, companyId) {
    return this.model.getTypeDistribution(factoryId, companyId);
  }

  // ============ UPDATE METHODS ============

  async updateEmployees(departmentId, stats) {
    const updateFields = {};
    for (const key of Object.keys(stats)) {
      updateFields[`employees.${key}`] = stats[key];
    }
    updateFields['employees.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateAssets(departmentId, assets) {
    const updateFields = {};
    for (const key of Object.keys(assets)) {
      updateFields[`assets.${key}`] = assets[key];
    }
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateGreenScore(departmentId, score) {
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      {
        'environmental.greenScore': Math.min(100, Math.max(0, score)),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateBudget(departmentId, budget) {
    const updateFields = {};
    for (const key of Object.keys(budget)) {
      updateFields[`budget.${key}`] = budget[key];
    }
    updateFields['budget.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateKPIs(departmentId, kpis) {
    const updateFields = {};
    for (const key of Object.keys(kpis)) {
      updateFields[`kpis.${key}`] = Math.min(100, Math.max(0, kpis[key]));
    }
    updateFields['kpis.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateStatus(departmentId, status) {
    return this.model.findOneAndUpdate(
      { _id: departmentId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  async bulkUpdateStatus(departmentIds, status, factoryId, companyId) {
    return this.model.updateMany(
      { _id: { $in: departmentIds }, factoryId, companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async findWithFilters(filters = {}, factoryId, companyId) {
    const query = { factoryId, companyId, deletedAt: null };
    
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.minGreenScore) {
      query['environmental.greenScore'] = { $gte: parseInt(filters.minGreenScore) };
    }
    if (filters.maxGreenScore) {
      if (!query['environmental.greenScore']) query['environmental.greenScore'] = {};
      query['environmental.greenScore']['$lte'] = parseInt(filters.maxGreenScore);
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

module.exports = DepartmentRepository;