const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, PERMISSIONS } = require('../../../core/middleware/permissions');

const controller = new DashboardController();

// ✅ استخدم الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة لوحات التحكم =====
router.get('/', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), controller.getList.bind(controller));

// ===== GET - لوحة التحكم الافتراضية =====
router.get('/default', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), controller.getDefault.bind(controller));

// ===== GET - لوحة تحكم بالمعرف =====
router.get('/:id', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), controller.getById.bind(controller));

// ===== POST - إنشاء لوحة تحكم جديدة =====
router.post('/', checkPermissions([PERMISSIONS.DASHBOARD_CREATE]), controller.create.bind(controller));

// ===== PUT - تحديث لوحة تحكم =====
router.put('/:id', checkPermissions([PERMISSIONS.DASHBOARD_UPDATE]), controller.update.bind(controller));

// ===== PUT - تعيين لوحة تحكم كافتراضية =====
router.put('/:id/default', checkPermissions([PERMISSIONS.DASHBOARD_UPDATE]), controller.setDefault.bind(controller));

// ===== DELETE - حذف لوحة تحكم =====
router.delete('/:id', checkPermissions([PERMISSIONS.DASHBOARD_DELETE]), controller.delete.bind(controller));

module.exports = router;