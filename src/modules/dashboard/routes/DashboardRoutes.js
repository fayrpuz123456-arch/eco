const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, PERMISSIONS } = require('../../../core/middleware/permissions');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

const controller = new DashboardController();

// ✅ استخدم الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة لوحات التحكم =====
router.get('/', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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

// ===== GET - لوحة التحكم الافتراضية =====
router.get('/default', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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

// ===== GET - لوحة تحكم بالمعرف =====
router.get('/:id', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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
    // ✅ استخدام getCompanyId من الـ Helper
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

    // التأكد من أن companyId في الـ Body مطابق للـ companyId من الـ Auth
    // (لأغراض أمنية، منع إنشاء لوحات تحكم لشركات أخرى)
    if (req.body.companyId && req.body.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot create dashboards for another company'
      });
    }

    // إضافة companyId إلى req.body للـ Controller
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
    // ✅ استخدام getCompanyId من الـ Helper
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

    // منع تحديث companyId
    delete req.body.companyId;

    // إضافة companyId إلى req.query للـ Controller
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
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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

// ===== DELETE - حذف لوحة تحكم =====
router.delete('/:id', checkPermissions([PERMISSIONS.DASHBOARD_DELETE]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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

// ===== POST - نسخ لوحة تحكم =====
router.post('/:id/copy', checkPermissions([PERMISSIONS.DASHBOARD_CREATE]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.body للـ Controller
    req.body.companyId = companyId;
    req.body.userId = userId;

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

// ===== GET - إحصائيات لوحات التحكم =====
router.get('/stats', checkPermissions([PERMISSIONS.DASHBOARD_VIEW]), async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
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

    // إضافة companyId إلى req.query للـ Controller
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

module.exports = router;