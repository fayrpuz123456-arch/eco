const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../core/utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  initialize() {
    if (this.initialized) {
      logger.info('✅ Firebase already initialized');
      return;
    }

    try {
      // التحقق من وجود المتغيرات
      const projectId = process.env.FIREBASE_PROJECT_ID || config.firebase?.projectId;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || config.firebase?.clientEmail;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || config.firebase?.privateKey;

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials missing. Skipping Firebase initialization.');
        logger.warn('📝 Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        return;
      }

      // تنظيف المفتاح
      privateKey = privateKey.replace(/\\n/g, '\n');

      // تهيئة Firebase
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey
        })
      });

      this.auth = admin.auth();
      this.initialized = true;
      
      logger.info('✅ Firebase initialized successfully');
      logger.info(`🔥 Project: ${projectId}`);

    } catch (error) {
      logger.error('❌ Firebase init error:', error.message);
      logger.error('📝 Stack:', error.stack);
      this.initialized = false;
    }
  }

  async verifyToken(token) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping token verification');
      return null;
    }
    try {
      return await this.auth.verifyIdToken(token);
    } catch (error) {
      logger.error('❌ Token verification failed:', error.message);
      throw new Error('Invalid token');
    }
  }

  async getUser(uid) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping getUser');
      return null;
    }
    try {
      return await this.auth.getUser(uid);
    } catch (error) {
      logger.error('❌ Get user failed:', error.message);
      throw new Error('User not found');
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new FirebaseService();