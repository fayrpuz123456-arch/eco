const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification.model');

// ===== GET - قائمة الإشعارات للمستخدم =====
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const { limit = 50, page = 1, status, type } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const result = await Notification.findByUser(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      status,
      type
    });

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

// ===== GET - الإشعارات غير المقروءة =====
router.get('/unread', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const notifications = await Notification.findUnread(userId);

    res.json({
      success: true,
      message: 'Unread notifications retrieved successfully',
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching unread notifications',
      error: error.message
    });
  }
});

// ===== GET - إحصائيات الإشعارات =====
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const stats = await Notification.getStats(userId);

    res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notification stats',
      error: error.message
    });
  }
});

// ===== POST - إنشاء إشعار جديد =====
router.post('/', async (req, res) => {
  try {
    const { userId, title, message, type, category, priority, channels, data, scheduledAt } = req.body;

    if (!userId || !title || !message || !type || !category) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, message, type, and category are required'
      });
    }

    const newNotification = new Notification({
      userId,
      companyId: req.companyId || 'comp_test_001',
      title,
      message,
      type,
      category,
      priority: priority || 'medium',
      channels: channels || { email: true, push: true, inApp: true },
      data: data || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isScheduled: !!scheduledAt,
      status: scheduledAt ? 'pending' : 'pending'
    });

    const savedNotification = await newNotification.save();

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: savedNotification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating notification',
      error: error.message
    });
  }
});

// ===== PUT - وضع علامة كمقروء =====
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
});

// ===== PUT - وضع علامة كمقروء للكل =====
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message
    });
  }
});

// ===== DELETE - حذف إشعار =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.deletedAt = new Date();
    notification.status = 'cancelled';
    await notification.save();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
});

module.exports = router;