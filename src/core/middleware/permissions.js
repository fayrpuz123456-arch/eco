const { sendError, sendUnauthorized } = require('../utils/response');
const logger = require('../utils/logger');

// ============ PERMISSIONS DEFINITIONS ============

/**
 * تعريف جميع الصلاحيات المتاحة في النظام
 */
const PERMISSIONS = {
  // ===== User Management =====
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',
  
  // ===== Company Management =====
  COMPANIES_VIEW: 'companies:view',
  COMPANIES_CREATE: 'companies:create',
  COMPANIES_UPDATE: 'companies:update',
  COMPANIES_DELETE: 'companies:delete',
  COMPANIES_MANAGE: 'companies:manage',
  
  // ===== Factory Management =====
  FACTORIES_VIEW: 'factories:view',
  FACTORIES_CREATE: 'factories:create',
  FACTORIES_UPDATE: 'factories:update',
  FACTORIES_DELETE: 'factories:delete',
  FACTORIES_MANAGE: 'factories:manage',
  
  // ===== Department Management =====
  DEPARTMENTS_VIEW: 'departments:view',
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_UPDATE: 'departments:update',
  DEPARTMENTS_DELETE: 'departments:delete',
  DEPARTMENTS_MANAGE: 'departments:manage',
  
  // ===== Production Line Management =====
  PRODUCTION_LINES_VIEW: 'productionlines:view',
  PRODUCTION_LINES_CREATE: 'productionlines:create',
  PRODUCTION_LINES_UPDATE: 'productionlines:update',
  PRODUCTION_LINES_DELETE: 'productionlines:delete',
  PRODUCTION_LINES_MANAGE: 'productionlines:manage',
  
  // ===== Machine Management =====
  MACHINES_VIEW: 'machines:view',
  MACHINES_CREATE: 'machines:create',
  MACHINES_UPDATE: 'machines:update',
  MACHINES_DELETE: 'machines:delete',
  MACHINES_MANAGE: 'machines:manage',
  
  // ===== Sensor Management =====
  SENSORS_VIEW: 'sensors:view',
  SENSORS_CREATE: 'sensors:create',
  SENSORS_UPDATE: 'sensors:update',
  SENSORS_DELETE: 'sensors:delete',
  SENSORS_MANAGE: 'sensors:manage',
  SENSORS_READINGS_VIEW: 'sensors:readings:view',
  SENSORS_READINGS_EXPORT: 'sensors:readings:export',
  
  // ===== Sustainability =====
  CARBON_VIEW: 'carbon:view',
  CARBON_MANAGE: 'carbon:manage',
  ENERGY_VIEW: 'energy:view',
  ENERGY_MANAGE: 'energy:manage',
  WATER_VIEW: 'water:view',
  WATER_MANAGE: 'water:manage',
  WASTE_VIEW: 'waste:view',
  WASTE_MANAGE: 'waste:manage',
  
  // ===== Reports =====
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_UPDATE: 'reports:update',
  REPORTS_DELETE: 'reports:delete',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_MANAGE: 'reports:manage',
  
  // ===== Alerts =====
  ALERTS_VIEW: 'alerts:view',
  ALERTS_CREATE: 'alerts:create',
  ALERTS_UPDATE: 'alerts:update',
  ALERTS_DELETE: 'alerts:delete',
  ALERTS_ACKNOWLEDGE: 'alerts:acknowledge',
  ALERTS_RESOLVE: 'alerts:resolve',
  ALERTS_MANAGE: 'alerts:manage',
  
  // ===== Notifications =====
  NOTIFICATIONS_VIEW: 'notifications:view',
  NOTIFICATIONS_SEND: 'notifications:send',
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  
  // ===== Plugins =====
  PLUGINS_VIEW: 'plugins:view',
  PLUGINS_INSTALL: 'plugins:install',
  PLUGINS_UNINSTALL: 'plugins:uninstall',
  PLUGINS_ENABLE: 'plugins:enable',
  PLUGINS_DISABLE: 'plugins:disable',
  PLUGINS_MANAGE: 'plugins:manage',
  
  // ===== Settings =====
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_MANAGE: 'settings:manage',
  
  // ===== Audit =====
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
  AUDIT_MANAGE: 'audit:manage',
  
  // ===== Exchange =====
  EXCHANGE_VIEW: 'exchange:view',
  EXCHANGE_CREATE: 'exchange:create',
  EXCHANGE_UPDATE: 'exchange:update',
  EXCHANGE_DELETE: 'exchange:delete',
  EXCHANGE_APPROVE: 'exchange:approve',
  EXCHANGE_MANAGE: 'exchange:manage',
  
  // ===== Heat Recovery =====
  HEAT_RECOVERY_VIEW: 'heatrecovery:view',
  HEAT_RECOVERY_CREATE: 'heatrecovery:create',
  HEAT_RECOVERY_UPDATE: 'heatrecovery:update',
  HEAT_RECOVERY_DELETE: 'heatrecovery:delete',
  HEAT_RECOVERY_MANAGE: 'heatrecovery:manage',
  
  // ===== Digital Twin =====
  DIGITAL_TWIN_VIEW: 'digitaltwin:view',
  DIGITAL_TWIN_MANAGE: 'digitaltwin:manage',
  
  // ===== AI =====
  AI_VIEW: 'ai:view',
  AI_MANAGE: 'ai:manage',
  AI_TRAIN: 'ai:train',
  
  // ===== System =====
  SYSTEM_VIEW: 'system:view',
  SYSTEM_MANAGE: 'system:manage',
  SYSTEM_MAINTENANCE: 'system:maintenance'
};

