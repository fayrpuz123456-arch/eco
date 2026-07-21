const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");

const logger = require("../core/utils/logger");

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
    this.messaging = null;
  }

  initialize() {
    if (this.initialized) {
      logger.info("✅ Firebase already initialized");
      return;
    }

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing Firebase environment variables.");
      }

      privateKey = privateKey.replace(/\\n/g, "\n");

      let app;
      if (getApps().length === 0) {
        app = initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      } else {
        app = getApps()[0];
      }

      this.auth = getAuth(app);
      this.messaging = getMessaging(app);
      this.initialized = true;

      logger.info("✅ Firebase initialized successfully");
    } catch (error) {
      logger.error("❌ Firebase initialization error:", error.message);
      this.initialized = false;
    }
  }

  // ============ AUTH METHODS ============

  async verifyToken(token) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.verifyIdToken(token);
  }

  async getUser(uid) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.getUser(uid);
  }

  async getUserByEmail(email) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.getUserByEmail(email);
  }

  async createUser(email, password, displayName) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });
  }

  async updateUser(uid, data) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.updateUser(uid, data);
  }

  async deleteUser(uid) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.deleteUser(uid);
  }

  async setCustomClaims(uid, claims) {
    if (!this.auth) throw new Error("Firebase not initialized");
    return this.auth.setCustomUserClaims(uid, claims);
  }

  // ============ PUSH NOTIFICATIONS ============

  async sendPushNotification(token, title, body, data = {}) {
    if (!this.messaging) throw new Error("Firebase messaging not initialized");
    
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: "default",
          },
        },
      },
    };

    return this.messaging.send(message);
  }

  async sendMulticastPushNotification(tokens, title, body, data = {}) {
    if (!this.messaging) throw new Error("Firebase messaging not initialized");
    
    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: "default",
          },
        },
      },
    };

    return this.messaging.sendEachForMulticast(message);
  }

  // ============ GET CUSTOM CLAIMS ============

  async getCustomClaims(uid) {
    if (!this.auth) throw new Error("Firebase not initialized");
    const user = await this.auth.getUser(uid);
    return user.customClaims || {};
  }

  // ============ CHECK METHODS ============

  isInitialized() {
    return this.initialized;
  }

  getAuth() {
    return this.auth;
  }

  getMessaging() {
    return this.messaging;
  }
}

module.exports = new FirebaseService();
//new deploy
