const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const logger = require("../core/utils/logger");

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  initialize() {
    if (this.initialized) {
      logger.info("✅ Firebase already initialized");
      return;
    }

    try {
      logger.info("========== FIREBASE DEBUG ==========");

      logger.info(`Node Version: ${process.version}`);

      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      logger.info(`Project ID Exists: ${!!projectId}`);
      logger.info(`Client Email Exists: ${!!clientEmail}`);
      logger.info(`Private Key Exists: ${!!privateKey}`);

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing Firebase environment variables.");
      }

      privateKey = privateKey.replace(/\\n/g, "\n");

      logger.info(`Apps Before Init: ${getApps().length}`);

      let app;

      if (getApps().length === 0) {
        logger.info("Initializing Firebase...");

        app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

        logger.info("Firebase initializeApp() completed");
      } else {
        logger.info("Using existing Firebase app");
        app = getApps()[0];
      }

      this.auth = getAuth(app);
      this.initialized = true;

      logger.info("Firebase Auth initialized");
      logger.info("========== FIREBASE READY ==========");
    } catch (error) {
      logger.error("========== FIREBASE ERROR ==========");
      logger.error(error.message);
      logger.error(error.stack);
      logger.error(error);
      logger.error("===================================");

      this.initialized = false;
    }
  }

  getAuth() {
    return this.auth;
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new FirebaseService();