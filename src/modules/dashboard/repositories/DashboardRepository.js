const BaseRepository = require('../../../core/base/BaseRepository');
const Dashboard = require('../models/Dashboard.model');

/**
 * مستودع لوحات التحكم - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بلوحات التحكم
 */
class DashboardRepository extends BaseRepository {
  constructor() {
    super(Dashboard);
    this.model = Dashboard;
  }

  // ============ FIND METHODS ============

  async findByUser(userId, companyId) {
    return this.model.findByUser(userId, companyId);
  }

  async findDefault(userId, companyId) {
    return this.model.findDefault(userId, companyId);
  }

  async findByType(userId, companyId, type) {
    return this.model.findByType(userId, companyId, type);
  }

  async findPinned(userId, companyId) {
    return this.model.findPinned(userId, companyId);
  }

  async findByName(userId, companyId, name) {
    return this.model.findOne({
      userId,
      companyId,
      name: name.trim(),
      deletedAt: null
    });
  }

  // ============ UPDATE METHODS ============

  async addWidget(id, widget) {
    const dashboard = await this.model.findById(id);
    if (!dashboard) return null;
    await dashboard.addWidget(widget);
    return dashboard;
  }

  async removeWidget(id, widgetId) {
    const dashboard = await this.model.findById(id);
    if (!dashboard) return null;
    await dashboard.removeWidget(widgetId);
    return dashboard;
  }

  async updateWidget(id, widgetId, data) {
    const dashboard = await this.model.findById(id);
    if (!dashboard) return null;
    await dashboard.updateWidget(widgetId, data);
    return dashboard;
  }

  async reorderWidgets(id, widgetIds) {
    const dashboard = await this.model.findById(id);
    if (!dashboard) return null;
    await dashboard.reorderWidgets(widgetIds);
    return dashboard;
  }

  async updateCache(id, metrics) {
    const dashboard = await this.model.findById(id);
    if (!dashboard) return null;
    await dashboard.updateCache(metrics);
    return dashboard;
  }

  async setDefault(id, userId, companyId) {
    // إزالة الافتراضي من جميع لوحات المستخدم
    await this.model.updateMany(
      {
        userId,
        companyId,
        'settings.isDefault': true,
        deletedAt: null
      },
      {
        'settings.isDefault': false,
        updatedAt: new Date()
      }
    );
    
    // تعيين الافتراضي للوحة الحالية
    return this.model.findOneAndUpdate(
      { _id: id, userId, companyId, deletedAt: null },
      {
        'settings.isDefault': true,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ STATISTICS ============

  async getStats(userId, companyId) {
    const stats = await this.model.aggregate([
      { $match: { userId, companyId, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pinned: { $sum: { $cond: ['$settings.pinned', 1, 0] } },
          default: { $sum: { $cond: ['$settings.isDefault', 1, 0] } },
          byType: { $push: '$type' }
        }
      }
    ]);
    
    return stats[0] || { total: 0, pinned: 0, default: 0, byType: [] };
  }

  // ============ EXPORT ============

  async exportDashboards(userId, companyId, format = 'json') {
    const data = await this.model.find({
      userId,
      companyId,
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
      'name', 'type', 'layout', 'widgetCount',
      'isDefault', 'isPinned', 'createdAt'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'name': value = item.name || ''; break;
          case 'type': value = item.type || ''; break;
          case 'layout': value = item.layout || ''; break;
          case 'widgetCount': value = item.widgetCount || 0; break;
          case 'isDefault': value = item.settings?.isDefault ? 'true' : 'false'; break;
          case 'isPinned': value = item.settings?.pinned ? 'true' : 'false'; break;
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

module.exports = DashboardRepository;