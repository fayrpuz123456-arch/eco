const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../core/utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    try {
      // التحقق من المتغيرات
      if (!config.firebase?.projectId || 
          !config.firebase?.privateKey || 
          !config.firebase?.clientEmail ||
          config.firebase.projectId === 'your-project-id') {
        
        logger.warn('⚠️ Firebase credentials missing. Skipping Firebase initialization.');
        return;
      }

      // إعداد credentials بشكل صحيح
      const serviceAccount = {
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
        clientEmail: config.firebase.clientEmail
      };

      // تهيئة Firebase
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      this.initialized = true;
      this.auth = admin.auth();
      logger.info('✅ Firebase initialized successfully');
      logger.info(`🔥 Project: ${config.firebase.projectId}`);
    } catch (error) {
      logger.error('❌ Firebase init error:', error.message);
      this.initialized = false;
    }
  }

  async verifyToken(token) {
    if (!this.initialized) {
      if (process.env.NODE_ENV === 'development') {
        return { uid: 'dev-user', email: 'dev@ecoguardian.com' };
      }
      throw new Error('Firebase not initialized');
    }
    try {
      return await this.auth.verifyIdToken(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUser(uid) {
    if (!this.initialized) {
      if (process.env.NODE_ENV === 'development') {
        return { uid, email: 'dev@ecoguardian.com', displayName: 'Dev User' };
      }
      throw new Error('Firebase not initialized');
    }
    try {
      return await this.auth.getUser(uid);
    } catch (error) {
      throw new Error('User not found');
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new FirebaseService();