// ============ ROLE DEFINITIONS ============

/**
 * تعريف الأدوار والصلاحيات المرتبطة بها
 */
const ROLES = {
  // ===== Super Admin (كل الصلاحيات) =====
  super_admin: {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: Object.values(PERMISSIONS),
    isAdmin: true
  },
  
  // ===== Admin (مدير الشركة) =====
  admin: {
    name: 'Admin',
    description: 'Company administrator with full access to company data',
    permissions: [
      // Users
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.USERS_MANAGE,
      
      // Companies
      PERMISSIONS.COMPANIES_VIEW,
      PERMISSIONS.COMPANIES_UPDATE,
      PERMISSIONS.COMPANIES_MANAGE,
      
      // Factories
      PERMISSIONS.FACTORIES_VIEW,
      PERMISSIONS.FACTORIES_CREATE,
      PERMISSIONS.FACTORIES_UPDATE,
      PERMISSIONS.FACTORIES_DELETE,
      PERMISSIONS.FACTORIES_MANAGE,
      
      // Departments
      PERMISSIONS.DEPARTMENTS_VIEW,
      PERMISSIONS.DEPARTMENTS_CREATE,
      PERMISSIONS.DEPARTMENTS_UPDATE,
      PERMISSIONS.DEPARTMENTS_DELETE,
      PERMISSIONS.DEPARTMENTS_MANAGE,
      
      // Production Lines
      PERMISSIONS.PRODUCTION_LINES_VIEW,
      PERMISSIONS.PRODUCTION_LINES_CREATE,
      PERMISSIONS.PRODUCTION_LINES_UPDATE,
      PERMISSIONS.PRODUCTION_LINES_DELETE,
      PERMISSIONS.PRODUCTION_LINES_MANAGE,
      
      // Machines
      PERMISSIONS.MACHINES_VIEW,
      PERMISSIONS.MACHINES_CREATE,
      PERMISSIONS.MACHINES_UPDATE,
      PERMISSIONS.MACHINES_DELETE,
      PERMISSIONS.MACHINES_MANAGE,
      
      // Sensors
      PERMISSIONS.SENSORS_VIEW,
      PERMISSIONS.SENSORS_CREATE,
      PERMISSIONS.SENSORS_UPDATE,
      PERMISSIONS.SENSORS_DELETE,
      PERMISSIONS.SENSORS_MANAGE,
      PERMISSIONS.SENSORS_READINGS_VIEW,
      PERMISSIONS.SENSORS_READINGS_EXPORT,
      
      // Sustainability
      PERMISSIONS.CARBON_VIEW,
      PERMISSIONS.CARBON_MANAGE,
      PERMISSIONS.ENERGY_VIEW,
      PERMISSIONS.ENERGY_MANAGE,
      PERMISSIONS.WATER_VIEW,
      PERMISSIONS.WATER_MANAGE,
      PERMISSIONS.WASTE_VIEW,
      PERMISSIONS.WASTE_MANAGE,
      
      // Reports
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_CREATE,
      PERMISSIONS.REPORTS_UPDATE,
      PERMISSIONS.REPORTS_DELETE,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.REPORTS_MANAGE,
      
      // Alerts
      PERMISSIONS.ALERTS_VIEW,
      PERMISSIONS.ALERTS_CREATE,
      PERMISSIONS.ALERTS_UPDATE,
      PERMISSIONS.ALERTS_DELETE,
      PERMISSIONS.ALERTS_ACKNOWLEDGE,
      PERMISSIONS.ALERTS_RESOLVE,
      PERMISSIONS.ALERTS_MANAGE,
      
      // Notifications
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.NOTIFICATIONS_SEND,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
      
      // Plugins
      PERMISSIONS.PLUGINS_VIEW,
      PERMISSIONS.PLUGINS_ENABLE,
      PERMISSIONS.PLUGINS_DISABLE,
      
      // Settings
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.SETTINGS_MANAGE,
      
      // Audit
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.AUDIT_EXPORT,
      
      // Exchange
      PERMISSIONS.EXCHANGE_VIEW,
      PERMISSIONS.EXCHANGE_CREATE,
      PERMISSIONS.EXCHANGE_UPDATE,
      PERMISSIONS.EXCHANGE_DELETE,
      PERMISSIONS.EXCHANGE_APPROVE,
      PERMISSIONS.EXCHANGE_MANAGE,
      
      // Heat Recovery
      PERMISSIONS.HEAT_RECOVERY_VIEW,
      PERMISSIONS.HEAT_RECOVERY_CREATE,
      PERMISSIONS.HEAT_RECOVERY_UPDATE,
      PERMISSIONS.HEAT_RECOVERY_DELETE,
      PERMISSIONS.HEAT_RECOVERY_MANAGE,
      
      // Digital Twin
      PERMISSIONS.DIGITAL_TWIN_VIEW,
      PERMISSIONS.DIGITAL_TWIN_MANAGE,
      
      // AI
      PERMISSIONS.AI_VIEW,
      PERMISSIONS.AI_MANAGE
    ],
    isAdmin: true
  },
  
  // ===== Manager (مدير قسم) =====
  manager: {
    name: 'Manager',
    description: 'Department manager with limited administrative access',
    permissions: [
      // Users
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      
      // Factories
      PERMISSIONS.FACTORIES_VIEW,
      
      // Departments
      PERMISSIONS.DEPARTMENTS_VIEW,
      PERMISSIONS.DEPARTMENTS_UPDATE,
      
      // Production Lines
      PERMISSIONS.PRODUCTION_LINES_VIEW,
      PERMISSIONS.PRODUCTION_LINES_CREATE,
      PERMISSIONS.PRODUCTION_LINES_UPDATE,
      
      // Machines
      PERMISSIONS.MACHINES_VIEW,
      PERMISSIONS.MACHINES_CREATE,
      PERMISSIONS.MACHINES_UPDATE,
      
      // Sensors
      PERMISSIONS.SENSORS_VIEW,
      PERMISSIONS.SENSORS_CREATE,
      PERMISSIONS.SENSORS_UPDATE,
      PERMISSIONS.SENSORS_READINGS_VIEW,
      PERMISSIONS.SENSORS_READINGS_EXPORT,
      
      // Sustainability
      PERMISSIONS.CARBON_VIEW,
      PERMISSIONS.ENERGY_VIEW,
      PERMISSIONS.WATER_VIEW,
      PERMISSIONS.WASTE_VIEW,
      
      // Reports
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_CREATE,
      PERMISSIONS.REPORTS_EXPORT,
      
      // Alerts
      PERMISSIONS.ALERTS_VIEW,
      PERMISSIONS.ALERTS_CREATE,
      PERMISSIONS.ALERTS_ACKNOWLEDGE,
      PERMISSIONS.ALERTS_RESOLVE,
      
      // Notifications
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.NOTIFICATIONS_SEND,
      
      // Exchange
      PERMISSIONS.EXCHANGE_VIEW,
      PERMISSIONS.EXCHANGE_CREATE,
      PERMISSIONS.EXCHANGE_UPDATE,
      
      // Heat Recovery
      PERMISSIONS.HEAT_RECOVERY_VIEW,
      PERMISSIONS.HEAT_RECOVERY_CREATE,
      PERMISSIONS.HEAT_RECOVERY_UPDATE
    ],
    isAdmin: false
  },
  
  // ===== Engineer (مهندس) =====
  engineer: {
    name: 'Engineer',
    description: 'Technical user with access to machine and sensor data',
    permissions: [
      // Factories
      PERMISSIONS.FACTORIES_VIEW,
      
      // Departments
      PERMISSIONS.DEPARTMENTS_VIEW,
      
      // Production Lines
      PERMISSIONS.PRODUCTION_LINES_VIEW,
      
      // Machines
      PERMISSIONS.MACHINES_VIEW,
      PERMISSIONS.MACHINES_UPDATE,
      
      // Sensors
      PERMISSIONS.SENSORS_VIEW,
      PERMISSIONS.SENSORS_UPDATE,
      PERMISSIONS.SENSORS_READINGS_VIEW,
      PERMISSIONS.SENSORS_READINGS_EXPORT,
      
      // Sustainability
      PERMISSIONS.CARBON_VIEW,
      PERMISSIONS.ENERGY_VIEW,
      PERMISSIONS.WATER_VIEW,
      PERMISSIONS.WASTE_VIEW,
      
      // Reports
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_CREATE,
      PERMISSIONS.REPORTS_EXPORT,
      
      // Alerts
      PERMISSIONS.ALERTS_VIEW,
      PERMISSIONS.ALERTS_CREATE,
      PERMISSIONS.ALERTS_ACKNOWLEDGE,
      PERMISSIONS.ALERTS_RESOLVE,
      
      // Notifications
      PERMISSIONS.NOTIFICATIONS_VIEW,
      
      // Exchange
      PERMISSIONS.EXCHANGE_VIEW,
      PERMISSIONS.EXCHANGE_CREATE,
      
      // Heat Recovery
      PERMISSIONS.HEAT_RECOVERY_VIEW,
      
      // Digital Twin
      PERMISSIONS.DIGITAL_TWIN_VIEW
    ],
    isAdmin: false
  },
  
  // ===== Employee (موظف) =====
  employee: {
    name: 'Employee',
    description: 'Regular employee with read-only access to most data',
    permissions: [
      // Factories
      PERMISSIONS.FACTORIES_VIEW,
      
      // Departments
      PERMISSIONS.DEPARTMENTS_VIEW,
      
      // Production Lines
      PERMISSIONS.PRODUCTION_LINES_VIEW,
      
      // Machines
      PERMISSIONS.MACHINES_VIEW,
      
      // Sensors
      PERMISSIONS.SENSORS_VIEW,
      PERMISSIONS.SENSORS_READINGS_VIEW,
      
      // Sustainability
      PERMISSIONS.CARBON_VIEW,
      PERMISSIONS.ENERGY_VIEW,
      PERMISSIONS.WATER_VIEW,
      PERMISSIONS.WASTE_VIEW,
      
      // Reports
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      
      // Alerts
      PERMISSIONS.ALERTS_VIEW,
      
      // Notifications
      PERMISSIONS.NOTIFICATIONS_VIEW,
      
      // Exchange
      PERMISSIONS.EXCHANGE_VIEW,
      
      // Heat Recovery
      PERMISSIONS.HEAT_RECOVERY_VIEW
    ],
    isAdmin: false
  },
  
  // ===== Viewer (مشاهد) =====
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to basic data',
    permissions: [
      // Factories
      PERMISSIONS.FACTORIES_VIEW,
      
      // Departments
      PERMISSIONS.DEPARTMENTS_VIEW,
      
      // Production Lines
      PERMISSIONS.PRODUCTION_LINES_VIEW,
      
      // Machines
      PERMISSIONS.MACHINES_VIEW,
      
      // Sensors
      PERMISSIONS.SENSORS_VIEW,
      PERMISSIONS.SENSORS_READINGS_VIEW,
      
      // Sustainability
      PERMISSIONS.CARBON_VIEW,
      PERMISSIONS.ENERGY_VIEW,
      PERMISSIONS.WATER_VIEW,
      PERMISSIONS.WASTE_VIEW,
      
      // Reports
      PERMISSIONS.REPORTS_VIEW,
      
      // Alerts
      PERMISSIONS.ALERTS_VIEW,
      
      // Notifications
      PERMISSIONS.NOTIFICATIONS_VIEW
    ],
    isAdmin: false
  }
};

