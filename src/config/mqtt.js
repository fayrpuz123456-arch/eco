const mqtt = require('mqtt');
const config = require('./index');
const logger = require('../core/utils/logger');
const { eventEmitter, EventTypes } = require('../core/events/eventEmitter');

/**
 * خدمة MQTT - مسؤولة عن الاتصال بخادم MQTT واستقبال البيانات من الحساسات
 */
class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.topics = [];
    this.retryCount = 0;
    this.maxRetries = 5;
    this.reconnectDelay = 5000;
  }

  /**
   * تهيئة اتصال MQTT
   */
  initialize() {
    try {
      const options = {
        clientId: config.mqtt.clientId || `ecoguardian_${Date.now()}`,
        username: config.mqtt.username,
        password: config.mqtt.password,
        clean: true,
        reconnectPeriod: this.reconnectDelay,
        connectTimeout: 30000,
        keepalive: 60,
        will: {
          topic: 'ecoguardian/status',
          payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
          qos: 1,
          retain: true
        }
      };

      this.client = mqtt.connect(config.mqtt.broker, options);

      // أحداث الاتصال
      this.client.on('connect', this.onConnect.bind(this));
      this.client.on('close', this.onClose.bind(this));
      this.client.on('error', this.onError.bind(this));
      this.client.on('message', this.onMessage.bind(this));
      this.client.on('reconnect', this.onReconnect.bind(this));
      this.client.on('offline', this.onOffline.bind(this));

      logger.info(`MQTT client initialized, broker: ${config.mqtt.broker}`);
    } catch (error) {
      logger.error('Failed to initialize MQTT client:', error);
      throw error;
    }
  }

  /**
   * عند الاتصال بالخادم
   */
  onConnect() {
    this.isConnected = true;
    this.retryCount = 0;
    
    logger.info('MQTT connected successfully');
    
    // إرسال حدث
    eventEmitter.emit(EventTypes.MQTT_CONNECTED, {
      broker: config.mqtt.broker,
      clientId: config.mqtt.clientId,
      timestamp: new Date().toISOString()
    });

    // إعادة الاشتراك في المواضيع
    this.subscribeAllTopics();
  }

  /**
   * عند إغلاق الاتصال
   */
  onClose() {
    this.isConnected = false;
    logger.warn('MQTT connection closed');
    
    eventEmitter.emit(EventTypes.MQTT_DISCONNECTED, {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند حدوث خطأ
   */
  onError(error) {
    logger.error('MQTT error:', error);
    
    eventEmitter.emit(EventTypes.MQTT_ERROR, {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند إعادة الاتصال
   */
  onReconnect() {
    logger.info('MQTT reconnecting...');
    this.retryCount++;
    
    if (this.retryCount > this.maxRetries) {
      logger.error(`MQTT max retries (${this.maxRetries}) exceeded`);
      this.client.end();
    }
  }

  /**
   * عند فقدان الاتصال
   */
  onOffline() {
    this.isConnected = false;
    logger.warn('MQTT offline');
  }

  /**
   * عند استقبال رسالة
   */
  onMessage(topic, message) {
    try {
      const payload = message.toString();
      let data = payload;
      
      // محاولة تحويل الـ JSON
      try {
        data = JSON.parse(payload);
      } catch (e) {
        // إذا لم يكن JSON، نستخدم النص كما هو
        data = payload;
      }

      logger.debug('MQTT message received', { topic, data: typeof data === 'string' ? data.substring(0, 200) : data });

      // إرسال حدث
      eventEmitter.emit(EventTypes.MQTT_MESSAGE_RECEIVED, {
        topic,
        data,
        timestamp: new Date().toISOString()
      });

      // معالجة الرسالة حسب الموضوع
      this.processMessage(topic, data);

    } catch (error) {
      logger.error('Error processing MQTT message:', error);
    }
  }

  /**
   * معالجة الرسالة حسب الموضوع
   */
  processMessage(topic, data) {
    // تحليل الموضوع
    // التنسيق المتوقع: ecoguardian/companyId/factoryId/machineId/sensorType
    const parts = topic.split('/');
    
    if (parts.length >= 5 && parts[0] === 'ecoguardian') {
      const [prefix, companyId, factoryId, machineId, sensorType] = parts;
      
      // إرسال حدث مع البيانات المستخرجة
      eventEmitter.emit('sensor.data.raw', {
        companyId,
        factoryId,
        machineId,
        sensorType,
        data,
        topic,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * الاشتراك في موضوع
   */
  subscribe(topic, options = { qos: 1 }) {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot subscribe: MQTT not connected');
      this.topics.push({ topic, options });
      return;
    }

    this.client.subscribe(topic, options, (error) => {
      if (error) {
        logger.error(`Failed to subscribe to ${topic}:`, error);
      } else {
        logger.info(`Subscribed to ${topic}`);
        if (!this.topics.find(t => t.topic === topic)) {
          this.topics.push({ topic, options });
        }
      }
    });
  }

  /**
   * إلغاء الاشتراك من موضوع
   */
  unsubscribe(topic) {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot unsubscribe: MQTT not connected');
      return;
    }

    this.client.unsubscribe(topic, (error) => {
      if (error) {
        logger.error(`Failed to unsubscribe from ${topic}:`, error);
      } else {
        logger.info(`Unsubscribed from ${topic}`);
        this.topics = this.topics.filter(t => t.topic !== topic);
      }
    });
  }

  /**
   * الاشتراك في جميع المواضيع المحفوظة
   */
  subscribeAllTopics() {
    for (const topic of this.topics) {
      this.subscribe(topic.topic, topic.options);
    }
  }

  /**
   * نشر رسالة
   */
  publish(topic, message, options = { qos: 1, retain: false }) {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot publish: MQTT not connected');
      return false;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    this.client.publish(topic, payload, options, (error) => {
      if (error) {
        logger.error(`Failed to publish to ${topic}:`, error);
      } else {
        logger.debug(`Published to ${topic}`);
        eventEmitter.emit(EventTypes.MQTT_MESSAGE_PUBLISHED, {
          topic,
          timestamp: new Date().toISOString()
        });
      }
    });

    return true;
  }

  /**
   * الاشتراك في مواضيع الحساسات
   */
  subscribeToSensors(companyId, factoryId = '+', machineId = '+', sensorType = '+') {
    const topic = `ecoguardian/${companyId}/${factoryId}/${machineId}/${sensorType}`;
    this.subscribe(topic);
    return topic;
  }

  /**
   * الاشتراك في مواضيع الحساسات لشركة كاملة
   */
  subscribeToCompany(companyId) {
    const topic = `ecoguardian/${companyId}/+/+/+`;
    this.subscribe(topic);
    return topic;
  }

  /**
   * إرسال حالة التشغيل
   */
  sendStatus(status = 'online') {
    this.publish('ecoguardian/status', {
      status,
      timestamp: new Date().toISOString(),
      clientId: config.mqtt.clientId
    });
  }

  /**
   * فصل الاتصال
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      logger.info('MQTT disconnected');
    }
  }

  /**
   * التحقق من الاتصال
   */
  isConnectedToBroker() {
    return this.isConnected;
  }

  /**
   * الحصول على قائمة المواضيع المشترك فيها
   */
  getSubscribedTopics() {
    return this.topics.map(t => t.topic);
  }
}

// إنشاء نسخة واحدة من الخدمة
const mqttService = new MQTTService();

module.exports = mqttService; 
