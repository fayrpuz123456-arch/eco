const BaseService = require('../../../core/base/BaseService');
const DashboardRepository = require('../repositories/DashboardRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class DashboardService extends BaseService {
  constructor() {
    super(new DashboardRepository(), 'Dashboard');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createDashboard(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'type']);

      // التحقق من عدم وجود لوحة بنفس الاسم
      const existing = await this.repository.findByName(userId, companyId, data.name);
      if (existing) {
        throw new ConflictError('Dashboard with this name already exists');
      }

      const dashboardData = {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId,
        userId
      };

      // إذا كانت أول لوحة للمستخدم، اجعلها افتراضية
      const userDashboards = await this.repository.findByUser(userId, companyId);
      if (userDashboards.length === 0) {
        dashboardData.settings = { ...dashboardData.settings, isDefault: true };
      }

      const dashboard = await this.repository.create(dashboardData);

      eventEmitter.emit('dashboard.created', {
        dashboardId: dashboard._id,
        name: dashboard.name,
        userId,
        companyId
      });

      logger.info('Dashboard created successfully', {
        dashboardId: dashboard._id,
        name: dashboard.name,
        userId
      });

      return dashboard;
    } catch (error) {
      logger.error('Error creating dashboard:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getDashboardById(id, userId, companyId) {
    const dashboard = await this.repository.findById(id, companyId);
    if (!dashboard || dashboard.userId !== userId) {
      throw new NotFoundError('Dashboard not found');
    }
    return dashboard;
  }

  async getUserDashboards(userId, companyId) {
    return this.repository.findByUser(userId, companyId);
  }

  async getDefaultDashboard(userId, companyId) {
    const dashboard = await this.repository.findDefault(userId, companyId);
    if (!dashboard) {
      // إذا لم توجد لوحة افتراضية، أنشئ واحدة
      const defaultData = {
        name: 'My Dashboard',
        type: 'overview',
        settings: { isDefault: true }
      };
      return this.createDashboard(defaultData, userId, companyId);
    }
    return dashboard;
  }

  async getDashboardsByType(userId, companyId, type) {
    return this.repository.findByType(userId, companyId, type);
  }

  async getPinnedDashboards(userId, companyId) {
    return this.repository.findPinned(userId, companyId);
  }

  // ============ UPDATE ============

  async updateDashboard(id, data, userId, companyId) {
    try {
      const existingDashboard = await this.repository.findById(id, companyId);
      if (!existingDashboard || existingDashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'layout',
        'preferences', 'settings', 'timePeriod',
        'filters', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      updateData.updatedBy = userId;

      const updatedDashboard = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('dashboard.updated', {
        dashboardId: updatedDashboard._id,
        name: updatedDashboard.name,
        userId
      });

      logger.info('Dashboard updated successfully', {
        dashboardId: updatedDashboard._id,
        name: updatedDashboard.name
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error updating dashboard:', error);
      throw error;
    }
  }

  // ============ WIDGETS ============

  async addWidget(id, widget, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const updatedDashboard = await this.repository.addWidget(id, widget);

      eventEmitter.emit('dashboard.widget_added', {
        dashboardId: id,
        widgetId: widget.id,
        userId
      });

      logger.info('Widget added to dashboard', {
        dashboardId: id,
        widgetId: widget.id
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error adding widget:', error);
      throw error;
    }
  }

  async removeWidget(id, widgetId, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const updatedDashboard = await this.repository.removeWidget(id, widgetId);

      logger.info('Widget removed from dashboard', {
        dashboardId: id,
        widgetId
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error removing widget:', error);
      throw error;
    }
  }

  async updateWidget(id, widgetId, data, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const updatedDashboard = await this.repository.updateWidget(id, widgetId, data);

      logger.info('Widget updated in dashboard', {
        dashboardId: id,
        widgetId
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error updating widget:', error);
      throw error;
    }
  }

  async reorderWidgets(id, widgetIds, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const updatedDashboard = await this.repository.reorderWidgets(id, widgetIds);

      logger.info('Widgets reordered in dashboard', {
        dashboardId: id
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error reordering widgets:', error);
      throw error;
    }
  }

  // ============ DEFAULT ============

  async setDefaultDashboard(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      const updatedDashboard = await this.repository.setDefault(id, userId, companyId);

      eventEmitter.emit('dashboard.default_changed', {
        dashboardId: id,
        userId
      });

      logger.info('Default dashboard changed', {
        dashboardId: id,
        userId
      });

      return updatedDashboard;
    } catch (error) {
      logger.error('Error setting default dashboard:', error);
      throw error;
    }
  }

  // ============ METRICS ============

  async getDashboardMetrics(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      // التحقق من وجود بيانات مخزنة مؤقتاً
      if (dashboard.metricsCache && Object.keys(dashboard.metricsCache).length > 0) {
        return dashboard.metricsCache;
      }

      // جمع البيانات من جميع الوحدات
      const metrics = await this.collectMetrics(dashboard);

      // تخزين البيانات مؤقتاً
      await this.repository.updateCache(id, metrics);

      return metrics;
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  async refreshDashboardMetrics(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      // جمع البيانات الجديدة
      const metrics = await this.collectMetrics(dashboard);

      // تحديث التخزين المؤقت
      await this.repository.updateCache(id, metrics);

      eventEmitter.emit('dashboard.refreshed', {
        dashboardId: id,
        userId
      });

      return metrics;
    } catch (error) {
      logger.error('Error refreshing dashboard metrics:', error);
      throw error;
    }
  }

  async collectMetrics(dashboard) {
    // TODO: جمع البيانات من جميع الوحدات
    const metrics = {
      // مؤشرات عامة
      overview: {
        totalFactories: 0,
        totalDepartments: 0,
        totalMachines: 0,
        totalSensors: 0,
        totalUsers: 0
      },
      // استدامة
      sustainability: {
        carbonEmission: 0,
        energyConsumption: 0,
        waterConsumption: 0,
        wasteGeneration: 0,
        greenScore: 0
      },
      // إنتاج
      production: {
        totalProduction: 0,
        efficiency: 0,
        uptime: 0,
        quality: 0
      },
      // تنبيهات
      alerts: {
        active: 0,
        critical: 0,
        warning: 0,
        info: 0
      },
      // إشعارات
      notifications: {
        unread: 0,
        total: 0
      },
      // تقارير
      reports: {
        total: 0,
        completed: 0,
        pending: 0
      },
      // اتجاهات
      trends: {
        carbon: [],
        energy: [],
        water: [],
        waste: []
      },
      lastUpdated: new Date()
    };

    return metrics;
  }

  // ============ DELETE ============

  async deleteDashboard(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

      // إذا كانت اللوحة افتراضية، اختر لوحة أخرى كافتراضية
      if (dashboard.settings.isDefault) {
        const otherDashboard = await this.repository.findOne(
          { userId, companyId, _id: { $ne: id } },
          companyId
        );
        if (otherDashboard) {
          await this.repository.setDefault(otherDashboard._id, userId, companyId);
        }
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('dashboard.deleted', {
        dashboardId: id,
        name: dashboard.name,
        userId
      });

      logger.info('Dashboard deleted', {
        dashboardId: id,
        name: dashboard.name
      });

      return { message: 'Dashboard deleted successfully' };
    } catch (error) {
      logger.error('Error deleting dashboard:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  async getDashboardStats(userId, companyId) {
    return this.repository.getStats(userId, companyId);
  }

  // ============ EXPORT ============

  async exportDashboards(userId, companyId, format = 'json') {
    return this.repository.exportDashboards(userId, companyId, format);
  }
}

module.exports = DashboardService;