// ============ PERMISSION MIDDLEWARE ============

/**
 * التحقق من الصلاحيات المطلوبة
 * @param {string|array} requiredPermissions - الصلاحيات المطلوبة
 */
const checkPermissions = (requiredPermissions = []) => {
  if (typeof requiredPermissions === 'string') {
    requiredPermissions = [requiredPermissions];
  }

  return (req, res, next) => {
    try {
      // التأكد من وجود مستخدم
      if (!req.user) {
        logger.warn('Permission check failed: No user authenticated', {
          ip: req.ip,
          path: req.path
        });
        return sendUnauthorized(res, 'Authentication required');
      }

      // الحصول على صلاحيات المستخدم
      const userRole = req.user.claims?.role || req.user.role || 'viewer';
      const userPermissions = req.user.claims?.permissions || req.user.permissions || [];
      
      // الحصول على صلاحيات الدور
      const rolePermissions = ROLES[userRole]?.permissions || [];

      // إذا كانت الصلاحيات المطلوبة فارغة، نسمح بالمرور
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }

      // التحقق من صلاحيات الـ Super Admin
      if (userRole === 'super_admin') {
        return next();
      }

      // جمع كل صلاحيات المستخدم
      const allPermissions = [...userPermissions, ...rolePermissions];

      // التحقق من جميع الصلاحيات المطلوبة
      const hasAllPermissions = requiredPermissions.every(permission => 
        allPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter(
          permission => !allPermissions.includes(permission)
        );

        logger.warn('Permission denied', {
          userId: req.user.id,
          userRole,
          requiredPermissions,
          missingPermissions,
          path: req.path,
          method: req.method
        });

        return sendError(res, 403, 'Insufficient permissions', {
          required: requiredPermissions,
          missing: missingPermissions,
          role: userRole
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error', error);
      return sendError(res, 500, 'Error checking permissions');
    }
  };
};

// ============ ROLE MIDDLEWARE ============

/**
 * التحقق من الدور المطلوب
 * @param {string|array} allowedRoles - الأدوار المسموح بها
 */
const checkRole = (allowedRoles = []) => {
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required');
      }

      const userRole = req.user.claims?.role || req.user.role || 'viewer';

      // Super Admin يمكنه الوصول لكل شيء
      if (userRole === 'super_admin') {
        return next();
      }

      if (!allowedRoles.includes(userRole)) {
        logger.warn('Role access denied', {
          userId: req.user.id,
          userRole,
          allowedRoles,
          path: req.path
        });

        return sendError(res, 403, 'Access denied. Required role: ' + allowedRoles.join(', '));
      }

      next();
    } catch (error) {
      logger.error('Role check error', error);
      return sendError(res, 500, 'Error checking role');
    }
  };
};

