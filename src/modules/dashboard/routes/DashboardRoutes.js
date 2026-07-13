const express = require('express');
const router = express.Router();
const Dashboard = require('../models/Dashboard.model');

// ===== GET - قائمة لوحات التحكم =====
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const companyId = req.companyId || 'comp_test_001';

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const dashboards = await Dashboard.find({ userId, companyId, deletedAt: null })
      .sort({ 'settings.pinned': -1, createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      message: 'Dashboards retrieved successfully',
      data: dashboards,
      count: dashboards.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboards',
      error: error.message
    });
  }
});

// ===== GET - لوحة التحكم الافتراضية =====
router.get('/default', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const companyId = req.companyId || 'comp_test_001';

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    let dashboard = await Dashboard.findOne({
      userId,
      companyId,
      'settings.isDefault': true,
      deletedAt: null
    });

    // لو مفيش لوحة افتراضية، أنشئ واحدة
    if (!dashboard) {
      dashboard = new Dashboard({
        userId,
        companyId,
        name: 'My Dashboard',
        type: 'overview',
        settings: { isDefault: true },
        widgets: [
          {
            id: 'widget_1',
            type: 'kpi',
            title: 'Total Sensors',
            size: { width: 2, height: 1 },
            position: { x: 0, y: 0 },
            data: { value: 0, icon: 'sensors' }
          },
          {
            id: 'widget_2',
            type: 'kpi',
            title: 'Active Alerts',
            size: { width: 2, height: 1 },
            position: { x: 2, y: 0 },
            data: { value: 0, icon: 'alerts' }
          }
        ]
      });
      await dashboard.save();
    }

    res.json({
      success: true,
      message: 'Default dashboard retrieved successfully',
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching default dashboard',
      error: error.message
    });
  }
});

// ===== GET - لوحة تحكم بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await Dashboard.findById(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    res.json({
      success: true,
      message: 'Dashboard retrieved successfully',
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard',
      error: error.message
    });
  }
});

// ===== POST - إنشاء لوحة تحكم جديدة =====
router.post('/', async (req, res) => {
  try {
    const { name, type, layout, widgets, preferences, settings } = req.body;
    const userId = req.user?.id || req.body.userId;
    const companyId = req.companyId || 'comp_test_001';

    if (!userId || !name || !type) {
      return res.status(400).json({
        success: false,
        message: 'userId, name, and type are required'
      });
    }

    const newDashboard = new Dashboard({
      userId,
      companyId,
      name,
      type: type || 'overview',
      layout: layout || 'grid',
      widgets: widgets || [],
      preferences: preferences || { refreshRate: 30, autoRefresh: true },
      settings: {
        isDefault: settings?.isDefault || false,
        pinned: settings?.pinned || false,
        tags: settings?.tags || []
      }
    });

    const savedDashboard = await newDashboard.save();

    res.status(201).json({
      success: true,
      message: 'Dashboard created successfully',
      data: savedDashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating dashboard',
      error: error.message
    });
  }
});

// ===== PUT - تحديث لوحة تحكم =====
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, layout, widgets, preferences, settings } = req.body;
    const dashboard = await Dashboard.findById(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    if (name) dashboard.name = name;
    if (layout) dashboard.layout = layout;
    if (widgets) dashboard.widgets = widgets;
    if (preferences) dashboard.preferences = preferences;
    if (settings) dashboard.settings = { ...dashboard.settings, ...settings };

    const updatedDashboard = await dashboard.save();

    res.json({
      success: true,
      message: 'Dashboard updated successfully',
      data: updatedDashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating dashboard',
      error: error.message
    });
  }
});

// ===== PUT - تعيين لوحة تحكم كافتراضية =====
router.put('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.userId;
    const companyId = req.companyId || 'comp_test_001';

    // إزالة الافتراضي من كل اللوحات
    await Dashboard.updateMany(
      { userId, companyId, 'settings.isDefault': true },
      { 'settings.isDefault': false }
    );

    // تعيين الافتراضي للوحة الحالية
    const dashboard = await Dashboard.findByIdAndUpdate(
      id,
      { 'settings.isDefault': true },
      { new: true }
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    res.json({
      success: true,
      message: 'Default dashboard set successfully',
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error setting default dashboard',
      error: error.message
    });
  }
});

// ===== DELETE - حذف لوحة تحكم =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await Dashboard.findById(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    dashboard.deletedAt = new Date();
    await dashboard.save();

    res.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting dashboard',
      error: error.message
    });
  }
});

module.exports = router;