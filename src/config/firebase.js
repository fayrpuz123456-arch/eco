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

      // تهيئة Firebase Admin SDK
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          privateKey: config.firebase.privateKey,
          clientEmail: config.firebase.clientEmail
        })
      });

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
      // في وضع التطوير، نسمح بالمرور (مؤقتاً)
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

// إنشاء نسخة واحدة من Firebase (Singleton)
const firebaseService = new FirebaseService();

module.exports = firebaseService;