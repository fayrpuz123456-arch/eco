console.log('🔄 DashboardService.js is being loaded!');

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

console.log('✅ DashboardService.js loaded successfully!');

class DashboardService extends BaseService {
  constructor() {
    console.log('🏗️ DashboardService constructor called!');
    super(new DashboardRepository(), 'Dashboard');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createDashboard(data, userId, companyId) {
    console.log('📝 createDashboard called');
    try {
      this.validateRequiredFields(data, ['name', 'type']);

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
    console.log('🔍 getDashboardById called');
    const dashboard = await this.repository.findById(id, companyId);
    if (!dashboard || dashboard.userId !== userId) {
      throw new NotFoundError('Dashboard not found');
    }

    const metrics = await this.collectRealMetrics(userId, companyId);
    const dynamicWidgets = this.buildDynamicWidgets(metrics);

    const dashboardObj = dashboard.toObject ? dashboard.toObject() : dashboard;

    return {
      ...dashboardObj,
      widgets: dynamicWidgets,
      metrics: {
        totalSensors: metrics.totalSensors,
        activeAlerts: metrics.activeAlerts,
        totalFactories: metrics.totalFactories,
        totalMachines: metrics.totalMachines,
        totalUsers: metrics.totalUsers,
        totalDepartments: metrics.totalDepartments,
        totalProductionLines: metrics.totalProductionLines,
        totalReadings: metrics.totalReadings,
        totalReports: metrics.totalReports,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  async getUserDashboards(userId, companyId) {
    return this.repository.findByUser(userId, companyId);
  }

  // ============================================================
  // 🛠️ FIX #1 — Total Sensors كانت بترجع 0 لأي Dashboard جديد
  // ============================================================
  // السبب الحقيقي: لما مفيش Default Dashboard موجود، الكود القديم كان
  // بيعمل return مباشر لناتج createDashboard() من غير ما يحسب
  // الـ metrics ولا الـ widgets خالص، فالـ Response كان بيرجع من غير
  // Total Sensors أو أي widget أصلاً (مش إن القيمة صفر، القيمة كانت
  // مش موجودة أساساً). دلوقتي بقينا دايماً نمر على نفس مسار حساب
  // الـ metrics + الـ widgets سواء الـ Dashboard كان موجود قبل كده
  // أو اتعمله Create لأول مرة.
  async getDefaultDashboard(userId, companyId) {
    console.log('🔍 getDefaultDashboard called for userId:', userId);
    let dashboard = await this.repository.findDefault(userId, companyId);

    if (!dashboard) {
      console.log('🆕 No default dashboard, creating one...');
      const defaultData = {
        name: 'My Dashboard',
        type: 'overview',
        settings: { isDefault: true }
      };
      dashboard = await this.createDashboard(defaultData, userId, companyId);
      console.log('✅ Dashboard created:', dashboard._id);
    }

    console.log('📊 Dashboard found:', dashboard._id);
    console.log('📊 Collecting real metrics...');
    const metrics = await this.collectRealMetrics(userId, companyId);
    console.log('📊 Metrics found:', {
      totalSensors: metrics.totalSensors,
      activeAlerts: metrics.activeAlerts,
      totalFactories: metrics.totalFactories
    });

    console.log('🎨 Building dynamic widgets...');
    const dynamicWidgets = this.buildDynamicWidgets(metrics);
    console.log('🎨 Widgets count:', dynamicWidgets.length);

    const dashboardObj = dashboard.toObject ? dashboard.toObject() : dashboard;

    const result = {
      ...dashboardObj,
      widgets: dynamicWidgets,
      metrics: {
        totalSensors: metrics.totalSensors,
        activeAlerts: metrics.activeAlerts,
        totalFactories: metrics.totalFactories,
        totalMachines: metrics.totalMachines,
        totalUsers: metrics.totalUsers,
        totalDepartments: metrics.totalDepartments,
        totalProductionLines: metrics.totalProductionLines,
        totalReadings: metrics.totalReadings,
        totalReports: metrics.totalReports,
        lastUpdated: new Date().toISOString()
      }
    };

    console.log('✅ Final result - widgets count:', result.widgets.length);
    return result;
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

      if (dashboard.metricsCache && Object.keys(dashboard.metricsCache).length > 0) {
        return dashboard.metricsCache;
      }

      const metrics = await this.collectMetrics(dashboard);
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

      const metrics = await this.collectMetrics(dashboard);
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

  // ============ 📊 COLLECT REAL METRICS ============

  /**
   * جمع البيانات الحقيقية من قاعدة البيانات
   */
  async collectRealMetrics(userId, companyId) {
    try {
      const Sensor = require('../../sensors/models/Sensor.model');
      const Alert = require('../../alerts/models/Alert.model');
      const Factory = require('../../factories/models/Factory.model');
      const Machine = require('../../machines/models/Machine.model');
      const User = require('../../users/models/User.model');
      const Department = require('../../departments/models/Department.model');
      const ProductionLine = require('../../productionLines/models/ProductionLine.model');
      const SensorReading = require('../../sensorReadings/models/SensorReading.model');
      const Report = require('../../reports/models/Report.model');

      const [
        totalSensors,
        activeAlerts,
        totalFactories,
        totalMachines,
        totalUsers,
        totalDepartments,
        totalProductionLines,
        totalReadings,
        totalReports
      ] = await Promise.all([
        Sensor.countDocuments({ companyId, deletedAt: null }),
        Alert.countDocuments({
          companyId,
          status: { $in: ['active', 'acknowledged'] },
          deletedAt: null
        }),
        Factory.countDocuments({ companyId, deletedAt: null }),
        Machine.countDocuments({ companyId, deletedAt: null }),
        User.countDocuments({ companyId, deletedAt: null }),
        Department.countDocuments({ companyId, deletedAt: null }),
        ProductionLine.countDocuments({ companyId, deletedAt: null }),
        SensorReading.countDocuments({ companyId, deletedAt: null }),
        Report.countDocuments({ companyId, deletedAt: null })
      ]);

      const recentSensors = await Sensor.find({ companyId, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const recentAlerts = await Alert.find({
        companyId,
        deletedAt: null
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return {
        totalSensors: totalSensors || 0,
        activeAlerts: activeAlerts || 0,
        totalFactories: totalFactories || 0,
        totalMachines: totalMachines || 0,
        totalUsers: totalUsers || 0,
        totalDepartments: totalDepartments || 0,
        totalProductionLines: totalProductionLines || 0,
        totalReadings: totalReadings || 0,
        totalReports: totalReports || 0,
        recentSensors: recentSensors || [],
        recentAlerts: recentAlerts || []
      };
    } catch (error) {
      logger.error('Error collecting real metrics:', error);
      return {
        totalSensors: 0,
        activeAlerts: 0,
        totalFactories: 0,
        totalMachines: 0,
        totalUsers: 0,
        totalDepartments: 0,
        totalProductionLines: 0,
        totalReadings: 0,
        totalReports: 0,
        recentSensors: [],
        recentAlerts: []
      };
    }
  }

  // ============ 🎨 BUILD DYNAMIC WIDGETS ============

  /**
   * بناء الـ Widgets ديناميكياً مع السنسورز الحقيقية
   *
   * 🛠️ FIX #3: السنسورز والتنبيهات الحقيقية بترجع مدمجة جوه نفس
   * لستة الـ widgets اللي بترجع من الداشبورد (كانت موجودة أصلاً)،
   * وبقينا كمان نمررهم كلهم على sanitizeWidgetData في الآخر عشان
   * نضمن إن مفيش أي null هيوصل للفرونت إند (FIX #2).
   */
  buildDynamicWidgets(metrics) {
    // KPI Widgets
    const kpiWidgets = [
      {
        id: 'widget_total_sensors',
        title: 'Total Sensors',
        type: 'kpi',
        data: {
          value: metrics.totalSensors ?? 0,
          unit: '',
          icon: 'sensors'
        }
      },
      {
        id: 'widget_active_alerts',
        title: 'Active Alerts',
        type: 'kpi',
        data: {
          value: metrics.activeAlerts ?? 0,
          unit: '',
          icon: 'alerts'
        }
      },
      {
        id: 'widget_total_factories',
        title: 'Total Factories',
        type: 'kpi',
        data: {
          value: metrics.totalFactories ?? 0,
          unit: '',
          icon: 'factory'
        }
      },
      {
        id: 'widget_total_machines',
        title: 'Total Machines',
        type: 'kpi',
        data: {
          value: metrics.totalMachines ?? 0,
          unit: '',
          icon: 'machines'
        }
      },
      {
        id: 'widget_total_users',
        title: 'Total Users',
        type: 'kpi',
        data: {
          value: metrics.totalUsers ?? 0,
          unit: '',
          icon: 'users'
        }
      },
      {
        id: 'widget_total_departments',
        title: 'Total Departments',
        type: 'kpi',
        data: {
          value: metrics.totalDepartments ?? 0,
          unit: '',
          icon: 'departments'
        }
      },
      {
        id: 'widget_total_readings',
        title: 'Total Readings',
        type: 'kpi',
        data: {
          value: metrics.totalReadings ?? 0,
          unit: '',
          icon: 'readings'
        }
      },
      {
        id: 'widget_total_reports',
        title: 'Total Reports',
        type: 'kpi',
        data: {
          value: metrics.totalReports ?? 0,
          unit: '',
          icon: 'reports'
        }
      }
    ];

    // Sensor Widgets — السنسورز الحقيقية بتتحول مباشرة لـ widget بنفس الـ structure
    const sensorWidgets = (metrics.recentSensors || []).map((sensor, index) => ({
      id: `sensor_${sensor._id || index}`,
      title: sensor.name || `Sensor ${index + 1}`,
      type: sensor.type || 'sensor',
      data: {
        value: sensor.readings?.lastValue ?? 0,
        unit: sensor.unit ?? '',
        icon: this.getSensorIcon(sensor.type),
        status: sensor.status || 'active',
        sensorId: sensor._id,
        lastReadingAt: sensor.readings?.lastReadingAt || null
      }
    }));

    // Alert Widgets
    const alertWidgets = (metrics.recentAlerts || []).map((alert, index) => ({
      id: `alert_${alert._id || index}`,
      title: alert.name || `Alert ${index + 1}`,
      type: 'alert',
      data: {
        severity: alert.severity || 'info',
        status: alert.status || 'active',
        message: alert.message || '',
        icon: this.getAlertIcon(alert.severity),
        alertId: alert._id,
        triggeredAt: alert.triggeredAt || null
      }
    }));

    const allWidgets = [...kpiWidgets, ...sensorWidgets, ...alertWidgets];

    // 🛠️ FIX #2: كل widget بيعدي على sanitizeWidgetData قبل ما يترجع،
    // فمفيش أي قيمة null ممكن توصل للفرونت إند وتعمل كراش.
    return allWidgets.map((widget) => this.sanitizeWidgetData(widget));
  }

  // ============ 🎨 GET SENSOR ICON ============

  getSensorIcon(type) {
    const icons = {
      'temperature': '🌡️',
      'humidity': '💧',
      'pressure': '📊',
      'energy': '⚡',
      'water': '💦',
      'gas': '🔥',
      'pzem004t': '⚡',
      'current': '💡',
      'voltage': '🔋',
      'power': '⚡',
      'waterflow': '💧',
      'fuelflow': '⛽',
      'mq135': '🌫️',
      'co2': '🌫️',
      'vibration': '📳',
      'rpm': '🔄',
      'default': '📡'
    };
    return icons[type?.toLowerCase()] || icons.default;
  }

  // ============ 🎨 GET ALERT ICON ============

  getAlertIcon(severity) {
    const icons = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢',
      'info': '🔵',
      'default': '🔔'
    };
    return icons[severity?.toLowerCase()] || icons.default;
  }

  // ============ 🛡️ SANITIZE DATA ============

  // 🛠️ FIX #2 — Null-Safety
  // البق القديم: كان بيحط الـ default values الأول، وبعدين بيعمل
  // spread لـ widget.data تاني في الآخر، فلو value/unit جايين null
  // من الأصل كانوا بيرجعوا يبوّظوا الـ default ويرجعوا null تاني
  // (لأن الـ spread الأخير كان بيكتب فوق الـ default). دلوقتي بقينا
  // نعمل spread للبيانات الأصلية الأول، وبعدين نطبق الـ default
  // (?? ) فوقها في الآخر، فمفيش أي قيمة null ممكن تعدي.
  sanitizeWidgetData(widget) {
    if (!widget) return null;

    const data = widget.data || {};

    return {
      ...widget,
      data: {
        ...data,
        value: data.value ?? 0,
        unit: data.unit ?? '',
        icon: data.icon ?? '📡',
        status: data.status ?? 'normal'
      }
    };
  }

  // ============ 📊 COLLECT METRICS ============

  async collectMetrics(dashboard) {
    const realMetrics = await this.collectRealMetrics(
      dashboard.userId,
      dashboard.companyId
    );

    return {
      overview: {
        totalFactories: realMetrics.totalFactories,
        totalDepartments: realMetrics.totalDepartments,
        totalProductionLines: realMetrics.totalProductionLines,
        totalMachines: realMetrics.totalMachines,
        totalSensors: realMetrics.totalSensors,
        totalUsers: realMetrics.totalUsers,
        totalReadings: realMetrics.totalReadings
      },
      sustainability: {
        carbonEmission: 0,
        energyConsumption: 0,
        waterConsumption: 0,
        wasteGeneration: 0,
        greenScore: 0
      },
      production: {
        totalProduction: 0,
        efficiency: 0,
        uptime: 0,
        quality: 0
      },
      alerts: {
        active: realMetrics.activeAlerts,
        critical: 0,
        warning: 0,
        info: 0
      },
      notifications: {
        unread: 0,
        total: 0
      },
      reports: {
        total: realMetrics.totalReports,
        completed: 0,
        pending: 0
      },
      trends: {
        carbon: [],
        energy: [],
        water: [],
        waste: []
      },
      lastUpdated: new Date()
    };
  }

  // ============ DELETE ============

  async deleteDashboard(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
      }

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