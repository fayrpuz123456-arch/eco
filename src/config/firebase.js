const admin = require('firebase-admin');
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
      // قراءة المتغيرات مباشرة من process.env
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      console.log('🔍 Checking Firebase credentials...');
      console.log('🔍 FIREBASE_PROJECT_ID:', projectId ? '✅ Found' : '❌ Missing');
      console.log('🔍 FIREBASE_CLIENT_EMAIL:', clientEmail ? '✅ Found' : '❌ Missing');
      console.log('🔍 FIREBASE_PRIVATE_KEY:', privateKey ? '✅ Found' : '❌ Missing');

      // التحقق من وجود المتغيرات
      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials missing. Skipping Firebase initialization.');
        logger.warn('📝 Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        return;
      }

      // تنظيف المفتاح
      privateKey = privateKey.replace(/\\n/g, '\n');

      logger.info('🔍 Firebase credentials found, initializing...');

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