// ============ PERMISSION UTILITIES ============

/**
 * التحقق من صلاحية مستخدم معين
 */
const hasPermission = (user, permission) => {
  if (!user) return false;
  
  const userRole = user.claims?.role || user.role || 'viewer';
  const userPermissions = user.claims?.permissions || user.permissions || [];
  
  // Super Admin لديه كل الصلاحيات
  if (userRole === 'super_admin') return true;
  
  const rolePermissions = ROLES[userRole]?.permissions || [];
  const allPermissions = [...userPermissions, ...rolePermissions];
  
  return allPermissions.includes(permission);
};

/**
 * التحقق من صلاحيات متعددة
 */
const hasAllPermissions = (user, permissions) => {
  if (!user) return false;
  return permissions.every(p => hasPermission(user, p));
};

/**
 * التحقق من وجود أي صلاحية من المطلوبة
 */
const hasAnyPermission = (user, permissions) => {
  if (!user) return false;
  return permissions.some(p => hasPermission(user, p));
};

/**
 * الحصول على صلاحيات الدور
 */
const getRolePermissions = (role) => {
  return ROLES[role]?.permissions || [];
};

/**
 * الحصول على معلومات الدور
 */
const getRoleInfo = (role) => {
  return ROLES[role] || null;
};

/**
 * الحصول على جميع الأدوار المتاحة
 */
