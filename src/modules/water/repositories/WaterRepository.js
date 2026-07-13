const BaseRepository = require('../../../core/base/BaseRepository');
const Water = require('../models/Water.model');

/**
 * مستودع المياه - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالمياه
 */
class WaterRepository extends BaseRepository {
  constructor() {
    super(Water);
    this.model = Water;
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
          intake: { $sum: '$consumption.intake' },
          reused: { $sum: '$consumption.reused' },
          recycled: { $sum: '$consumption.recycled' },
          discharged: { $sum: '$consumption.discharged' },
          wasted: { $sum: '$consumption.wasted' },
          cost: { $sum: '$cost.total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return consumption[0] || { total: 0, intake: 0, reused: 0, recycled: 0, discharged: 0, wasted: 0, cost: 0, count: 0 };
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

  async getLeakStats(companyId, startDate, endDate) {
    return this.model.getLeakStats(companyId, startDate, endDate);
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

  async updateQuality(id, qualityData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        quality: qualityData,
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

  async addLeak(id, leak) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $push: { 'leaks.locations': leak },
        $inc: {
          'leaks.total': 1,
          'leaks.detected': 1,
          'leaks.pending': 1,
          'leaks.estimatedLoss': leak.estimatedLoss || 0
        },
        'leaks.lastDetection': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async repairLeak(id, leakId) {
    const water = await this.model.findById(id);
    if (!water) return null;
    
    const leak = water.leaks.locations.find(l => l._id.toString() === leakId);
    if (leak) {
      leak.status = 'repaired';
      leak.repairedAt = new Date();
      water.leaks.repaired += 1;
      water.leaks.pending -= 1;
      return water.save();
    }
    return water;
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
          intake: { $sum: '$consumption.intake' },
          reused: { $sum: '$consumption.reused' },
          recycled: { $sum: '$consumption.recycled' },
          wasted: { $sum: '$consumption.wasted' }
        }
      },
      { $sort: { totalConsumption: -1 } },
      { $limit: limit }
    ]);
  }

  async getQualityStats(companyId, startDate, endDate) {
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
          avgQualityScore: { $avg: '$quality.qualityScore' },
          minQualityScore: { $min: '$quality.qualityScore' },
          maxQualityScore: { $max: '$quality.qualityScore' },
          avgPh: { $avg: '$quality.ph' },
          avgTurbidity: { $avg: '$quality.turbidity' },
          avgTds: { $avg: '$quality.tds' }
        }
      }
    ]);
  }

  // ============ EXPORT ============

  async exportWaterData(companyId, startDate, endDate, format = 'json') {
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
      'name', 'type', 'source', 'usage', 'startDate', 'endDate',
      'totalConsumption', 'intake', 'reused', 'recycled', 'discharged', 'wasted',
      'totalCost', 'efficiency', 'qualityScore',
      'totalLeaks', 'estimatedLoss', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'source': value = item.source || ''; break;
          case 'usage': value = item.usage || ''; break;
          case 'startDate': value = item.period?.startDate ? new Date(item.period.startDate).toISOString().split('T')[0] : ''; break;
          case 'endDate': value = item.period?.endDate ? new Date(item.period.endDate).toISOString().split('T')[0] : ''; break;
          case 'totalConsumption': value = item.consumption?.total || 0; break;
          case 'intake': value = item.consumption?.intake || 0; break;
          case 'reused': value = item.consumption?.reused || 0; break;
          case 'recycled': value = item.consumption?.recycled || 0; break;
          case 'discharged': value = item.consumption?.discharged || 0; break;
          case 'wasted': value = item.consumption?.wasted || 0; break;
          case 'totalCost': value = item.cost?.total || 0; break;
          case 'efficiency': value = item.efficiency?.overall || 0; break;
          case 'qualityScore': value = item.quality?.qualityScore || 0; break;
          case 'totalLeaks': value = item.leaks?.total || 0; break;
          case 'estimatedLoss': value = item.leaks?.estimatedLoss || 0; break;
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

module.exports = WaterRepository;