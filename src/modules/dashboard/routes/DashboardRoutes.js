const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const Dashboard = require('../models/Dashboard.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, PERMISSIONS } = require('../../../core/middleware/permissions');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

const controller = new DashboardController();

// ✅ استخدم الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - إحصائيات لوحات التحكم =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
router.get('/stats', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.getStats(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard stats route:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - لوحة التحكم الافتراضية =====
// ✅ لازم يكون قبل /:id عشان منتصادش معاه
router.get('/default', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.getDefault(req, res);
  } catch (error) {
    logger.error('❌ Error in default dashboard route:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving default dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - قائمة لوحات التحكم =====
router.get('/', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.getList(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard list route:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboards',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - لوحة تحكم بالمعرف =====
// ✅ لازم يكون في الآخر عشان منتصادش مع الـ Routes التانية
router.get('/:id', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.getById(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard get by id route:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء لوحة تحكم جديدة =====
router.post('/', checkPermissions([PERMISSIONS.DASHBOARD_CREATE]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (req.body.companyId && req.body.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot create dashboards for another company'
      });
    }

    // ✅ التحقق من عدم وجود لوحة تحكم بنفس الاسم للمستخدم
    const existingDashboard = await Dashboard.findOne({
      name: req.body.name,
      userId: userId,
      companyId: companyId,
      deletedAt: null
    });

    if (existingDashboard) {
      return res.status(409).json({
        success: false,
        message: 'Dashboard with this name already exists'
      });
    }

    // ✅ التحقق من وجود لوحة تحكم افتراضية بالفعل لو isDefault: true
    if (req.body.settings?.isDefault) {
      const defaultDashboard = await Dashboard.findOne({
        userId: userId,
        companyId: companyId,
        'settings.isDefault': true,
        deletedAt: null
      });

      if (defaultDashboard) {
        return res.status(409).json({
          success: false,
          message: 'A default dashboard already exists. Please set isDefault to false or unset the existing default first.'
        });
      }
    }

    req.body.companyId = companyId;
    req.body.userId = userId;

    await controller.create(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard create route:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث لوحة تحكم =====
router.put('/:id', checkPermissions([PERMISSIONS.DASHBOARD_UPDATE]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    // ✅ التأكد من أن المستخدم لديه صلاحية التحديث
    const dashboard = await Dashboard.findOne({
      _id: req.params.id,
      companyId: companyId,
      userId: userId,
      deletedAt: null
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    // ✅ منع تحديث companyId
    delete req.body.companyId;
    delete req.body.userId;
    delete req.body.createdBy;

    // ✅ منع تحديث isDefault إذا كان هناك لوحة افتراضية أخرى
    if (req.body.settings?.isDefault === true) {
      const defaultDashboard = await Dashboard.findOne({
        _id: { $ne: req.params.id },
        userId: userId,
        companyId: companyId,
        'settings.isDefault': true,
        deletedAt: null
      });

      if (defaultDashboard) {
        return res.status(409).json({
          success: false,
          message: 'Another default dashboard already exists. Please set isDefault to false or unset the existing default first.'
        });
      }
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.update(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard update route:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تعيين لوحة تحكم كافتراضية =====
router.put('/:id/default', checkPermissions([PERMISSIONS.DASHBOARD_UPDATE]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const userRole = req.user?.role || 'viewer';
    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators and managers can set default dashboards.'
      });
    }

    // ✅ إلغاء تعيين الافتراضية من جميع لوحات التحكم
    await Dashboard.updateMany(
      { userId: userId, companyId: companyId, deletedAt: null },
      { 'settings.isDefault': false }
    );

    // ✅ تعيين الافتراضية للوحة المحددة
    const dashboard = await Dashboard.findOneAndUpdate(
      { _id: req.params.id, userId: userId, companyId: companyId, deletedAt: null },
      { 
        'settings.isDefault': true,
        updatedBy: userId,
        updatedAt: new Date()
      },
      { returnDocument: 'after' }
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.setDefault(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard set default route:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - نسخ لوحة تحكم =====
router.post('/:id/copy', checkPermissions([PERMISSIONS.DASHBOARD_CREATE]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const originalDashboard = await Dashboard.findOne({
      _id: req.params.id,
      companyId: companyId,
      userId: userId,
      deletedAt: null
    });

    if (!originalDashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    req.body.companyId = companyId;
    req.body.userId = userId;
    req.body.name = `${originalDashboard.name} (Copy)`;
    req.body.copyFrom = req.params.id;

    await controller.copy(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard copy route:', error);
    res.status(500).json({
      success: false,
      message: 'Error copying dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف لوحة تحكم =====
router.delete('/:id', checkPermissions([PERMISSIONS.DASHBOARD_DELETE]), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    const dashboard = await Dashboard.findOne({
      _id: req.params.id,
      companyId: companyId,
      userId: userId,
      deletedAt: null
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    if (dashboard.settings?.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default dashboard. Please set another dashboard as default first.'
      });
    }

    req.query.companyId = companyId;
    req.query.userId = userId;

    await controller.delete(req, res);
  } catch (error) {
    logger.error('❌ Error in dashboard delete route:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;