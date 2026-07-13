const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../core/utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  initialize() {
    if (this.initialized) return;

    try {
      const { projectId, clientEmail, privateKey } = config.firebase;

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials missing in config');
        return;
      }

      // تنظيف المفتاح
      let cleanedKey = privateKey;
      if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
        cleanedKey = cleanedKey.slice(1, -1);
      }
      cleanedKey = cleanedKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: cleanedKey
        })
      });

      this.auth = admin.auth();
      this.initialized = true;
      logger.info('✅ Firebase initialized successfully');
      logger.info(`🔥 Project: ${projectId}`);
    } catch (error) {
      logger.error('❌ Firebase init error:', error.message);
      this.initialized = false;
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new FirebaseService();