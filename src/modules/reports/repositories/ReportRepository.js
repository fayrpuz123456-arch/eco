const BaseRepository = require('../../../core/base/BaseRepository');
const Report = require('../models/Report.model');

/**
 * مستودع التقارير - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالتقارير
 */
class ReportRepository extends BaseRepository {
  constructor() {
    super(Report);
    this.model = Report;
  }

  // ============ FIND METHODS ============

  async findByCode(code) {
    return this.model.findOne({ code: code.toUpperCase(), deletedAt: null });
  }

  async findByName(name, companyId) {
    return this.model.findOne({ name: name.trim(), companyId, deletedAt: null });
  }

  async findByType(companyId, type) {
    return this.model.findByType(companyId, type);
  }

  async findByPeriod(companyId, startDate, endDate) {
    return this.model.findByPeriod(companyId, startDate, endDate);
  }

  async findByStatus(companyId, status) {
    return this.model.find({
      companyId,
      status,
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  async findByFactory(companyId, factoryId) {
    return this.model.find({
      companyId,
      factoryId,
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  async findScheduled() {
    return this.model.findScheduled();
  }

  // ============ STATISTICS METHODS ============

  async getStats(companyId) {
    return this.model.getStats(companyId);
  }

  async getTypeDistribution(companyId) {
    return this.model.aggregate([
      { $match: { companyId, deletedAt: null } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  // ============ UPDATE METHODS ============

  async startGeneration(id) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.startGeneration();
    return report;
  }

  async completeGeneration(id, fileData) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.complete(fileData);
    return report;
  }

  async failGeneration(id, error) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.fail(error);
    return report;
  }

  async addComment(id, userId, userName, content) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.addComment(userId, userName, content);
    return report;
  }

  async shareReport(id, userIds) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.share(userIds);
    return report;
  }

  async unshareReport(id, userIds) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.unshare(userIds);
    return report;
  }

  async updateSchedule(id, scheduleData) {
    const report = await this.model.findById(id);
    if (!report) return null;
    await report.updateSchedule(scheduleData);
    return report;
  }

  // ============ AGGREGATION ============

  async getReportTrend(companyId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.model.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: startDate },
          status: 'completed',
          deletedAt: null
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);
  }

  // ============ EXPORT ============

  async exportReports(companyId, startDate, endDate, format = 'json') {
    const data = await this.model.find({
      companyId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
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
      'name', 'type', 'format', 'status',
      'periodStart', 'periodEnd',
      'createdAt', 'completedAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'format': value = item.format || ''; break;
          case 'status': value = item.status || ''; break;
          case 'periodStart': value = item.period?.startDate ? new Date(item.period.startDate).toISOString().split('T')[0] : ''; break;
          case 'periodEnd': value = item.period?.endDate ? new Date(item.period.endDate).toISOString().split('T')[0] : ''; break;
          case 'createdAt': value = item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : ''; break;
          case 'completedAt': value = item.file?.generatedAt ? new Date(item.file.generatedAt).toISOString().split('T')[0] : ''; break;
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

module.exports = ReportRepository;