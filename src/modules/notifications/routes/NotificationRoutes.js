const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة الإشعارات للمستخدم =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const { limit = 50, page = 1, status, type } = req.query;

    const result = await Notification.findByUser(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      status,
      type,
      companyId // ✅ إضافة companyId للفلترة
    });

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    logger.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - الإشعارات غير المقروءة =====
router.get('/unread', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const notifications = await Notification.findUnread(userId, companyId);

    res.json({
      success: true,
      message: 'Unread notifications retrieved successfully',
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    logger.error('❌ Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - إحصائيات الإشعارات =====
router.get('/stats', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const stats = await Notification.getStats(userId, companyId);

    res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('❌ Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification stats',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء إشعار جديد =====
router.post('/', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ التحقق من صحة companyId
    if (!companyId.startsWith('comp_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must start with "comp_"'
      });
    }

    const {
      userId: targetUserId,
      title,
      message,
      body,
      type,
      category,
      priority,
      channels,
      data,
      scheduledAt,
      expiresAt,
      template,
      tags,
      actions
    } = req.body;

    if (!targetUserId || !title || !message || !type || !category) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, message, type, and category are required'
      });
    }

    const newNotification = new Notification({
      companyId, // ✅ استخدام companyId الصحيح
      userId: targetUserId,
      createdBy: userId,
      updatedBy: userId,
      title: title.trim(),
      message: message.trim(),
      body: body || null,
      type,
      category,
      priority: priority || 'medium',
      channels: channels || { email: true, push: true, inApp: true },
      data: data || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isScheduled: !!scheduledAt,
      template: template || {
        id: null,
        name: null,
        version: null
      },
      tags: tags || [],
      actions: actions || [],
      status: scheduledAt ? 'scheduled' : 'pending'
    });

    const savedNotification = await newNotification.save();

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: savedNotification
    });
  } catch (error) {
    logger.error('❌ Error creating notification:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - وضع علامة كمقروء =====
router.put('/:id/read', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      companyId,
      userId,
      deletedAt: null
    });

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
    logger.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - وضع علامة كمقروء للكل =====
router.put('/read-all', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user?.id || req.body.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    await Notification.markAllAsRead(userId, companyId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث حالة الإشعار =====
router.put('/:id/status', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const { action } = req.body; // 'read', 'seen', 'dismiss'

    const notification = await Notification.findOne({
      _id: id,
      companyId,
      userId,
      deletedAt: null
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    switch (action) {
      case 'read':
        notification.readAt = new Date();
        notification.status = 'read';
        if (notification.delivery && notification.delivery.inApp) {
          notification.delivery.inApp.readAt = new Date();
          notification.delivery.inApp.status = 'read';
        }
        break;
      case 'seen':
        notification.seenAt = new Date();
        break;
      case 'dismiss':
        notification.status = 'dismissed';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Must be "read", "seen", or "dismiss"'
        });
    }

    notification.updatedAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: `Notification ${action} successfully`,
      data: notification
    });
  } catch (error) {
    logger.error('❌ Error updating notification status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف إشعار (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      companyId,
      userId,
      deletedAt: null
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.deletedAt = new Date();
    notification.deletedBy = userId;
    notification.status = 'cancelled';
    await notification.save();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;