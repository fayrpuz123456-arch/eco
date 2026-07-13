const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const config = require('./index');
const logger = require('../core/utils/logger');

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      // إضافة Pagination plugin
      mongoose.plugin(mongoosePaginate);

      // تفعيل Debug في بيئة التطوير
      if (config.env === 'development') {
        mongoose.set('debug', true);
      }

      // أحداث الاتصال
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        logger.info('✅ MongoDB connected successfully');
      });

      mongoose.connection.on('error', (error) => {
        this.isConnected = false;
        logger.error('❌ MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('⚠️ MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        logger.info('🔄 MongoDB reconnected successfully');
      });

      // إغلاق الاتصال عند إيقاف التطبيق
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await this.disconnect();
        process.exit(0);
      });

      // الاتصال بقاعدة البيانات (بدون الخيارات القديمة)
      await mongoose.connect(config.mongodb.uri);
      this.connection = mongoose.connection;

      logger.info(`📦 MongoDB connected to: ${config.mongodb.uri}`);
      
      // عرض معلومات قاعدة البيانات
      const dbInfo = await this.getDatabaseInfo();
      if (dbInfo) {
        logger.info(`📊 Database: ${dbInfo.name}, Collections: ${dbInfo.collections}`);
      }

    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      this.connection = null;
      logger.info('✅ MongoDB disconnected successfully');
    } catch (error) {
      logger.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.connection;
  }

  getMongoose() {
    return mongoose;
  }

  async getDatabaseInfo() {
    try {
      if (!this.isConnected) {
        return null;
      }
      
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      const stats = await db.stats();
      
      return {
        name: db.databaseName,
        collections: collections.length,
        documents: stats.objects || 0,
        size: stats.dataSize || 0,
        storageSize: stats.storageSize || 0
      };
    } catch (error) {
      logger.error('Error getting database info:', error);
      return null;
    }
  }

  async createIndexes(models) {
    try {
      if (!Array.isArray(models)) {
        models = [models];
      }

      for (const model of models) {
        if (model && model.schema && model.schema.indexes) {
          await model.syncIndexes();
          logger.info(`✅ Indexes synced for ${model.modelName}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error creating indexes:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { 
          status: 'disconnected', 
          isConnected: false 
        };
      }
      
      await mongoose.connection.db.admin().ping();
      
      const info = await this.getDatabaseInfo();
      
      return { 
        status: 'connected', 
        isConnected: true,
        database: info
      };
    } catch (error) {
      return { 
        status: 'error', 
        isConnected: false,
        error: error.message 
      };
    }
  }

  async dropDatabase() {
    if (config.env === 'production') {
      throw new Error('Cannot drop database in production');
    }

    try {
      await mongoose.connection.db.dropDatabase();
      logger.warn('⚠️ Database dropped successfully (development only)');
    } catch (error) {
      logger.error('❌ Error dropping database:', error);
      throw error;
    }
  }

  async validateConnection() {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('❌ Connection validation failed:', error);
      return false;
    }
  }

  async reconnect() {
    if (this.isConnected) {
      return;
    }

    logger.info('🔄 Attempting to reconnect to MongoDB...');
    
    try {
      await mongoose.connect(config.mongodb.uri);
      this.isConnected = true;
      this.connection = mongoose.connection;
      logger.info('✅ Reconnected to MongoDB successfully');
    } catch (error) {
      logger.error('❌ Reconnection failed:', error);
      throw error;
    }
  }
}

// إنشاء نسخة واحدة من قاعدة البيانات (Singleton)
const database = new Database();

module.exports = database;