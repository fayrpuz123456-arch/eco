const BaseService = require('../../../core/base/BaseService');
const AlertRepository = require('../repositories/AlertRepository');
const {
  AppError,
  ValidationError,
  NotFoundError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class AlertService extends BaseService {
  constructor() {
    super(new AlertRepository(), 'Alert');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createAlert(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'type', 'severity', 'source.sourceType']);

      const alertData = {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId,
        triggeredAt: new Date()
      };

      const alert = await this.repository.create(alertData);

      // إرسال حدث التنبيه
      eventEmitter.emit(EventTypes.ALERT_TRIGGERED, {
        alertId: alert._id,
        name: alert.name,
        type: alert.type,
        severity: alert.severity,
        companyId,
        triggeredBy: userId
      });

      logger.info('Alert created successfully', {
        alertId: alert._id,
        name: alert.name,
        severity: alert.severity,
        companyId
      });

      return alert;
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getAlertById(id, companyId) {
    const alert = await this.repository.findById(id, companyId);
    if (!alert) {
      throw new NotFoundError('Alert not found');
    }
    return alert;
  }

  async getAlerts(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getAlertsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getActiveAlerts(companyId) {
    return this.repository.findActive(companyId);
  }

  async getAlertsBySeverity(companyId, severity) {
    return this.repository.findBySeverity(companyId, severity);
  }

  async getAlertsBySource(companyId, sourceType, sourceId) {
    return this.repository.findBySource(companyId, sourceType, sourceId);
  }

  async getCriticalAlerts(companyId, hours = 24) {
    return this.repository.getCriticalAlerts(companyId, hours);
  }

  async getAlertStats(companyId) {
    return this.repository.getAlertStats(companyId);
  }

  // ============ UPDATE ============

  async acknowledgeAlert(id, userId, companyId, note = '') {
    try {
      const alert = await this.repository.findById(id, companyId);
      if (!alert) {
        throw new NotFoundError('Alert not found');
      }

      const updatedAlert = await this.repository.acknowledge(id, userId, note);

      eventEmitter.emit('alert.acknowledged', {
        alertId: id,
        name: alert.name,
        acknowledgedBy: userId,
        companyId
      });

      logger.info('Alert acknowledged', {
        alertId: id,
        name: alert.name,
        acknowledgedBy: userId
      });

      return updatedAlert;
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  async resolveAlert(id, userId, companyId, note = '', action = '') {
    try {
      const alert = await this.repository.findById(id, companyId);
      if (!alert) {
        throw new NotFoundError('Alert not found');
      }

      const updatedAlert = await this.repository.resolve(id, userId, note, action);

      eventEmitter.emit('alert.resolved', {
        alertId: id,
        name: alert.name,
        resolvedBy: userId,
        companyId
      });

      logger.info('Alert resolved', {
        alertId: id,
        name: alert.name,
        resolvedBy: userId
      });

      return updatedAlert;
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  async reopenAlert(id, userId, companyId, note = '') {
    try {
      const alert = await this.repository.findById(id, companyId);
      if (!alert) {
        throw new NotFoundError('Alert not found');
      }

      const updatedAlert = await this.repository.reopen(id, userId, note);

      logger.info('Alert reopened', {
        alertId: id,
        name: alert.name,
        reopenedBy: userId
      });

      return updatedAlert;
    } catch (error) {
      logger.error('Error reopening alert:', error);
      throw error;
    }
  }

  // ============ BULK OPERATIONS ============

  async bulkAcknowledge(alertIds, userId, companyId) {
    try {
      const result = await this.repository.bulkAcknowledge(alertIds, userId);

      logger.info('Bulk alerts acknowledged', {
        count: result.modifiedCount,
        acknowledgedBy: userId
      });

      return result;
    } catch (error) {
      logger.error('Error bulk acknowledging alerts:', error);
      throw error;
    }
  }

  async bulkResolve(alertIds, userId, companyId) {
    try {
      const result = await this.repository.bulkResolve(alertIds, userId);

      logger.info('Bulk alerts resolved', {
        count: result.modifiedCount,
        resolvedBy: userId
      });

      return result;
    } catch (error) {
      logger.error('Error bulk resolving alerts:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  async getTypeDistribution(companyId) {
    return this.repository.getTypeDistribution(companyId);
  }

  async getAlertTrend(companyId, days = 30) {
    return this.repository.getAlertTrend(companyId, days);
  }

  // ============ DASHBOARD ============

  async getAlertDashboard(companyId) {
    const [stats, distribution, trend, critical] = await Promise.all([
      this.getAlertStats(companyId),
      this.getTypeDistribution(companyId),
      this.getAlertTrend(companyId, 30),
      this.getCriticalAlerts(companyId, 24)
    ]);

    return {
      stats,
      distribution,
      trend,
      critical: {
        count: critical.length,
        alerts: critical.slice(0, 10)
      },
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteAlert(id, userId, companyId, reason = null) {
    try {
      const alert = await this.repository.findById(id, companyId);
      if (!alert) {
        throw new NotFoundError('Alert not found');
      }

      await this.repository.softDelete(id, companyId);

      logger.info('Alert deleted successfully', {
        alertId: id,
        name: alert.name,
        companyId
      });

      return { message: 'Alert deleted successfully' };
    } catch (error) {
      logger.error('Error deleting alert:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportAlerts(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportAlerts(companyId, startDate, endDate, format);
  }
}

module.exports = AlertService;