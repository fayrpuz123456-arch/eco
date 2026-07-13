const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const logger = require("../core/utils/logger");

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  initialize() {
    if (this.initialized) return;

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn("⚠️ Firebase credentials missing");
        return;
      }

      // تحويل \n إلى أسطر حقيقية
      privateKey = privateKey.replace(/\\n/g, "\n");

      // Debug Logs
      logger.info(`Firebase Project: ${projectId}`);
      logger.info(`Firebase Email: ${clientEmail}`);
      logger.info(`Private Key Exists: ${!!privateKey}`);

      // لا تعيد التهيئة إذا كان التطبيق مهيأ بالفعل
      const app =
        getApps().length === 0
          ? initializeApp({
              credential: cert({
                projectId,
                clientEmail,
                privateKey,
              }),
            })
          : getApps()[0];

      this.auth = getAuth(app);
      this.initialized = true;

      logger.info("✅ Firebase initialized successfully");
    } catch (error) {
      logger.error("❌ Firebase init error:", error.message);
      logger.error(error.stack);

      this.initialized = false;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  getAuth() {
    return this.auth;
  }
}

module.exports = new FirebaseService();