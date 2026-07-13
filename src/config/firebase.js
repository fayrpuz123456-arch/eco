const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../core/utils/logger');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.auth = null;
    this.firestore = null;
    this.messaging = null;
  }

  initialize() {
    // لو Firebase مهيأ بالفعل، ارجع
    if (this.initialized) {
      logger.warn('⚠️ Firebase already initialized');
      return;
    }

    try {
      // التحقق من وجود متغيرات Firebase
      if (!config.firebase.projectId ||
          !config.firebase.privateKey ||
          !config.firebase.clientEmail ||
          config.firebase.projectId === 'your-project-id') {

        logger.warn('⚠️ Firebase credentials missing or not configured. Skipping Firebase initialization.');
        logger.warn('⚠️ To enable Firebase, set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env');

        this.initialized = false;
        return;
      }

      // ✅ فحص دفاعي: تأكد إن مكتبة firebase-admin اتحملت صح
      // لو ده طلع فاضي، المشكلة مش في الكود ده، المشكلة إن الباكدج
      // firebase-admin مش متثبتة صح في بيئة الإنتاج (production) بتاعتك
      if (!admin || typeof admin.credential === 'undefined' || typeof admin.credential.cert !== 'function') {
        throw new Error(
          "admin.credential.cert غير موجودة. " +
          "غالباً firebase-admin مش متثبتة صح في بيئة الإنتاج، أو موجودة في devDependencies " +
          "بدل dependencies، أو فيه أكتر من نسخة متضاربة. " +
          "شغّل: npm ls firebase-admin  وتأكد إنها موجودة تحت dependencies في package.json، " +
          "بعدين: rm -rf node_modules package-lock.json && npm install"
        );
      }

      // ✅ إصلاح مشكلة شائعة جداً: لو الـ private key جاي من .env كـ string
      // فيه \n حرفية (literal) بدل سطر جديد حقيقي، لازم نستبدلها
      const rawPrivateKey = config.firebase.privateKey;
      const privateKey = rawPrivateKey.includes('\\n')
        ? rawPrivateKey.replace(/\\n/g, '\n')
        : rawPrivateKey;

      // ✅ تجنب استدعاء initializeApp مرتين لو فيه app شغالة بالفعل
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebase.projectId,
            privateKey: privateKey,
            clientEmail: config.firebase.clientEmail
          }),
          databaseURL: config.firebase.databaseURL
        });
      }

      // تهيئة الخدمات
      this.auth = admin.auth();
      this.firestore = admin.firestore();
      this.messaging = admin.messaging();

      this.initialized = true;
      logger.info('✅ Firebase Admin SDK initialized successfully');
      logger.info(`🔥 Firebase Project: ${config.firebase.projectId}`);
    } catch (error) {
      logger.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
      logger.warn('⚠️ Continuing without Firebase. Authentication will be disabled.');
      this.initialized = false;
    }
  }

  // ============ AUTHENTICATION ============

  async verifyToken(token) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - returning mock user for development');
      if (process.env.NODE_ENV === 'development') {
        return {
          uid: 'dev-user-123',
          email: 'dev@ecoguardian.com',
          claims: { role: 'admin', companyId: 'dev-company' }
        };
      }
      throw new Error('Firebase not initialized');
    }

    try {
      const decodedToken = await this.auth.verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      logger.error('❌ Token verification failed:', error.message);
      throw new Error('Invalid or expired token');
    }
  }

  async getUser(uid) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - returning mock user');
      if (process.env.NODE_ENV === 'development') {
        return {
          uid: uid || 'dev-user-123',
          email: 'dev@ecoguardian.com',
          displayName: 'Development User',
          emailVerified: true
        };
      }
      throw new Error('Firebase not initialized');
    }

    try {
      const user = await this.auth.getUser(uid);
      return user;
    } catch (error) {
      logger.error('❌ Failed to get user:', error.message);
      throw new Error('User not found');
    }
  }

  async getUserByEmail(email) {
    if (!this.initialized) {
      return null;
    }

    try {
      const user = await this.auth.getUserByEmail(email);
      return user;
    } catch (error) {
      return null;
    }
  }

  async createUser(email, password, displayName, additionalData = {}) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - cannot create user');
      throw new Error('Firebase not initialized');
    }

    try {
      const user = await this.auth.createUser({
        email,
        password,
        displayName: displayName || email,
        emailVerified: false,
        ...additionalData
      });

      logger.info('✅ User created in Firebase:', user.uid);
      return user;
    } catch (error) {
      logger.error('❌ Failed to create user:', error.message);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(uid, data) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const user = await this.auth.updateUser(uid, data);
      logger.info('✅ User updated in Firebase:', uid);
      return user;
    } catch (error) {
      logger.error('❌ Failed to update user:', error.message);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(uid) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping user deletion');
      return true;
    }

    try {
      await this.auth.deleteUser(uid);
      logger.info('✅ User deleted from Firebase:', uid);
      return true;
    } catch (error) {
      logger.error('❌ Failed to delete user:', error.message);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async setCustomClaims(uid, claims) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping custom claims');
      return true;
    }

    try {
      await this.auth.setCustomUserClaims(uid, claims);
      logger.info('✅ Custom claims set for user:', uid);
      return true;
    } catch (error) {
      logger.error('❌ Failed to set custom claims:', error.message);
      throw new Error(`Failed to set custom claims: ${error.message}`);
    }
  }

  async getUserClaims(uid) {
    if (!this.initialized) {
      return {};
    }

    try {
      const user = await this.auth.getUser(uid);
      return user.customClaims || {};
    } catch (error) {
      return {};
    }
  }

  async generateEmailVerificationLink(email) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const link = await this.auth.generateEmailVerificationLink(email);
      return link;
    } catch (error) {
      logger.error('❌ Failed to generate verification link:', error.message);
      throw new Error(`Failed to generate verification link: ${error.message}`);
    }
  }

  async generatePasswordResetLink(email) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const link = await this.auth.generatePasswordResetLink(email);
      return link;
    } catch (error) {
      logger.error('❌ Failed to generate password reset link:', error.message);
      throw new Error(`Failed to generate password reset link: ${error.message}`);
    }
  }

  // ============ FIRESTORE ============

  getFirestore() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    return this.firestore;
  }

  async createDocument(collection, data, id = null) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      let docRef;
      if (id) {
        docRef = this.firestore.collection(collection).doc(id);
        await docRef.set(data);
      } else {
        docRef = await this.firestore.collection(collection).add(data);
      }

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('❌ Failed to create document:', error.message);
      throw error;
    }
  }

  async getDocument(collection, id) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const doc = await this.firestore.collection(collection).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('❌ Failed to get document:', error.message);
      throw error;
    }
  }

  async updateDocument(collection, id, data) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      await this.firestore.collection(collection).doc(id).update(data);
      return this.getDocument(collection, id);
    } catch (error) {
      logger.error('❌ Failed to update document:', error.message);
      throw error;
    }
  }

  async deleteDocument(collection, id) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      await this.firestore.collection(collection).doc(id).delete();
      return true;
    } catch (error) {
      logger.error('❌ Failed to delete document:', error.message);
      throw error;
    }
  }

  async queryCollection(collection, filters = [], limit = 100) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      let query = this.firestore.collection(collection);

      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });

      return results;
    } catch (error) {
      logger.error('❌ Failed to query collection:', error.message);
      throw error;
    }
  }

  // ============ FIREBASE MESSAGING ============

  async sendPushNotification(token, title, body, data = {}) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping push notification');
      return { success: false, message: 'Firebase not initialized' };
    }

    try {
      const message = {
        token: token,
        notification: { title, body },
        data: data
      };

      const response = await this.messaging.send(message);
      logger.info('✅ Push notification sent:', response);
      return response;
    } catch (error) {
      logger.error('❌ Failed to send push notification:', error.message);
      throw error;
    }
  }

  async sendPushNotificationToTopic(topic, title, body, data = {}) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping push notification');
      return { success: false, message: 'Firebase not initialized' };
    }

    try {
      const message = {
        topic: topic,
        notification: { title, body },
        data: data
      };

      const response = await this.messaging.send(message);
      logger.info('✅ Push notification sent to topic:', response);
      return response;
    } catch (error) {
      logger.error('❌ Failed to send push notification to topic:', error.message);
      throw error;
    }
  }

  async sendMulticastPushNotification(tokens, title, body, data = {}) {
    if (!this.initialized) {
      logger.warn('⚠️ Firebase not initialized - skipping push notification');
      return { success: false, message: 'Firebase not initialized' };
    }

    try {
      const message = {
        tokens: tokens,
        notification: { title, body },
        data: data
      };

      const response = await this.messaging.sendEachForMulticast(message);
      logger.info('✅ Multicast push notification sent:', response);
      return response;
    } catch (error) {
      logger.error('❌ Failed to send multicast push notification:', error.message);
      throw error;
    }
  }

  // ============ HELPERS ============

  isInitialized() {
    return this.initialized;
  }

  getAuth() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    return this.auth;
  }

  getMessaging() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    return this.messaging;
  }

  // ============ HEALTH CHECK ============

  async healthCheck() {
    try {
      if (!this.initialized) {
        return { status: 'not_initialized', initialized: false };
      }

      await this.auth.getUser('test-user').catch(() => {});

      return {
        status: 'healthy',
        initialized: true,
        projectId: config.firebase.projectId
      };
    } catch (error) {
      return {
        status: 'error',
        initialized: true,
        error: error.message
      };
    }
  }
}

const firebaseService = new FirebaseService();

module.exports = firebaseService;