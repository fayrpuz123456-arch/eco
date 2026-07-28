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
  // ✅ ملاحظة مهمة:
  // getDashboardById و getDefaultDashboard بيرجعوا الـ widgets "لايف" دايماً
  // (مبنية من collectRealMetrics() في كل Request) وده مقصود ومطلوب:
  // كل GET بيجيب أحدث قيم من السنسورز/التنبيهات مباشرة من قاعدة البيانات
  // من غير أي كاش، عشان الداشبورد يفضل محدّث تلقائياً كل ما الفرونت يعمل refresh/polling.

  async getDashboardById(id, userId, companyId) {
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

  async getDefaultDashboard(userId, companyId) {
    let dashboard = await this.repository.findDefault(userId, companyId);

    if (!dashboard) {
      // ✅ استخدام اسم المستخدم بدلاً من "My Dashboard" الثابت
      const user = await this.getUser(userId);
      const defaultName = user?.displayName
        ? `${user.displayName}'s Dashboard`
        : 'My Dashboard';

      const defaultData = {
        name: defaultName,
        type: 'overview',
        settings: { isDefault: true }
      };
      dashboard = await this.createDashboard(defaultData, userId, companyId);
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
  // ✅ تم إلغاء الاعتماد على metricsCache هنا لأن المطلوب "كله لايف يتحدث تلقائيا".
  // الكاش كان بيرجع بيانات قديمة لو موجودة بدل ما يجيب بيانات حديثة، وده بيعارض
  // فكرة اللايف أبدياً. دلوقتي كل نداء بيجيب بيانات حقيقية طازة، وبرضه بيحدّث
  // الكاش في الخلفية (فيدا استخدمها أي كود تاني محتاج قراءة سريعة من الكاش).

  async getDashboardMetrics(id, userId, companyId) {
    try {
      const dashboard = await this.repository.findById(id, companyId);
      if (!dashboard || dashboard.userId !== userId) {
        throw new NotFoundError('Dashboard not found');
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
   *
   * ✅✅ FIX (المشكلة الأساسية اللي كانت بتمنع ظهور/تحديث ويدجت السينسورز):
   * الكود القديم كان بيبني recentSensors بالاعتماد الكامل على كوليكشن Sensor
   * (Sensor.find({ companyId, deletedAt: null })). المشكلة إن أرقام الـ metrics
   * اللي بتوصلنا (totalSensors: 0, totalMachines: 0) وهي بتزيد totalReadings
   * بشكل طبيعي بتأكد إن مستندات Sensor نفسها مش موجودة/مش متطابقة مع الـ
   * companyId - رغم إن قراءات SensorReading بتتسجل صح.
   *
   * يعني القراءة بتتسجل في SensorReading collection، بس مفيش مستند Sensor
   * متسجل أو متطابق بيمثلها، فـ recentSensors كانت بترجع فاضية دايماً، وبالتالي
   * مفيش widget بيتبني للسينسور ولا القراءة بتظهر في الداشبورد.
   *
   * الحل: بدل ما نعتمد بس على Sensor collection، بنعمل aggregation مباشر على
   * SensorReading نفسها ونجيب آخر قراءة لكل sensorId (لايف 100%)، وبعدين لو
   * لقينا مستند Sensor مطابق بنستخدم بياناته (الاسم/النوع/الحالة)، ولو مش
   * موجود بنبني بيانات افتراضية من القراءة نفسها عشان الويدجت تظهر برضو.
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
        totalSensorsRegistered,
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

      // ✅ FIX: نجيب آخر قراءة لكل sensorId مباشرة من SensorReading (مش من Sensor)
      // عشان تكون لايف فعلياً حتى لو مستند الـ Sensor مش موجود/متطابق.
      let liveSensorReadings = [];
      try {
        liveSensorReadings = await SensorReading.aggregate([
          { $match: { companyId, deletedAt: null } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$sensorId',
              lastValue: { $first: '$value' },
              unit: { $first: '$unit' },
              quality: { $first: '$quality' },
              lastReadingAt: { $first: '$createdAt' },
              minValue: { $min: '$value' },
              maxValue: { $max: '$value' },
              factoryId: { $first: '$factoryId' },
              machineId: { $first: '$machineId' },
              readingCount: { $sum: 1 }
            }
          },
          { $sort: { lastReadingAt: -1 } },
          { $limit: 50 }
        ]);
      } catch (aggError) {
        logger.error('Error aggregating live sensor readings:', aggError);
        liveSensorReadings = [];
      }

      // ✅ نجيب مستندات Sensor المطابقة (لو موجودة) عشان الاسم/النوع/الحالة/الـ thresholds
      const sensorIds = liveSensorReadings.map(r => r._id).filter(Boolean);
      const sensorDocs = sensorIds.length
        ? await Sensor.find({ _id: { $in: sensorIds } }).lean()
        : [];
      const sensorDocsMap = new Map(sensorDocs.map(s => [String(s._id), s]));

      // ✅ دمج بيانات القراءة الحية مع مستند الـ Sensor (لو موجود) في شكل واحد
      // متوافق مع اللي buildDynamicWidgets بيتوقعه (sensor.readings.lastValue... إلخ)
      const recentSensors = liveSensorReadings.map((reading) => {
        const sensorDoc = sensorDocsMap.get(String(reading._id));
        return {
          _id: reading._id,
          name: sensorDoc?.name || `Sensor ${String(reading._id).slice(0, 6)}`,
          type: sensorDoc?.type || null,
          unit: sensorDoc?.unit || reading.unit || '',
          status: sensorDoc?.status || 'active',
          factoryId: sensorDoc?.factoryId || reading.factoryId || null,
          machineId: sensorDoc?.machineId || reading.machineId || null,
          thresholds: sensorDoc?.thresholds || sensorDoc?.config?.thresholds || null,
          readings: {
            lastValue: reading.lastValue,
            lastReadingAt: reading.lastReadingAt,
            minValue: reading.minValue,
            maxValue: reading.maxValue,
            readingCount: reading.readingCount
          }
        };
      });

      // ✅ لو مفيش مستندات Sensor مسجلة رسمياً بس فيه قراءات فعلاً بتوصل،
      // نعرض عدد السينسورز اللي فعلياً بتبعت بيانات بدل ما نعرض صفر مضلل.
      const totalSensors = totalSensorsRegistered > 0
        ? totalSensorsRegistered
        : liveSensorReadings.length;

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
   * بناء الـ Widgets ديناميكياً مع السنسورز الحقيقية - لايف بالكامل.
   * ✅ كل widget دلوقتي بيرجع بالشكل الكامل: data + config + size + position +
   * isVisible + refreshInterval، بدل ما يرجع بس id/type/title.
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

    // Sensor Widgets - كل سنسور بياخد widget لايف بالـ value/الحالة الحقيقية
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
        lastReadingAt: sensor.readings?.lastReadingAt || null,
        minValue: sensor.readings?.minValue ?? null,
        maxValue: sensor.readings?.maxValue ?? null
      },
      config: {
        sensorType: sensor.type || null,
        factoryId: sensor.factoryId || null,
        machineId: sensor.machineId || null,
        thresholds: sensor.thresholds || sensor.config?.thresholds || null
      },
      refreshInterval: 10, // ✅ تحديث كل 10 ثواني افتراضياً للسنسورز الحية
      isVisible: true
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
      },
      config: {
        sensorId: alert.sensorId || null,
        machineId: alert.machineId || null
      },
      refreshInterval: 15,
      isVisible: true
    }));

    const allWidgets = [...kpiWidgets, ...sensorWidgets, ...alertWidgets];

    return allWidgets.map((widget) => this.sanitizeWidgetData(widget));
  }

  // ============ 🎨 GET SENSOR ICON ============

  getSensorIcon(type) {
    if (!type) return '📡';

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
    return icons[type.toLowerCase()] || icons.default;
  }

  // ============ 🎨 GET ALERT ICON ============

  getAlertIcon(severity) {
    if (!severity) return '🔔';

    const icons = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢',
      'info': '🔵',
      'default': '🔔'
    };
    return icons[severity.toLowerCase()] || icons.default;
  }

  // ============ 🛡️ SANITIZE DATA ============
  // ✅ بنحافظ دلوقتي على كل حقول الـ widget (config/size/position/refreshInterval/isVisible)
  // بدل ما نرجع بس id/type/title/data زي الأول.

  sanitizeWidgetData(widget) {
    if (!widget) return null;

    const data = widget.data || {};
    const config = widget.config || {};

    return {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      description: widget.description ?? null,
      size: widget.size || { width: 2, height: 2 },
      position: widget.position || { x: 0, y: 0 },
      isVisible: widget.isVisible ?? true,
      refreshInterval: widget.refreshInterval ?? 30,
      data: {
        ...data,
        value: data.value ?? 0,
        unit: data.unit ?? '',
        icon: data.icon ?? '📡',
        status: data.status ?? 'normal'
      },
      config
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

  // ============ HELPER ============

  /**
   * الحصول على معلومات المستخدم
   */
  async getUser(userId) {
    try {
      const User = require('../../users/models/User.model');
      return await User.findOne({ firebaseUid: userId }).lean();
    } catch (error) {
      logger.warn('Failed to fetch user for dashboard name:', error.message);
      return null;
    }
  }
}

module.exports = DashboardService;