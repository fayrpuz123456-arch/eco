const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة الإشعارات للمستخدم =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const { limit = 50, page = 1, status, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { 
      userId,
      companyId,
      deletedAt: null 
    };
    if (status) query.status = status;
    if (type) query.type = type;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Notification.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      count: notifications.length,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + notifications.length < total,
        hasPrev: parseInt(page) > 1
      }
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
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const notifications = await Notification.find({
      userId,
      companyId,
      status: { $in: ['pending', 'sent'] },
      readAt: null,
      deletedAt: null
    }).sort({ createdAt: -1 }).select('-__v');

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
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id || req.query.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const [total, unread, read, dismissed, scheduled] = await Promise.all([
      Notification.countDocuments({ userId, companyId, deletedAt: null }),
      Notification.countDocuments({ 
        userId, 
        companyId, 
        status: { $in: ['pending', 'sent'] },
        readAt: null,
        deletedAt: null 
      }),
      Notification.countDocuments({ 
        userId, 
        companyId, 
        status: 'read',
        readAt: { $ne: null },
        deletedAt: null 
      }),
      Notification.countDocuments({ 
        userId, 
        companyId, 
        status: 'dismissed',
        deletedAt: null 
      }),
      Notification.countDocuments({ 
        userId, 
        companyId, 
        status: 'scheduled',
        scheduledAt: { $gt: new Date() },
        deletedAt: null 
      })
    ]);

    // توزيع الإشعارات حسب النوع
    const byType = await Notification.aggregate([
      { $match: { userId, companyId, deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        total,
        unread,
        read,
        dismissed,
        scheduled,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
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
      companyId,
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

    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      userId,
      companyId,
      deletedAt: null
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.readAt = new Date();
    notification.status = 'read';
    if (notification.delivery && notification.delivery.inApp) {
      notification.delivery.inApp.readAt = new Date();
      notification.delivery.inApp.status = 'read';
    }
    notification.updatedAt = new Date();
    await notification.save();

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
    // ✅ استخدام getCompanyId من الـ Helper
    const companyId = getCompanyId(req);
    const userId = req.user?.id || req.body.userId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
      });
    }

    if (!isValidCompanyId(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
        received: companyId
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    await Notification.updateMany(
      { userId, companyId, readAt: null, deletedAt: null },
      { 
        $set: { 
          readAt: new Date(), 
          status: 'read',
          updatedAt: new Date()
        }
      }
    );

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

    const { id } = req.params;
    const { action } = req.body; // 'read', 'seen', 'dismiss'

    const notification = await Notification.findOne({
      _id: id,
      userId,
      companyId,
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

    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      userId,
      companyId,
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