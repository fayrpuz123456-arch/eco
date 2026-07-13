const BaseRepository = require('../../../core/base/BaseRepository');
const Notification = require('../models/Notification.model');

/**
 * مستودع الإشعارات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالإشعارات
 */
class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
    this.model = Notification;
  }

  // ============ FIND METHODS ============

  async findByUser(userId, options = {}) {
    return this.model.findByUser(userId, options);
  }

  async findUnread(userId) {
    return this.model.findUnread(userId);
  }

  async findByCompany(companyId, options = {}) {
    const { limit = 50, page = 1, status, type } = options;
    const query = { companyId, deletedAt: null };
    if (status) query.status = status;
    if (type) query.type = type;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.model.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
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

  async findByType(userId, type) {
    return this.model.find({
      userId,
      type,
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  async findScheduled() {
    const now = new Date();
    return this.model.find({
      scheduledAt: { $lte: now },
      isScheduled: true,
      status: 'pending',
      deletedAt: null
    });
  }

  // ============ STATISTICS METHODS ============

  async getStats(userId) {
    return this.model.getStats(userId);
  }

  async getCompanyStats(companyId) {
    const stats = await this.model.aggregate([
      { $match: { companyId, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'sent'] }, 1, 0]
            }
          },
          delivered: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          read: {
            $sum: {
              $cond: [{ $eq: ['$status', 'read'] }, 1, 0]
            }
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    return stats[0] || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  }

  // ============ UPDATE METHODS ============

  async markAsRead(id) {
    const notification = await this.model.findById(id);
    if (!notification) return null;
    await notification.markAsRead();
    return notification;
  }

  async markAsSeen(id) {
    const notification = await this.model.findById(id);
    if (!notification) return null;
    await notification.markAsSeen();
    return notification;
  }

  async updateDeliveryStatus(id, channel, status, error = null) {
    const notification = await this.model.findById(id);
    if (!notification) return null;
    await notification.updateDeliveryStatus(channel, status, error);
    return notification;
  }

  async markAllAsRead(userId) {
    return this.model.markAllAsRead(userId);
  }

  // ============ BULK OPERATIONS ============

  async bulkCreate(notifications) {
    return this.model.insertMany(notifications);
  }

  async bulkDelete(notificationIds, userId) {
    return this.model.updateMany(
      { _id: { $in: notificationIds }, userId },
      {
        deletedAt: new Date(),
        status: 'cancelled',
        updatedAt: new Date()
      }
    );
  }

  // ============ EXPORT ============

  async exportNotifications(userId, startDate, endDate, format = 'json') {
    const data = await this.model.find({
      userId,
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
      'title', 'type', 'category', 'priority', 'status',
      'createdAt', 'readAt', 'channels'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        let value = '';
        switch (header) {
          case 'title': value = item.title || ''; break;
          case 'type': value = item.type || ''; break;
          case 'category': value = item.category || ''; break;
          case 'priority': value = item.priority || ''; break;
          case 'status': value = item.status || ''; break;
          case 'createdAt': value = item.createdAt ? new Date(item.createdAt).toISOString() : ''; break;
          case 'readAt': value = item.readAt ? new Date(item.readAt).toISOString() : ''; break;
          case 'channels': 
            const channels = [];
            if (item.channels?.email) channels.push('email');
            if (item.channels?.push) channels.push('push');
            if (item.channels?.sms) channels.push('sms');
            if (item.channels?.inApp) channels.push('inApp');
            value = channels.join('|');
            break;
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

module.exports = NotificationRepository;