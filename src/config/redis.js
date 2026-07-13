const Redis = require('redis');
const config = require('./index');
const logger = require('../core/utils/logger');
const { eventEmitter, EventTypes } = require('../core/events/eventEmitter');

/**
 * خدمة Redis - مسؤولة عن التخزين المؤقت وإدارة الجلسات
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultExpiry = 3600; // ساعة واحدة
  }

  /**
   * تهيئة اتصال Redis
   */
  initialize() {
    try {
      const redisConfig = {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      };

      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      this.client = Redis.createClient(redisConfig);

      // أحداث الاتصال
      this.client.on('connect', this.onConnect.bind(this));
      this.client.on('ready', this.onReady.bind(this));
      this.client.on('error', this.onError.bind(this));
      this.client.on('end', this.onEnd.bind(this));
      this.client.on('reconnecting', this.onReconnecting.bind(this));

      // في الإصدارات الجديدة من Redis
      if (this.client.connect) {
        this.client.connect();
      }

      logger.info(`Redis client initialized, host: ${config.redis.host}:${config.redis.port}`);

    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  /**
   * عند الاتصال
   */
  onConnect() {
    logger.info('Redis connected');
  }

  /**
   * عند الجاهزية
   */
  onReady() {
    this.isConnected = true;
    logger.info('Redis ready');
    
    eventEmitter.emit('cache.connected', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند حدوث خطأ
   */
  onError(error) {
    this.isConnected = false;
    logger.error('Redis error:', error);
    
    eventEmitter.emit(EventTypes.CACHE_ERROR, {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند انتهاء الاتصال
   */
  onEnd() {
    this.isConnected = false;
    logger.warn('Redis connection ended');
  }

  /**
   * عند إعادة الاتصال
   */
  onReconnecting() {
    logger.info('Redis reconnecting...');
  }

  // ============ BASIC OPERATIONS ============

  /**
   * الحصول على قيمة
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected');
        return null;
      }

      const value = await this.client.get(key);
      
      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * تخزين قيمة
   */
  async set(key, value, expiry = this.defaultExpiry) {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected');
        return false;
      }

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (expiry > 0) {
        await this.client.setEx(key, expiry, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * حذف قيمة
   */
  async delete(key) {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected');
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * التحقق من وجود قيمة
   */
  async exists(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * الحصول على وقت انتهاء الصلاحية
   */
  async ttl(key) {
    try {
      if (!this.isConnected) {
        return -2;
      }

      return this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis ttl error for key ${key}:`, error);
      return -2;
    }
  }

  // ============ BULK OPERATIONS ============

  /**
   * الحصول على قيم متعددة
   */
  async mget(keys) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const values = await this.client.mGet(keys);
      return values.map(v => {
        if (v) {
          try { return JSON.parse(v); } catch { return v; }
        }
        return null;
      });
    } catch (error) {
      logger.error('Redis mget error:', error);
      return [];
    }
  }

  /**
   * تخزين قيم متعددة
   */
  async mset(keyValuePairs, expiry = this.defaultExpiry) {
    try {
      if (!this.isConnected) {
        return false;
      }

      // تحويل إلى مصفوفة مسطحة
      const flatPairs = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        flatPairs.push(key);
        flatPairs.push(typeof value === 'string' ? value : JSON.stringify(value));
      }

      await this.client.mSet(flatPairs);
      
      // تعيين وقت الانتهاء لكل مفتاح
      if (expiry > 0) {
        for (const key of Object.keys(keyValuePairs)) {
          await this.client.expire(key, expiry);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Redis mset error:', error);
      return false;
    }
  }

  // ============ HASH OPERATIONS ============

  /**
   * تخزين في Hash
   */
  async hset(key, field, value) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.hSet(key, field, stringValue);
      return true;
    } catch (error) {
      logger.error(`Redis hset error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * الحصول من Hash
   */
  async hget(key, field) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.hGet(key, field);
      if (value) {
        try { return JSON.parse(value); } catch { return value; }
      }
      return null;
    } catch (error) {
      logger.error(`Redis hget error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * الحصول على كل Hash
   */
  async hgetall(key) {
    try {
      if (!this.isConnected) {
        return {};
      }

      const result = await this.client.hGetAll(key);
      const parsed = {};
      for (const [field, value] of Object.entries(result)) {
        try { parsed[field] = JSON.parse(value); } catch { parsed[field] = value; }
      }
      return parsed;
    } catch (error) {
      logger.error(`Redis hgetall error for key ${key}:`, error);
      return {};
    }
  }

  // ============ LIST OPERATIONS ============

  /**
   * إضافة إلى قائمة
   */
  async lpush(key, value) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return this.client.lPush(key, stringValue);
    } catch (error) {
      logger.error(`Redis lpush error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * الحصول من قائمة
   */
  async lrange(key, start = 0, stop = -1) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const values = await this.client.lRange(key, start, stop);
      return values.map(v => {
        try { return JSON.parse(v); } catch { return v; }
      });
    } catch (error) {
      logger.error(`Redis lrange error for key ${key}:`, error);
      return [];
    }
  }

  // ============ SET OPERATIONS ============

  /**
   * إضافة إلى مجموعة
   */
  async sadd(key, value) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.sAdd(key, stringValue);
      return true;
    } catch (error) {
      logger.error(`Redis sadd error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * الحصول من مجموعة
   */
  async smembers(key) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const values = await this.client.sMembers(key);
      return values.map(v => {
        try { return JSON.parse(v); } catch { return v; }
      });
    } catch (error) {
      logger.error(`Redis smembers error for key ${key}:`, error);
      return [];
    }
  }

  // ============ PUB/SUB ============

  /**
   * نشر رسالة
   */
  async publish(channel, message) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      await this.client.publish(channel, payload);
      return true;
    } catch (error) {
      logger.error(`Redis publish error on channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * الاشتراك في قناة
   */
  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch {
          callback(message);
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`Redis subscribe error on channel ${channel}:`, error);
      return false;
    }
  }

  // ============ SESSION ============

  /**
   * تخزين جلسة مستخدم
   */
  async setSession(userId, sessionData, expiry = 86400) { // 24 ساعة
    return this.set(`session:${userId}`, sessionData, expiry);
  }

  /**
   * الحصول على جلسة مستخدم
   */
  async getSession(userId) {
    return this.get(`session:${userId}`);
  }

  /**
   * حذف جلسة مستخدم
   */
  async deleteSession(userId) {
    return this.delete(`session:${userId}`);
  }

  // ============ CACHE ============

  /**
   * تخزين مؤقت لبيانات API
   */
  async cacheApiResponse(key, data, expiry = 300) { // 5 دقائق
    return this.set(`api:${key}`, data, expiry);
  }

  /**
   * الحصول على بيانات API مخزنة
   */
  async getApiResponse(key) {
    return this.get(`api:${key}`);
  }

  // ============ CLEANUP ============

  /**
   * مسح جميع البيانات
   */
  async flushAll() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushAll();
      logger.info('Redis flush all completed');
      return true;
    } catch (error) {
      logger.error('Redis flush all error:', error);
      return false;
    }
  }

  /**
   * إغلاق الاتصال
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }

  /**
   * التحقق من الاتصال
   */
  isConnectedToRedis() {
    return this.isConnected;
  }

  /**
   * الحصول على إحصائيات
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return null;
      }

      const info = await this.client.info();
      return {
        isConnected: this.isConnected,
        info: info.split('\n').reduce((acc, line) => {
          const parts = line.split(':');
          if (parts.length === 2) {
            acc[parts[0]] = parts[1];
          }
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Redis get stats error:', error);
      return null;
    }
  }
}

// إنشاء نسخة واحدة من الخدمة
const redisService = new RedisService();

module.exports = redisService; 
