const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * نظام الأحداث المركزي
 * Central Event System for EcoGuardian
 */
class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.eventLog = [];
    this.maxLogSize = 10000;
    this.isDebugMode = process.env.NODE_ENV === 'development';
  }

  /**
   * إرسال حدث
   */
  emit(event, data) {
    // تسجيل الحدث
    const eventData = {
      event,
      data,
      timestamp: new Date().toISOString(),
      id: this.generateEventId()
    };

    // إضافة إلى سجل الأحداث
    this.eventLog.push(eventData);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // تسجيل في الـ Logger في وضع التطوير
    if (this.isDebugMode) {
      logger.debug(`Event emitted: ${event}`, {
        eventId: eventData.id,
        data: JSON.stringify(data).substring(0, 200)
      });
    }

    // إرسال الحدث
    return super.emit(event, data);
  }

  /**
   * إرسال حدث بطريقة غير متزامنة
   */
  async emitAsync(event, data) {
    return new Promise((resolve, reject) => {
      try {
        const result = this.emit(event, data);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * الاستماع لحدث معين
   */
  on(event, listener) {
    if (this.isDebugMode) {
      logger.debug(`Event listener registered: ${event}`);
    }
    return super.on(event, listener);
  }

  /**
   * الاستماع لحدث معين مرة واحدة
   */
  once(event, listener) {
    if (this.isDebugMode) {
      logger.debug(`One-time event listener registered: ${event}`);
    }
    return super.once(event, listener);
  }

  /**
   * إزالة مستمع حدث
   */
  off(event, listener) {
    if (this.isDebugMode) {
      logger.debug(`Event listener removed: ${event}`);
    }
    return super.off(event, listener);
  }

  /**
   * الحصول على سجل الأحداث
   */
  getEventHistory(filter = {}) {
    let history = this.eventLog;
    
    if (filter.event) {
      history = history.filter(e => e.event === filter.event);
    }
    
    if (filter.from) {
      history = history.filter(e => new Date(e.timestamp) >= new Date(filter.from));
    }
    
    if (filter.to) {
      history = history.filter(e => new Date(e.timestamp) <= new Date(filter.to));
    }
    
    if (filter.limit) {
      history = history.slice(-filter.limit);
    }
    
    return history;
  }

  /**
   * الحصول على إحصائيات الأحداث
   */
  getEventStats() {
    const stats = {
      total: this.eventLog.length,
      byEvent: {},
      byTime: {
        lastHour: 0,
        lastDay: 0,
        lastWeek: 0
      }
    };

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const entry of this.eventLog) {
      const timestamp = new Date(entry.timestamp);
      
      // إحصائيات حسب النوع
      stats.byEvent[entry.event] = (stats.byEvent[entry.event] || 0) + 1;
      
      // إحصائيات حسب الوقت
      if (timestamp >= hourAgo) stats.byTime.lastHour++;
      if (timestamp >= dayAgo) stats.byTime.lastDay++;
      if (timestamp >= weekAgo) stats.byTime.lastWeek++;
    }

    return stats;
  }

  /**
   * مسح سجل الأحداث
   */
  clearHistory() {
    const count = this.eventLog.length;
    this.eventLog = [];
    logger.debug(`Event history cleared (${count} events)`);
    return count;
  }

  /**
   * توليد معرف فريد للحدث
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * انتظار حدث معين
   */
  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(event, listener);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const listener = (data) => {
        clearTimeout(timeoutId);
        this.off(event, listener);
        resolve(data);
      };

      this.once(event, listener);
    });
  }

  /**
   * الحصول على عدد المستمعين لحدث
   */
  listenerCount(event) {
    return super.listenerCount(event);
  }

  /**
   * الحصول على جميع المستمعين لحدث
   */
  listeners(event) {
    return super.listeners(event);
  }

  /**
   * إزالة جميع المستمعين لحدث
   */
  removeAllListeners(event) {
    if (this.isDebugMode) {
      logger.debug(`All listeners removed for event: ${event}`);
    }
    return super.removeAllListeners(event);
  }
}

// إنشاء نسخة واحدة من نظام الأحداث
const eventEmitter = new AppEventEmitter();

// تصدير نظام الأحداث وأنواع الأحداث
module.exports = {
  eventEmitter,
  EventTypes: require('./eventTypes')
}; 
