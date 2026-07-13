const BaseRepository = require('../../../core/base/BaseRepository');
const Carbon = require('../models/Carbon.model');

/**
 * مستودع الكربون - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالكربون
 */
class CarbonRepository extends BaseRepository {
  constructor() {
    super(Carbon);
    this.model = Carbon;
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

  async getCompanyTotalEmissions(companyId, startDate, endDate) {
    return this.model.getCompanyTotalEmissions(companyId, startDate, endDate);
  }

  async getEmissionsDistribution(companyId, startDate, endDate) {
    return this.model.getEmissionsDistribution(companyId, startDate, endDate);
  }

  async getEmissionsTrend(companyId, months = 12) {
    return this.model.getEmissionsTrend(companyId, months);
  }

  async getYearlyEmissions(companyId, year) {
    const emissions = await this.model.aggregate([
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
          total: { $sum: '$emissions.totalEmissions' },
          scope1: { $sum: '$emissions.scope1.total' },
          scope2: { $sum: '$emissions.scope2.total' },
          scope3: { $sum: '$emissions.scope3.total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return emissions[0] || { total: 0, scope1: 0, scope2: 0, scope3: 0, count: 0 };
  }

  async getMonthlyEmissions(companyId, year, month) {
    const emissions = await this.model.aggregate([
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
          total: { $sum: '$emissions.totalEmissions' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return emissions[0] || { total: 0, count: 0 };
  }

  // ============ UPDATE METHODS ============

  async updateEmissions(id, emissionsData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        emissions: emissionsData,
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

  async updateVerification(id, verificationData) {
    return this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        verification: verificationData,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ AGGREGATION ============

  async getTopEmittingFactories(companyId, startDate, endDate, limit = 10) {
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
          totalEmissions: { $sum: '$emissions.totalEmissions' },
          scope1Total: { $sum: '$emissions.scope1.total' },
          scope2Total: { $sum: '$emissions.scope2.total' },
          scope3Total: { $sum: '$emissions.scope3.total' }
        }
      },
      { $sort: { totalEmissions: -1 } },
      { $limit: limit }
    ]);
  }

  async getReductionActions(companyId) {
    return this.model.aggregate([
      {
        $match: {
          companyId,
          'reductionActions.0': { $exists: true },
          deletedAt: null
        }
      },
      { $unwind: '$reductionActions' },
      {
        $group: {
          _id: '$reductionActions.status',
          count: { $sum: 1 },
          totalReduction: { $sum: '$reductionActions.estimatedReduction' }
        }
      }
    ]);
  }

  async getCompaniesWithBestPerformance(companyId, startDate, endDate) {
    const stats = await this.model.aggregate([
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
          _id: '$companyId',
          totalEmissions: { $sum: '$emissions.totalEmissions' },
          avgIntensity: { $avg: '$intensity.perUnit' },
          reductionProgress: { $avg: '$reductionProgress' }
        }
      }
    ]);
    
    return stats[0] || { totalEmissions: 0, avgIntensity: 0, reductionProgress: 0 };
  }

  // ============ EXPORT ============

  async exportCarbonData(companyId, startDate, endDate, format = 'json') {
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
      'name', 'type', 'startDate', 'endDate',
      'scope1Total', 'scope2Total', 'scope3Total', 'totalEmissions',
      'intensityPerUnit', 'reductionTarget', 'progress',
      'verified', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'startDate': value = item.period?.startDate ? new Date(item.period.startDate).toISOString().split('T')[0] : ''; break;
          case 'endDate': value = item.period?.endDate ? new Date(item.period.endDate).toISOString().split('T')[0] : ''; break;
          case 'scope1Total': value = item.emissions?.scope1?.total || 0; break;
          case 'scope2Total': value = item.emissions?.scope2?.total || 0; break;
          case 'scope3Total': value = item.emissions?.scope3?.total || 0; break;
          case 'totalEmissions': value = item.emissions?.totalEmissions || 0; break;
          case 'intensityPerUnit': value = item.intensity?.perUnit || 0; break;
          case 'reductionTarget': value = item.targets?.reductionTarget || 0; break;
          case 'progress': value = item.reductionProgress || 0; break;
          case 'verified': value = item.verification?.verified ? 'true' : 'false'; break;
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

module.exports = CarbonRepository;