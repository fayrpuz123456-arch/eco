const BaseRepository = require('../../../core/base/BaseRepository');
const Factory = require('../models/Factory.model');

/**
 * مستودع المصانع - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالمصانع
 */
class FactoryRepository extends BaseRepository {
  constructor() {
    super(Factory);
    this.model = Factory;
  }

  // ============ FIND METHODS ============

  async findByCode(code, companyId) {
    return this.model.findOne({ 
      code: code.toUpperCase(), 
      companyId,
      deletedAt: null 
    });
  }

  async findByName(name, companyId) {
    return this.model.findOne({ 
      name: name.trim(), 
      companyId,
      deletedAt: null 
    });
  }

  async findByIndustry(industry, companyId) {
    return this.model.find({ 
      industry, 
      companyId,
      deletedAt: null 
    });
  }

  async findByCountry(country, companyId) {
    return this.model.find({ 
      'address.country': country, 
      companyId,
      deletedAt: null 
    });
  }

  async findActive(companyId) {
    return this.model.find({ 
      status: 'active', 
      companyId,
      deletedAt: null 
    });
  }

  async findHighGreenScore(minScore = 70, companyId) {
    return this.model.find({
      'sustainability.greenScore': { $gte: minScore },
      companyId,
      deletedAt: null
    }).sort({ 'sustainability.greenScore': -1 });
  }

  async search(searchTerm, companyId) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      companyId,
      deletedAt: null,
      $or: [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { industry: searchRegex },
        { 'address.city': searchRegex },
        { 'address.country': searchRegex }
      ]
    });
  }

  async getFactoryStats(factoryId) {
    return this.model.getFactoryStats(factoryId);
  }

  // ============ UPDATE METHODS ============

  async updateStatistics(factoryId, statsData) {
    const updateFields = {};
    for (const key of Object.keys(statsData)) {
      updateFields[`statistics.${key}`] = statsData[key];
    }
    updateFields['statistics.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: factoryId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  async updateGreenScore(factoryId, score) {
    return this.model.findOneAndUpdate(
      { _id: factoryId, deletedAt: null },
      {
        'sustainability.greenScore': Math.min(100, Math.max(0, score)),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateStatus(factoryId, status) {
    return this.model.findOneAndUpdate(
      { _id: factoryId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  async bulkUpdateStatus(factoryIds, status, companyId) {
    return this.model.updateMany(
      { _id: { $in: factoryIds }, companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async getCompanyFactoryStats(companyId) {
    const stats = await this.model.aggregate([
      { $match: { companyId, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          avgGreenScore: { $avg: '$sustainability.greenScore' },
          totalCarbonFootprint: { $sum: '$sustainability.carbonFootprint' },
          totalEnergyConsumption: { $sum: '$sustainability.energyConsumption' },
          totalWaterConsumption: { $sum: '$sustainability.waterConsumption' },
          totalWasteProduction: { $sum: '$sustainability.wasteProduction' },
          totalEmployees: { $sum: '$statistics.totalEmployees' },
          totalMachines: { $sum: '$statistics.totalMachines' },
          totalSensors: { $sum: '$statistics.totalSensors' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      maintenance: 0,
      avgGreenScore: 0,
      totalCarbonFootprint: 0,
      totalEnergyConsumption: 0,
      totalWaterConsumption: 0,
      totalWasteProduction: 0,
      totalEmployees: 0,
      totalMachines: 0,
      totalSensors: 0
    };
  }

  async getIndustryDistribution(companyId) {
    return this.model.aggregate([
      { $match: { companyId, deletedAt: null } },
      {
        $group: {
          _id: '$industry',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async getCountryDistribution(companyId) {
    return this.model.aggregate([
      { $match: { companyId, deletedAt: null } },
      {
        $group: {
          _id: '$address.country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async findWithFilters(filters = {}, companyId) {
    const query = { companyId, deletedAt: null };
    
    if (filters.status) query.status = filters.status;
    if (filters.industry) query.industry = filters.industry;
    if (filters.country) query['address.country'] = filters.country;
    if (filters.city) query['address.city'] = filters.city;
    if (filters.type) query.type = filters.type;
    if (filters.size) query.size = filters.size;
    if (filters.minGreenScore) {
      query['sustainability.greenScore'] = { $gte: parseInt(filters.minGreenScore) };
    }
    if (filters.maxGreenScore) {
      if (!query['sustainability.greenScore']) query['sustainability.greenScore'] = {};
      query['sustainability.greenScore']['$lte'] = parseInt(filters.maxGreenScore);
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

module.exports = FactoryRepository;