// middleware/firebaseAuth.js
const admin = require('firebase-admin');
const { User } = require('../../models');
const logger = require('../../utils/logger');

// Initialize Firebase Admin SDK
const serviceAccount = require('../Database/config/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

/**
 * Extract Firebase token from request
 */
function extractFirebaseToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Verify Firebase token and get user
 */
const authenticateFirebaseToken = async (req, res, next) => {
  try {
    const token = extractFirebaseToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Firebase token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get or create user in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Create user if doesn't exist
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0],
        profilePhotoUrl: decodedToken.picture,
        emailVerified: decodedToken.email_verified
      });
      
      logger.auth('New user created via Firebase', user._id);
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      firebaseUid: decodedToken.uid,
      email: user.email,
      name: user.name,
      emailVerified: decodedToken.email_verified
    };

    next();
  } catch (error) {
    logger.error('Firebase authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Optional Firebase authentication
 */
const optionalFirebaseAuth = async (req, res, next) => {
  try {
    const token = extractFirebaseToken(req);

    if (!token) {
      return next();
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (user) {
      req.user = {
        id: user._id.toString(),
        firebaseUid: decodedToken.uid,
        email: user.email,
        name: user.name,
        emailVerified: decodedToken.email_verified
      };
    }

    next();
  } catch (error) {
    // Silently continue if optional auth fails
    next();
  }
};

module.exports = {
  authenticateFirebaseToken,
  optionalFirebaseAuth,
  admin
};