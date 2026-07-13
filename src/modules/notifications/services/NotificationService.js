const BaseService = require('../../../core/base/BaseService');
const NotificationRepository = require('../repositories/NotificationRepository');
const {
  AppError,
  ValidationError,
  NotFoundError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');
const firebaseService = require('../../../config/firebase');

class NotificationService extends BaseService {
  constructor() {
    super(new NotificationRepository(), 'Notification');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createNotification(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['title', 'message', 'type', 'category', 'userId']);

      const notificationData = {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        companyId,
        status: 'pending'
      };

      // إذا كان مجدولاً
      if (data.scheduledAt) {
        notificationData.isScheduled = true;
        notificationData.status = 'pending';
      }

      const notification = await this.repository.create(notificationData);

      // إرسال فوري إذا لم يكن مجدولاً
      if (!notification.isScheduled) {
        await this.sendNotification(notification);
      }

      eventEmitter.emit('notification.created', {
        notificationId: notification._id,
        userId: notification.userId,
        type: notification.type,
        companyId
      });

      logger.info('Notification created successfully', {
        notificationId: notification._id,
        userId: notification.userId,
        type: notification.type
      });

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  // ============ SENDING ============

  async sendNotification(notification) {
    try {
      const promises = [];

      // إرسال بريد إلكتروني
      if (notification.channels.email) {
        promises.push(this.sendEmail(notification));
      }

      // إرسال Push Notification
      if (notification.channels.push) {
        promises.push(this.sendPush(notification));
      }

      // إرسال SMS
      if (notification.channels.sms) {
        promises.push(this.sendSMS(notification));
      }

      // إشعار داخل التطبيق
      if (notification.channels.inApp) {
        promises.push(this.sendInApp(notification));
      }

      // Webhook
      if (notification.channels.webhook) {
        promises.push(this.sendWebhook(notification));
      }

      await Promise.allSettled(promises);

      // تحديث الحالة
      notification.status = 'sent';
      await notification.save();

      // تحديث إحصائيات المستلمين
      if (notification.userId) {
        const user = await this.getUser(notification.userId);
        // تحديث إحصائيات المستخدم
      }

      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      notification.status = 'failed';
      await notification.save();
      throw error;
    }
  }

  async sendEmail(notification) {
    try {
      // TODO: تنفيذ إرسال البريد الإلكتروني
      // استخدام nodemailer أو خدمة مثل SendGrid
      logger.info('Email sent', {
        notificationId: notification._id,
        to: notification.recipients.emails
      });
      
      await this.repository.updateDeliveryStatus(
        notification._id,
        'email',
        'sent'
      );
    } catch (error) {
      await this.repository.updateDeliveryStatus(
        notification._id,
        'email',
        'failed',
        error.message
      );
      throw error;
    }
  }

  async sendPush(notification) {
    try {
      const tokens = notification.recipients.deviceTokens || [];
      
      if (tokens.length === 0) {
        logger.warn('No device tokens for push notification', {
          notificationId: notification._id
        });
        return;
      }

      // إرسال عبر Firebase Cloud Messaging
      await firebaseService.sendMulticastPushNotification(
        tokens,
        notification.title,
        notification.message,
        notification.data || {}
      );

      await this.repository.updateDeliveryStatus(
        notification._id,
        'push',
        'sent'
      );

      logger.info('Push notification sent', {
        notificationId: notification._id,
        devices: tokens.length
      });
    } catch (error) {
      await this.repository.updateDeliveryStatus(
        notification._id,
        'push',
        'failed',
        error.message
      );
      throw error;
    }
  }

  async sendSMS(notification) {
    try {
      // TODO: تنفيذ إرسال SMS
      // استخدام Twilio أو خدمة مماثلة
      logger.info('SMS sent', {
        notificationId: notification._id,
        to: notification.recipients.phones
      });
      
      await this.repository.updateDeliveryStatus(
        notification._id,
        'sms',
        'sent'
      );
    } catch (error) {
      await this.repository.updateDeliveryStatus(
        notification._id,
        'sms',
        'failed',
        error.message
      );
      throw error;
    }
  }

  async sendInApp(notification) {
    try {
      // الإشعار داخل التطبيق يتم عرضه فوراً
      await this.repository.updateDeliveryStatus(
        notification._id,
        'inApp',
        'sent'
      );

      // إرسال حدث عبر Socket.IO
      eventEmitter.emit('notification.in_app', {
        notificationId: notification._id,
        userId: notification.userId,
        data: notification.toPublicJSON()
      });

      logger.info('In-app notification sent', {
        notificationId: notification._id,
        userId: notification.userId
      });
    } catch (error) {
      await this.repository.updateDeliveryStatus(
        notification._id,
        'inApp',
        'failed',
        error.message
      );
      throw error;
    }
  }

  async sendWebhook(notification) {
    try {
      // TODO: تنفيذ إرسال Webhook
      logger.info('Webhook sent', {
        notificationId: notification._id
      });
      
      await this.repository.updateDeliveryStatus(
        notification._id,
        'webhook',
        'sent'
      );
    } catch (error) {
      await this.repository.updateDeliveryStatus(
        notification._id,
        'webhook',
        'failed',
        error.message
      );
      throw error;
    }
  }

  // ============ BULK SENDING ============

  async sendBulkNotifications(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['title', 'message', 'type', 'category', 'userIds']);

      const notifications = data.userIds.map(uId => ({
        ...data,
        userId: uId,
        createdBy: userId,
        updatedBy: userId,
        companyId,
        status: 'pending',
        channels: data.channels || { email: true, push: true, inApp: true }
      }));

      const created = await this.repository.bulkCreate(notifications);

      // إرسال الإشعارات
      for (const notification of created) {
        await this.sendNotification(notification);
      }

      logger.info('Bulk notifications sent', {
        count: created.length,
        companyId
      });

      return created;
    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  // ============ SCHEDULING ============

  async processScheduledNotifications() {
    try {
      const notifications = await this.repository.findScheduled();
      
      for (const notification of notifications) {
        await this.sendNotification(notification);
      }

      logger.info('Scheduled notifications processed', {
        count: notifications.length
      });

      return { processed: notifications.length };
    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getNotificationById(id, userId, companyId) {
    const notification = await this.repository.findById(id, companyId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }
    
    // التحقق من أن الإشعار مملوك للمستخدم
    if (notification.userId !== userId) {
      throw new AppError('Unauthorized', 403);
    }
    
    return notification;
  }

  async getUserNotifications(userId, options = {}) {
    return this.repository.findByUser(userId, options);
  }

  async getUnreadNotifications(userId) {
    return this.repository.findUnread(userId);
  }

  async getNotificationsByType(userId, type) {
    return this.repository.findByType(userId, type);
  }

  async getNotificationStats(userId) {
    return this.repository.getStats(userId);
  }

  // ============ UPDATE ============

  async markAsRead(id, userId, companyId) {
    try {
      const notification = await this.repository.findById(id, companyId);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }
      
      if (notification.userId !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const updated = await this.repository.markAsRead(id);

      eventEmitter.emit('notification.read', {
        notificationId: id,
        userId
      });

      return updated;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    const result = await this.repository.markAllAsRead(userId);

    eventEmitter.emit('notification.all_read', {
      userId
    });

    return result;
  }

  async addFeedback(id, rating, comment, userId, companyId) {
    try {
      const notification = await this.repository.findById(id, companyId);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }
      
      if (notification.userId !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      await notification.addFeedback(rating, comment);

      return notification;
    } catch (error) {
      logger.error('Error adding feedback:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteNotification(id, userId, companyId) {
    try {
      const notification = await this.repository.findById(id, companyId);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }
      
      if (notification.userId !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      await this.repository.softDelete(id, companyId);

      logger.info('Notification deleted', {
        notificationId: id,
        userId
      });

      return { message: 'Notification deleted successfully' };
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  async deleteAllNotifications(userId) {
    const result = await this.repository.bulkDelete([], userId);

    logger.info('All notifications deleted', {
      userId
    });

    return result;
  }

  // ============ EXPORT ============

  async exportNotifications(userId, startDate, endDate, format = 'json') {
    return this.repository.exportNotifications(userId, startDate, endDate, format);
  }

  // ============ HELPER ============

  async getUser(userId) {
    // TODO: جلب بيانات المستخدم
    return { id: userId };
  }
}

module.exports = NotificationService;