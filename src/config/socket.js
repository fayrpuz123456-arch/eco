const { Server } = require('socket.io');
const config = require('./index');
const logger = require('../core/utils/logger');
const { eventEmitter, EventTypes } = require('../core/events/eventEmitter');

/**
 * خدمة Socket.IO - مسؤولة عن الاتصال المباشر مع العملاء (Flutter/Web)
 */
class SocketService {
  constructor() {
    this.io = null;
    this.isRunning = false;
    this.clients = new Map(); // clientId -> { userId, companyId, rooms }
    this.rooms = new Map(); // roomName -> Set of clientIds
  }

  /**
   * تهيئة الخادم
   */
  initialize(server) {
    try {
      this.io = new Server(server, {
        cors: {
          origin: config.socket.corsOrigin || '*',
          methods: ['GET', 'POST'],
          credentials: true
        },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
      });

      // الأحداث
      this.io.on('connection', this.onConnection.bind(this));

      this.isRunning = true;
      logger.info(`Socket.IO server initialized on port ${config.socket.port}`);

      return this.io;
    } catch (error) {
      logger.error('Failed to initialize Socket.IO:', error);
      throw error;
    }
  }

  /**
   * عند اتصال عميل جديد
   */
  onConnection(socket) {
    const clientId = socket.id;
    logger.info(`Socket.IO client connected: ${clientId}`);

    // تخزين معلومات العميل
    this.clients.set(clientId, {
      socket,
      userId: null,
      companyId: null,
      rooms: [],
      connectedAt: new Date()
    });

    // إرسال حدث الاتصال
    eventEmitter.emit(EventTypes.SOCKET_CONNECTED, {
      clientId,
      timestamp: new Date().toISOString()
    });

    // الأحداث من العميل
    socket.on('authenticate', (data) => this.onAuthenticate(socket, data));
    socket.on('join-room', (data) => this.onJoinRoom(socket, data));
    socket.on('leave-room', (data) => this.onLeaveRoom(socket, data));
    socket.on('message', (data) => this.onMessage(socket, data));
    socket.on('disconnect', () => this.onDisconnect(socket));
    socket.on('error', (error) => this.onSocketError(socket, error));

    // إرسال تأكيد الاتصال
    socket.emit('connected', {
      status: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند مصادقة العميل
   */
  onAuthenticate(socket, data) {
    try {
      const { userId, companyId, token } = data;
      
      if (!userId || !companyId) {
        socket.emit('error', { message: 'User ID and Company ID required' });
        return;
      }

      // تحديث معلومات العميل
      const client = this.clients.get(socket.id);
      if (client) {
        client.userId = userId;
        client.companyId = companyId;
      }

      // الانضمام لغرفة المستخدم
      socket.join(`user:${userId}`);
      
      // الانضمام لغرفة الشركة
      socket.join(`company:${companyId}`);

      // تسجيل في الـ Rooms
      if (!this.rooms.has(`user:${userId}`)) {
        this.rooms.set(`user:${userId}`, new Set());
      }
      this.rooms.get(`user:${userId}`).add(socket.id);

      if (!this.rooms.has(`company:${companyId}`)) {
        this.rooms.set(`company:${companyId}`, new Set());
      }
      this.rooms.get(`company:${companyId}`).add(socket.id);

      logger.info(`Socket.IO client authenticated: ${socket.id} (${userId}, ${companyId})`);

      socket.emit('authenticated', {
        status: 'success',
        userId,
        companyId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Socket.IO authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  }

  /**
   * عند الانضمام لغرفة
   */
  onJoinRoom(socket, data) {
    try {
      const { room, data: roomData } = data;
      
      if (!room) {
        socket.emit('error', { message: 'Room name required' });
        return;
      }

      socket.join(room);
      
      // تحديث قائمة الغرف في العميل
      const client = this.clients.get(socket.id);
      if (client && !client.rooms.includes(room)) {
        client.rooms.push(room);
      }

      // تحديث قائمة الغرف العالمية
      if (!this.rooms.has(room)) {
        this.rooms.set(room, new Set());
      }
      this.rooms.get(room).add(socket.id);

      logger.debug(`Socket.IO client ${socket.id} joined room: ${room}`);

      socket.emit('room-joined', {
        room,
        data: roomData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Socket.IO join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * عند مغادرة غرفة
   */
  onLeaveRoom(socket, data) {
    try {
      const { room } = data;
      
      if (!room) {
        socket.emit('error', { message: 'Room name required' });
        return;
      }

      socket.leave(room);
      
      // تحديث قائمة الغرف في العميل
      const client = this.clients.get(socket.id);
      if (client) {
        client.rooms = client.rooms.filter(r => r !== room);
      }

      // تحديث قائمة الغرف العالمية
      if (this.rooms.has(room)) {
        this.rooms.get(room).delete(socket.id);
        if (this.rooms.get(room).size === 0) {
          this.rooms.delete(room);
        }
      }

      logger.debug(`Socket.IO client ${socket.id} left room: ${room}`);

      socket.emit('room-left', {
        room,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Socket.IO leave room error:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  }

  /**
   * عند استقبال رسالة
   */
  onMessage(socket, data) {
    try {
      const { room, event, data: messageData } = data;
      
      if (!event) {
        socket.emit('error', { message: 'Event name required' });
        return;
      }

      // إعادة توجيه الرسالة إلى الغرفة المحددة
      if (room) {
        this.io.to(room).emit(event, messageData);
      } else {
        // إرسال إلى الجميع
        this.io.emit(event, messageData);
      }

      logger.debug(`Socket.IO message: ${event} from ${socket.id}`);

    } catch (error) {
      logger.error('Socket.IO message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * عند قطع الاتصال
   */
  onDisconnect(socket) {
    const clientId = socket.id;
    const client = this.clients.get(clientId);

    // إزالة العميل من جميع الغرف
    if (client) {
      for (const room of client.rooms) {
        if (this.rooms.has(room)) {
          this.rooms.get(room).delete(clientId);
          if (this.rooms.get(room).size === 0) {
            this.rooms.delete(room);
          }
        }
      }
    }

    // إزالة العميل من قائمة العملاء
    this.clients.delete(clientId);

    logger.info(`Socket.IO client disconnected: ${clientId}`);

    eventEmitter.emit(EventTypes.SOCKET_DISCONNECTED, {
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * عند حدوث خطأ في Socket
   */
  onSocketError(socket, error) {
    logger.error(`Socket.IO error for client ${socket.id}:`, error);
    
    socket.emit('error', {
      message: error.message || 'Socket error',
      timestamp: new Date().toISOString()
    });

    eventEmitter.emit(EventTypes.SOCKET_ERROR, {
      clientId: socket.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // ============ EMIT METHODS ============

  /**
   * إرسال حدث إلى غرفة معينة
   */
  emitToRoom(room, event, data) {
    if (!this.isRunning) {
      logger.warn('Socket.IO not running');
      return false;
    }

    this.io.to(room).emit(event, data);
    return true;
  }

  /**
   * إرسال حدث إلى مستخدم معين
   */
  emitToUser(userId, event, data) {
    return this.emitToRoom(`user:${userId}`, event, data);
  }

  /**
   * إرسال حدث إلى شركة معينة
   */
  emitToCompany(companyId, event, data) {
    return this.emitToRoom(`company:${companyId}`, event, data);
  }

  /**
   * إرسال حدث للجميع
   */
  emitToAll(event, data) {
    if (!this.isRunning) {
      logger.warn('Socket.IO not running');
      return false;
    }

    this.io.emit(event, data);
    return true;
  }

  /**
   * إرسال قراءة حساس فورية
   */
  emitSensorReading(reading) {
    return this.emitToAll('sensor-reading', reading);
  }

  /**
   * إرسال تنبيه فوري
   */
  emitAlert(alert) {
    return this.emitToAll('alert', alert);
  }

  /**
   * إرسال إشعار فوري
   */
  emitNotification(notification) {
    return this.emitToAll('notification', notification);
  }

  /**
   * إرسال تحديث لوحة التحكم
   */
  emitDashboardUpdate(companyId, data) {
    return this.emitToCompany(companyId, 'dashboard-update', data);
  }

  // ============ STATISTICS ============

  /**
   * الحصول على إحصائيات الاتصالات
   */
  getStats() {
    const rooms = {};
    for (const [room, clients] of this.rooms) {
      rooms[room] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      rooms,
      isRunning: this.isRunning,
      connectedClients: Array.from(this.clients.keys()).map(id => ({
        id,
        userId: this.clients.get(id)?.userId,
        companyId: this.clients.get(id)?.companyId,
        rooms: this.clients.get(id)?.rooms || []
      }))
    };
  }

  /**
   * إيقاف الخادم
   */
  stop() {
    if (this.io) {
      this.io.close();
      this.isRunning = false;
      logger.info('Socket.IO server stopped');
    }
  }
}

// إنشاء نسخة واحدة من الخدمة
const socketService = new SocketService();

module.exports = socketService; 
