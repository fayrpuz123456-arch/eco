const BaseRepository = require('../../../core/base/BaseRepository');
const Energy = require('../models/Energy.model');

/**
 * مستودع الطاقة - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالطاقة
 */
class EnergyRepository extends BaseRepository {
  constructor() {
    super(Energy);
    this.model = Energy;
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

  async getCompanyTotalConsumption(companyId, startDate, endDate) {
    return this.model.getCompanyTotalConsumption(companyId, startDate, endDate);
  }

  async getConsumptionDistribution(companyId, startDate, endDate) {
    return this.model.getConsumptionDistribution(companyId, startDate, endDate);
  }

  async getConsumptionTrend(companyId, months = 12) {
    return this.model.getConsumptionTrend(companyId, months);
  }

  async getYearlyConsumption(companyId, year) {
    const consumption = await this.model.aggregate([
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
          total: { $sum: '$consumption.total' },
          electricity: { $sum: '$consumption.electricity.total' },
          fuel: { $sum: '$consumption.fuel.total' },
          gas: { $sum: '$consumption.gas.total' },
          renewable: { $sum: '$consumption.renewable.total' },
          cost: { $sum: '$cost.total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return consumption[0] || { total: 0, electricity: 0, fuel: 0, gas: 0, renewable: 0, cost: 0, count: 0 };
  }

  async getMonthlyConsumption(companyId, year, month) {
    const consumption = await this.model.aggregate([
      {
        $match: {
          companyId,
          'period.year': year,
          'period.month': month,
          deletedAt: null
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$consumption.total' },
          cost: { $sum: '$cost.total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return consumption[0] || { total: 0, cost: 0, count: 0 };
  }

  // ============ UPDATE METHODS ============

  async updateConsumption(id, consumptionData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        consumption: consumptionData,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateCost(id, costData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        cost: costData,
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

  async updateEfficiency(id, efficiency) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        efficiency,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ AGGREGATION ============

  async getTopConsumingFactories(companyId, startDate, endDate, limit = 10) {
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
          totalConsumption: { $sum: '$consumption.total' },
          totalCost: { $sum: '$cost.total' },
          electricity: { $sum: '$consumption.electricity.total' },
          fuel: { $sum: '$consumption.fuel.total' },
          gas: { $sum: '$consumption.gas.total' },
          renewable: { $sum: '$consumption.renewable.total' }
        }
      },
      { $sort: { totalConsumption: -1 } },
      { $limit: limit }
    ]);
  }

  async getEfficiencyStats(companyId, startDate, endDate) {
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
          avgEfficiency: { $avg: '$efficiency.overall' },
          maxEfficiency: { $max: '$efficiency.overall' },
          minEfficiency: { $min: '$efficiency.overall' },
          avgRenewable: { $avg: '$kpis.renewablePercentage' },
          totalCost: { $sum: '$cost.total' },
          avgCost: { $avg: '$cost.total' }
        }
      }
    ]);
  }

  async getRecommendations(companyId) {
    return this.model.aggregate([
      {
        $match: {
          companyId,
          'recommendations.0': { $exists: true },
          deletedAt: null
        }
      },
      { $unwind: '$recommendations' },
      {
        $group: {
          _id: '$recommendations.priority',
          count: { $sum: 1 },
          totalSavings: { $sum: '$recommendations.potentialSavings' },
          totalCostSaving: { $sum: '$recommendations.potentialCostSaving' }
        }
      }
    ]);
  }

  // ============ EXPORT ============

  async exportEnergyData(companyId, startDate, endDate, format = 'json') {
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
      'name', 'type', 'source', 'startDate', 'endDate',
      'totalConsumption', 'electricity', 'fuel', 'gas', 'renewable',
      'totalCost', 'efficiency', 'renewablePercentage',
      'energyIntensity', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'source': value = item.source || ''; break;
          case 'startDate': value = item.period?.startDate ? new Date(item.period.startDate).toISOString().split('T')[0] : ''; break;
          case 'endDate': value = item.period?.endDate ? new Date(item.period.endDate).toISOString().split('T')[0] : ''; break;
          case 'totalConsumption': value = item.consumption?.total || 0; break;
          case 'electricity': value = item.consumption?.electricity?.total || 0; break;
          case 'fuel': value = item.consumption?.fuel?.total || 0; break;
          case 'gas': value = item.consumption?.gas?.total || 0; break;
          case 'renewable': value = item.consumption?.renewable?.total || 0; break;
          case 'totalCost': value = item.cost?.total || 0; break;
          case 'efficiency': value = item.efficiency?.overall || 0; break;
          case 'renewablePercentage': value = item.kpis?.renewablePercentage || 0; break;
          case 'energyIntensity': value = item.kpis?.energyIntensity || 0; break;
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

module.exports = EnergyRepository;