const BaseRepository = require('../../../core/base/BaseRepository');
const Waste = require('../models/Waste.model');

/**
 * مستودع النفايات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالنفايات
 */
class WasteRepository extends BaseRepository {
  constructor() {
    super(Waste);
    this.model = Waste;
  }

  // ============ FIND METHODS ============

  async findByCode(code) {
    return this.model.findOne({ code: code.toUpperCase(), deletedAt: null });
  }

  async findByName(name, companyId) {
    return this.model.findOne({ name: name.trim(), companyId, deletedAt: null });
  }

  async findByPeriod(companyId, startDate, endDate) {
    return this.model.find({
      companyId,
      'period.startDate': { $gte: new Date(startDate) },
      'period.endDate': { $lte: new Date(endDate) },
      deletedAt: null
    });
  }

  async findByType(companyId, type, startDate, endDate) {
    return this.model.find({
      companyId,
      type,
      'period.startDate': { $gte: new Date(startDate) },
      'period.endDate': { $lte: new Date(endDate) },
      deletedAt: null
    });
  }

  async findByCategory(companyId, category, startDate, endDate) {
    return this.model.find({
      companyId,
      category,
      'period.startDate': { $gte: new Date(startDate) },
      'period.endDate': { $lte: new Date(endDate) },
      deletedAt: null
    });
  }

  async findByYear(companyId, year) {
    return this.model.find({
      companyId,
      'period.year': year,
      deletedAt: null
    });
  }

  async findByFactory(companyId, factoryId, startDate, endDate) {
    return this.model.find({
      companyId,
      factoryId,
      'period.startDate': { $gte: new Date(startDate) },
      'period.endDate': { $lte: new Date(endDate) },
      deletedAt: null
    });
  }

  // ============ STATISTICS METHODS ============

  async getCompanyTotalWaste(companyId, startDate, endDate) {
    return this.model.getCompanyTotalWaste(companyId, startDate, endDate);
  }

  async getWasteDistribution(companyId, startDate, endDate) {
    return this.model.getWasteDistribution(companyId, startDate, endDate);
  }

  async getWasteTrend(companyId, months = 12) {
    return this.model.getWasteTrend(companyId, months);
  }

  async getYearlyWaste(companyId, year) {
    const waste = await this.model.aggregate([
      {
        $match: {
          companyId,
          'period.year': year,
          deletedAt: null
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$generation.total' },
          collected: { $sum: '$generation.collected' },
          sorted: { $sum: '$generation.sorted' },
          landfill: { $sum: '$disposal.landfill' },
          recycling: { $sum: '$disposal.recycling' },
          composting: { $sum: '$disposal.composting' },
          energy_recovery: { $sum: '$disposal.energy_recovery' },
          revenue: { $sum: '$recycling.revenue' },
          cost: { $sum: '$cost.total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return waste[0] || { total: 0, collected: 0, sorted: 0, landfill: 0, recycling: 0, composting: 0, energy_recovery: 0, revenue: 0, cost: 0, count: 0 };
  }

  // ============ UPDATE METHODS ============

  async updateGeneration(id, generationData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        generation: generationData,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateDisposal(id, disposalData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        disposal: disposalData,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateRecycling(id, recyclingData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        recycling: recyclingData,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateTargets(id, targets) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        targets,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async addWasteToValueOpportunity(id, opportunity) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $push: { 'wasteToValue.opportunities': opportunity },
        $inc: { 'wasteToValue.pendingWaste': opportunity.quantity || 0 },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateOpportunityStatus(id, opportunityId, status) {
    const waste = await this.model.findById(id);
    if (!waste) return null;
    
    const opp = waste.wasteToValue.opportunities.find(o => o._id.toString() === opportunityId);
    if (opp) {
      if (opp.status === 'pending' && status === 'sold') {
        waste.wasteToValue.soldWaste += opp.quantity || 0;
        waste.wasteToValue.pendingWaste -= opp.quantity || 0;
        waste.wasteToValue.totalValue += (opp.pricePerUnit || 0) * (opp.quantity || 0);
      }
      opp.status = status;
    }
    return waste.save();
  }

  // ============ AGGREGATION ============

  async getTopWasteGeneratingFactories(companyId, startDate, endDate, limit = 10) {
    return this.model.aggregate([
      {
        $match: {
          companyId,
          'period.startDate': { $gte: new Date(startDate) },
          'period.endDate': { $lte: new Date(endDate) },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$factoryId',
          totalWaste: { $sum: '$generation.total' },
          recyclableWaste: { $sum: '$disposal.recycling' },
          revenue: { $sum: '$recycling.revenue' },
          cost: { $sum: '$cost.total' }
        }
      },
      { $sort: { totalWaste: -1 } },
      { $limit: limit }
    ]);
  }

  async getWasteToValueStats(companyId, startDate, endDate) {
    return this.model.aggregate([
      {
        $match: {
          companyId,
          'period.startDate': { $gte: new Date(startDate) },
          'period.endDate': { $lte: new Date(endDate) },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$wasteToValue.totalValue' },
          soldWaste: { $sum: '$wasteToValue.soldWaste' },
          pendingWaste: { $sum: '$wasteToValue.pendingWaste' },
          avgRevenue: { $avg: '$recycling.revenue' }
        }
      }
    ]);
  }

  // ============ EXPORT ============

  async exportWasteData(companyId, startDate, endDate, format = 'json') {
    const data = await this.model.find({
      companyId,
      'period.startDate': { $gte: new Date(startDate) },
      'period.endDate': { $lte: new Date(endDate) },
      deletedAt: null
    }).lean();
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = [
      'name', 'type', 'category', 'startDate', 'endDate',
      'totalGeneration', 'collected', 'sorted',
      'landfill', 'recycling', 'composting', 'energy_recovery',
      'recyclingRate', 'diversionRate',
      'revenue', 'cost', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'category': value = item.category || ''; break;
          case 'startDate': value = item.period?.startDate ? new Date(item.period.startDate).toISOString().split('T')[0] : ''; break;
          case 'endDate': value = item.period?.endDate ? new Date(item.period.endDate).toISOString().split('T')[0] : ''; break;
          case 'totalGeneration': value = item.generation?.total || 0; break;
          case 'collected': value = item.generation?.collected || 0; break;
          case 'sorted': value = item.generation?.sorted || 0; break;
          case 'landfill': value = item.disposal?.landfill || 0; break;
          case 'recycling': value = item.disposal?.recycling || 0; break;
          case 'composting': value = item.disposal?.composting || 0; break;
          case 'energy_recovery': value = item.disposal?.energy_recovery || 0; break;
          case 'recyclingRate': value = item.recyclingRate || 0; break;
          case 'diversionRate': value = item.diversionRate || 0; break;
          case 'revenue': value = item.recycling?.revenue || 0; break;
          case 'cost': value = item.cost?.total || 0; break;
          case 'createdAt': value = item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : ''; break;
          default: value = '';
        }
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = WasteRepository;