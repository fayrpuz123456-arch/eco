const BaseRepository = require('../../../core/base/BaseRepository');
const Alert = require('../models/Alert.model');

/**
 * مستودع التنبيهات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالتنبيهات
 */
class AlertRepository extends BaseRepository {
  constructor() {
    super(Alert);
    this.model = Alert;
  }

  // ============ FIND METHODS ============

  async findActive(companyId) {
    return this.model.findActive(companyId);
  }

  async findBySeverity(companyId, severity) {
    return this.model.findBySeverity(companyId, severity);
  }

  async findBySource(companyId, sourceType, sourceId) {
    return this.model.findBySource(companyId, sourceType, sourceId);
  }

  async findByStatus(companyId, status) {
    return this.model.find({
      companyId,
      status,
      deletedAt: null
    }).sort({ severity: -1, createdAt: -1 });
  }

  async findByType(companyId, type) {
    return this.model.find({
      companyId,
      type,
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  async findUnresolved(companyId) {
    return this.model.find({
      companyId,
      status: { $in: ['active', 'acknowledged'] },
      deletedAt: null
    }).sort({ severity: -1, createdAt: -1 });
  }

  async findResolved(companyId, limit = 100) {
    return this.model.find({
      companyId,
      status: 'resolved',
      deletedAt: null
    }).sort({ createdAt: -1 }).limit(limit);
  }

  // ============ STATISTICS METHODS ============

  async getAlertStats(companyId) {
    return this.model.getAlertStats(companyId);
  }

  async getTypeDistribution(companyId) {
    return this.model.getTypeDistribution(companyId);
  }

  async getAlertTrend(companyId, days = 30) {
    return this.model.getAlertTrend(companyId, days);
  }

  // ============ UPDATE METHODS ============

  async acknowledge(id, userId, note = '') {
    const alert = await this.model.findById(id);
    if (!alert) return null;
    await alert.acknowledge(userId, note);
    return alert;
  }

  async resolve(id, userId, note = '', action = '') {
    const alert = await this.model.findById(id);
    if (!alert) return null;
    await alert.resolve(userId, note, action);
    return alert;
  }

  async reopen(id, userId, note = '') {
    const alert = await this.model.findById(id);
    if (!alert) return null;
    await alert.reopen(userId, note);
    return alert;
  }

  async addAction(id, action) {
    const alert = await this.model.findById(id);
    if (!alert) return null;
    await alert.addAction(action);
    return alert;
  }

  async updateActionStatus(id, actionIndex, status, error = null) {
    const alert = await this.model.findById(id);
    if (!alert) return null;
    await alert.updateActionStatus(actionIndex, status, error);
    return alert;
  }

  // ============ BULK OPERATIONS ============

  async bulkAcknowledge(alertIds, userId) {
    return this.model.updateMany(
      { _id: { $in: alertIds }, deletedAt: null },
      {
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  async bulkResolve(alertIds, userId) {
    return this.model.updateMany(
      { _id: { $in: alertIds }, deletedAt: null },
      {
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION ============

  async getCriticalAlerts(companyId, hours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    
    return this.model.find({
      companyId,
      severity: { $in: ['critical', 'emergency'] },
      status: { $in: ['active', 'acknowledged'] },
      triggeredAt: { $gte: cutoff },
      deletedAt: null
    }).sort({ severity: -1, triggeredAt: -1 });
  }

  async getAlertsByDateRange(companyId, startDate, endDate) {
    return this.model.find({
      companyId,
      triggeredAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      deletedAt: null
    }).sort({ triggeredAt: -1 });
  }

  // ============ EXPORT ============

  async exportAlerts(companyId, startDate, endDate, format = 'json') {
    const data = await this.model.find({
      companyId,
      triggeredAt: {
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
      'name', 'type', 'severity', 'status', 'sourceType',
      'triggeredAt', 'triggeredValue',
      'acknowledgedBy', 'acknowledgedAt',
      'resolvedBy', 'resolvedAt',
      'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'severity': value = item.severity || ''; break;
          case 'status': value = item.status || ''; break;
          case 'sourceType': value = item.source?.sourceType || ''; break;
          case 'triggeredAt': value = item.triggeredAt ? new Date(item.triggeredAt).toISOString() : ''; break;
          case 'triggeredValue': value = item.triggeredValue || 0; break;
          case 'acknowledgedBy': value = item.acknowledgedBy || ''; break;
          case 'acknowledgedAt': value = item.acknowledgedAt ? new Date(item.acknowledgedAt).toISOString() : ''; break;
          case 'resolvedBy': value = item.resolvedBy || ''; break;
          case 'resolvedAt': value = item.resolvedAt ? new Date(item.resolvedAt).toISOString() : ''; break;
          case 'createdAt': value = item.createdAt ? new Date(item.createdAt).toISOString() : ''; break;
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

module.exports = AlertRepository;