/**
 * أنواع الأحداث في النظام
 * Event Types for EcoGuardian System
 */

const EventTypes = {
  // ===== System Events =====
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  SYSTEM_HEALTH_CHECK: 'system.health_check',

  // ===== User Events =====
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PASSWORD_CHANGED: 'user.password.changed',
  USER_PASSWORD_RESET: 'user.password.reset',
  USER_EMAIL_VERIFIED: 'user.email.verified',
  USER_2FA_ENABLED: 'user.2fa.enabled',
  USER_2FA_DISABLED: 'user.2fa.disabled',
  USER_PERMISSIONS_UPDATED: 'user.permissions.updated',
  USER_ROLE_UPDATED: 'user.role.updated',

  // ===== Company Events =====
  COMPANY_CREATED: 'company.created',
  COMPANY_UPDATED: 'company.updated',
  COMPANY_DELETED: 'company.deleted',
  COMPANY_VERIFIED: 'company.verified',
  COMPANY_UNVERIFIED: 'company.unverified',
  COMPANY_SUBSCRIPTION_UPDATED: 'company.subscription.updated',
  COMPANY_SUBSCRIPTION_EXPIRED: 'company.subscription.expired',
  COMPANY_ESG_UPDATED: 'company.esg.updated',

  // ===== Factory Events =====
  FACTORY_CREATED: 'factory.created',
  FACTORY_UPDATED: 'factory.updated',
  FACTORY_DELETED: 'factory.deleted',
  FACTORY_STATUS_CHANGED: 'factory.status.changed',
  FACTORY_GREEN_SCORE_UPDATED: 'factory.green_score.updated',

  // ===== Department Events =====
  DEPARTMENT_CREATED: 'department.created',
  DEPARTMENT_UPDATED: 'department.updated',
  DEPARTMENT_DELETED: 'department.deleted',
  DEPARTMENT_STATUS_CHANGED: 'department.status.changed',

  // ===== Production Line Events =====
  PRODUCTION_LINE_CREATED: 'production_line.created',
  PRODUCTION_LINE_UPDATED: 'production_line.updated',
  PRODUCTION_LINE_DELETED: 'production_line.deleted',
  PRODUCTION_LINE_STARTED: 'production_line.started',
  PRODUCTION_LINE_STOPPED: 'production_line.stopped',
  PRODUCTION_LINE_STATUS_CHANGED: 'production_line.status.changed',
  PRODUCTION_LINE_PERFORMANCE_UPDATED: 'production_line.performance.updated',

  // ===== Machine Events =====
  MACHINE_CREATED: 'machine.created',
  MACHINE_UPDATED: 'machine.updated',
  MACHINE_DELETED: 'machine.deleted',
  MACHINE_STARTED: 'machine.started',
  MACHINE_STOPPED: 'machine.stopped',
  MACHINE_STATUS_CHANGED: 'machine.status.changed',
  MACHINE_MAINTENANCE_DUE: 'machine.maintenance.due',
  MACHINE_MAINTENANCE_OVERDUE: 'machine.maintenance.overdue',
  MACHINE_FAILURE_PREDICTED: 'machine.failure.predicted',
  MACHINE_PERFORMANCE_UPDATED: 'machine.performance.updated',
  MACHINE_OEE_UPDATED: 'machine.oee.updated',

  // ===== Sensor Events =====
  SENSOR_CREATED: 'sensor.created',
  SENSOR_UPDATED: 'sensor.updated',
  SENSOR_DELETED: 'sensor.deleted',
  SENSOR_STATUS_CHANGED: 'sensor.status.changed',
  SENSOR_CALIBRATED: 'sensor.calibrated',
  SENSOR_LOW_BATTERY: 'sensor.low_battery',
  SENSOR_OFFLINE: 'sensor.offline',
  SENSOR_ONLINE: 'sensor.online',

  // ===== Sensor Reading Events =====
  SENSOR_DATA_RECEIVED: 'sensor.data.received',
  SENSOR_DATA_PROCESSED: 'sensor.data.processed',
  SENSOR_DATA_BULK_RECEIVED: 'sensor.data.bulk.received',
  SENSOR_ALERT_TRIGGERED: 'sensor.alert.triggered',

  // ===== Carbon Events =====
  CARBON_CREATED: 'carbon.created',
  CARBON_UPDATED: 'carbon.updated',
  CARBON_DELETED: 'carbon.deleted',
  CARBON_VERIFIED: 'carbon.verified',
  CARBON_TARGET_UPDATED: 'carbon.target.updated',
  CARBON_EMISSIONS_UPDATED: 'carbon.emissions.updated',
  CARBON_RECOMMENDATIONS_GENERATED: 'carbon.recommendations.generated',

  // ===== Energy Events =====
  ENERGY_CREATED: 'energy.created',
  ENERGY_UPDATED: 'energy.updated',
  ENERGY_DELETED: 'energy.deleted',
  ENERGY_CONSUMPTION_UPDATED: 'energy.consumption.updated',
  ENERGY_EFFICIENCY_UPDATED: 'energy.efficiency.updated',
  ENERGY_TARGET_UPDATED: 'energy.target.updated',

  // ===== Water Events =====
  WATER_CREATED: 'water.created',
  WATER_UPDATED: 'water.updated',
  WATER_DELETED: 'water.deleted',
  WATER_CONSUMPTION_UPDATED: 'water.consumption.updated',
  WATER_QUALITY_UPDATED: 'water.quality.updated',
  WATER_LEAK_DETECTED: 'water.leak.detected',
  WATER_LEAK_REPAIRED: 'water.leak.repaired',
  WATER_TARGET_UPDATED: 'water.target.updated',

  // ===== Waste Events =====
  WASTE_CREATED: 'waste.created',
  WASTE_UPDATED: 'waste.updated',
  WASTE_DELETED: 'waste.deleted',
  WASTE_GENERATION_UPDATED: 'waste.generation.updated',
  WASTE_RECYCLING_UPDATED: 'waste.recycling.updated',
  WASTE_OPPORTUNITY_ADDED: 'waste.opportunity.added',
  WASTE_OPPORTUNITY_SOLD: 'waste.opportunity.sold',
  WASTE_TARGET_UPDATED: 'waste.target.updated',

  // ===== Alert Events =====
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  ALERT_RESOLVED: 'alert.resolved',
  ALERT_ESCALATED: 'alert.escalated',
  ALERT_REOPENED: 'alert.reopened',
  ALERT_CREATED: 'alert.created',
  ALERT_UPDATED: 'alert.updated',
  ALERT_DELETED: 'alert.deleted',

  // ===== Notification Events =====
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_ALL_READ: 'notification.all_read',
  NOTIFICATION_DELIVERED: 'notification.delivered',
  NOTIFICATION_FAILED: 'notification.failed',

  // ===== Report Events =====
  REPORT_CREATED: 'report.created',
  REPORT_UPDATED: 'report.updated',
  REPORT_DELETED: 'report.deleted',
  REPORT_GENERATED: 'report.generated',
  REPORT_GENERATION_STARTED: 'report.generation.started',
  REPORT_GENERATION_FAILED: 'report.generation.failed',
  REPORT_SCHEDULED: 'report.scheduled',
  REPORT_SHARED: 'report.shared',
  REPORT_UNSHARED: 'report.unshared',
  REPORT_COMMENT_ADDED: 'report.comment.added',

  // ===== Dashboard Events =====
  DASHBOARD_CREATED: 'dashboard.created',
  DASHBOARD_UPDATED: 'dashboard.updated',
  DASHBOARD_DELETED: 'dashboard.deleted',
  DASHBOARD_DEFAULT_CHANGED: 'dashboard.default.changed',
  DASHBOARD_REFRESHED: 'dashboard.refreshed',
  DASHBOARD_WIDGET_ADDED: 'dashboard.widget.added',
  DASHBOARD_WIDGET_REMOVED: 'dashboard.widget.removed',
  DASHBOARD_WIDGET_UPDATED: 'dashboard.widget.updated',

  // ===== Plugin Events =====
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
  PLUGIN_ENABLED: 'plugin.enabled',
  PLUGIN_DISABLED: 'plugin.disabled',
  PLUGIN_UPDATED: 'plugin.updated',

  // ===== AI Events =====
  AI_PREDICTION_RECEIVED: 'ai.prediction.received',
  AI_PREDICTION_ERROR: 'ai.prediction.error',
  AI_MODEL_TRAINED: 'ai.model.trained',
  AI_MODEL_DEPLOYED: 'ai.model.deployed',

  // ===== MQTT Events =====
  MQTT_CONNECTED: 'mqtt.connected',
  MQTT_DISCONNECTED: 'mqtt.disconnected',
  MQTT_MESSAGE_RECEIVED: 'mqtt.message.received',
  MQTT_MESSAGE_PUBLISHED: 'mqtt.message.published',
  MQTT_ERROR: 'mqtt.error',

  // ===== Socket Events =====
  SOCKET_CONNECTED: 'socket.connected',
  SOCKET_DISCONNECTED: 'socket.disconnected',
  SOCKET_ERROR: 'socket.error',

  // ===== Cache Events =====
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_SET: 'cache.set',
  CACHE_DELETE: 'cache.delete',
  CACHE_CLEAR: 'cache.clear',

  // ===== Database Events =====
  DB_CONNECTED: 'db.connected',
  DB_DISCONNECTED: 'db.disconnected',
  DB_ERROR: 'db.error',
  DB_QUERY_EXECUTED: 'db.query.executed',
  DB_INDEX_CREATED: 'db.index.created',

  // ===== Integration Events =====
  INTEGRATION_ERP_SYNC: 'integration.erp.sync',
  INTEGRATION_SCADA_SYNC: 'integration.scada.sync',
  INTEGRATION_MES_SYNC: 'integration.mes.sync',
  INTEGRATION_THIRD_PARTY: 'integration.third_party',
};

module.exports = EventTypes; 
