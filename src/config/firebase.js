const admin = require('firebase-admin');
const logger = require('../core/utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  initialize() {
    if (this.initialized) return;

    try {
      // قراءة المتغيرات
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      // التحقق من وجود المتغيرات
      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials missing');
        return;
      }

      // تنظيف المفتاح
      privateKey = privateKey.replace(/\\n/g, '\n');

      // 🔥 استخدام الطريقة الصحيحة للتهيئة
      const serviceAccount = {
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey
      };

      // محاولة التهيئة
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
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