const getAllRoles = () => {
  return Object.keys(ROLES).map(key => ({
    name: key,
    displayName: ROLES[key].name,
    description: ROLES[key].description,
    permissionsCount: ROLES[key].permissions.length,
    isAdmin: ROLES[key].isAdmin
  }));
};

/**
 * الحصول على جميع الصلاحيات المتاحة
 */
const getAllPermissions = () => {
  return Object.values(PERMISSIONS);
};

/**
 * الحصول على الصلاحيات حسب الفئة
 */
const getPermissionsByCategory = () => {
  const categories = {};
  
  for (const [key, value] of Object.entries(PERMISSIONS)) {
    const category = key.split('_')[0];
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(value);
  }
  
  return categories;
};

// ============ PERMISSION MIDDLEWARE COMPOSER ============

/**
 * دمج عدة ميدلويرات صلاحيات
 */
const composePermissions = (...middlewares) => {
  return (req, res, next) => {
    let index = 0;
    
    const runNext = (err) => {
      if (err) {
        return next(err);
      }
      
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      middleware(req, res, runNext);
    };
    
    runNext();
  };
};

// ============ EXPORT ============

module.exports = {
  // Definitions
  PERMISSIONS,
  ROLES,
  
  // Middleware
  checkPermissions,
  checkRole,
  
  // Utilities
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  getRoleInfo,
  getAllRoles,
  getAllPermissions,
  getPermissionsByCategory,
  composePermissions
};