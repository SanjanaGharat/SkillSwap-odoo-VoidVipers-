// models/UserSession.js
const mongoose = require('mongoose');

const deviceInfoSubSchema = new mongoose.Schema({
  userAgent: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    trim: true
  },
  browser: {
    type: String,
    trim: true
  },
  os: {
    type: String,
    trim: true
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  screenResolution: {
    type: String,
    trim: true
  }
}, { _id: false });

const locationSubSchema = new mongoose.Schema({
  ip: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    trim: true
  }
}, { _id: false });

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  refreshToken: {
    type: String,
    trim: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  isOnline: {
    type: Boolean,
    default: true,
    index: true
  },
  deviceInfo: {
    type: deviceInfoSubSchema,
    default: () => ({})
  },
  location: {
    type: locationSubSchema,
    default: () => ({})
  },
  socketId: {
    type: String,
    trim: true,
    sparse: true // Allow multiple null values
  },
  loginAt: {
    type: Date,
    default: Date.now
  },
  logoutAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sessionType: {
    type: String,
    enum: {
      values: ['web', 'mobile', 'api'],
      message: 'Session type must be one of: web, mobile, api'
    },
    default: 'web'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSessionSchema.index({ userId: 1 });
userSessionSchema.index({ sessionToken: 1 }, { unique: true });
userSessionSchema.index({ socketId: 1 }, { sparse: true });
userSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 }); // 24 hours
userSessionSchema.index({ isOnline: 1, userId: 1 });

// Compound indexes
userSessionSchema.index({
  userId: 1,
  isActive: 1,
});

// Virtual properties
userSessionSchema.virtual('isExpired').get(function() {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return Date.now() - this.lastActivity.getTime() > twentyFourHours;
});

userSessionSchema.virtual('sessionDuration').get(function() {
  const endTime = this.logoutAt || new Date();
  return endTime.getTime() - this.loginAt.getTime();
});

userSessionSchema.virtual('isCurrentlyActive').get(function() {
  const fiveMinutes = 5 * 60 * 1000;
  return this.isOnline && 
         this.isActive && 
         (Date.now() - this.lastActivity.getTime()) < fiveMinutes;
});

userSessionSchema.virtual('deviceType').get(function() {
  if (this.deviceInfo?.isMobile) return 'mobile';
  if (this.sessionType === 'api') return 'api';
  return 'desktop';
});

// Instance methods
userSessionSchema.methods.updateActivity = function() {
  this.isOnline = true;
  return this.save();
};

userSessionSchema.methods.setOnline = function(socketId = null) {
  this.isOnline = true;
  return this.save();
};

userSessionSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.logoutAt = new Date();
  this.socketId = null;
  return this.save();
};

userSessionSchema.methods.refreshSession = function(newRefreshToken = null) {
  this.lastActivity = new Date();
  if (newRefreshToken) {
    this.refreshToken = newRefreshToken;
  }
  return this.save();
};

userSessionSchema.methods.invalidate = function() {
  this.isActive = false;
  this.isOnline = false;
  this.logoutAt = new Date();
  this.socketId = null;
  return this.save();
};

userSessionSchema.methods.updateDeviceInfo = function(deviceData) {
  this.deviceInfo = {
    ...this.deviceInfo,
    ...deviceData
  };
  return this.save();
};

userSessionSchema.methods.updateLocation = function(locationData) {
  this.location = {
    ...this.location,
    ...locationData
  };
  return this.save();
};

// Static methods
userSessionSchema.statics.findByToken = function(sessionToken) {
  return this.findOne({
    sessionToken: sessionToken,
    isActive: true
  });
};

userSessionSchema.statics.findActiveSessionsByUser = function(userId) {
  return this.find({
    userId: userId,
    isActive: true,
    isOnline: true
  }).sort({ lastActivity: -1 });
};

userSessionSchema.statics.createSession = async function(sessionData) {
  // Limit active sessions per user (e.g., max 5 sessions)
  const activeSessionsCount = await this.countDocuments({
    userId: sessionData.userId,
    isActive: true
  });

  if (activeSessionsCount >= 5) {
    // Remove oldest session
    const oldestSession = await this.findOne({
      userId: sessionData.userId,
      isActive: true
    }).sort({ lastActivity: 1 });

    if (oldestSession) {
      await oldestSession.invalidate();
    }
  }

  const session = new this(sessionData);
  return session.save();
};

userSessionSchema.statics.cleanupExpiredSessions = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.updateMany(
    {
      lastActivity: { $lt: twentyFourHoursAgo },
      isActive: true
    },
    {
      $set: {
        isActive: false,
        isOnline: false,
        logoutAt: new Date()
      }
    }
  );
};

userSessionSchema.statics.getOnlineUsers = function(excludeUserId = null) {
  const query = {
    isOnline: true,
    isActive: true,
    lastActivity: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
  };

  if (excludeUserId) {
    query.userId = { $ne: excludeUserId };
  }

  return this.find(query)
    .populate('userId', 'name profilePhotoUrl')
    .sort({ lastActivity: -1 });
};

userSessionSchema.statics.getUserStatus = async function(userId) {
  const sessions = await this.find({
    userId: userId,
    isActive: true
  }).sort({ lastActivity: -1 });

  if (sessions.length === 0) {
    return { status: 'offline', lastSeen: null };
  }

  const latestSession = sessions[0];
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  if (latestSession.isOnline && latestSession.lastActivity.getTime() > fiveMinutesAgo) {
    return { 
      status: 'online', 
      lastSeen: latestSession.lastActivity,
      deviceType: latestSession.deviceType
    };
  }

  return { 
    status: 'offline', 
    lastSeen: latestSession.lastActivity 
  };
};

userSessionSchema.statics.invalidateAllUserSessions = function(userId, exceptSessionId = null) {
  const query = {
    userId: userId,
    isActive: true
  };

  if (exceptSessionId) {
    query._id = { $ne: exceptSessionId };
  }

  return this.updateMany(
    query,
    {
      $set: {
        isActive: false,
        isOnline: false,
        logoutAt: new Date(),
        socketId: null
      }
    }
  );
};

userSessionSchema.statics.getSessionStats = function(userId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        loginAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalDuration: {
          $sum: {
            $subtract: [
              { $ifNull: ['$logoutAt', new Date()] },
              '$loginAt'
            ]
          }
        },
        deviceTypes: { $addToSet: '$sessionType' },
        avgSessionDuration: {
          $avg: {
            $subtract: [
              { $ifNull: ['$logoutAt', new Date()] },
              '$loginAt'
            ]
          }
        }
      }
    }
  ]);
};

userSessionSchema.statics.findBySocketId = function(socketId) {
  return this.findOne({
    socketId: socketId,
    isActive: true,
    isOnline: true
  });
};

// Pre-save middleware
userSessionSchema.pre('save', function(next) {
  // Generate session token if not provided
  if (this.isNew && !this.sessionToken) {
    this.sessionToken = require('crypto').randomBytes(32).toString('hex');
  }

  // Set device type based on user agent
  if (this.isModified('deviceInfo.userAgent') && this.deviceInfo.userAgent) {
    const userAgent = this.deviceInfo.userAgent.toLowerCase();
    this.deviceInfo.isMobile = /mobile|android|iphone|ipad/.test(userAgent);
    
    if (/chrome/.test(userAgent)) this.deviceInfo.browser = 'Chrome';
    else if (/firefox/.test(userAgent)) this.deviceInfo.browser = 'Firefox';
    else if (/safari/.test(userAgent)) this.deviceInfo.browser = 'Safari';
    else if (/edge/.test(userAgent)) this.deviceInfo.browser = 'Edge';
  }

  next();
});

// Post-save middleware to update user online status
userSessionSchema.post('save', async function(doc) {
  try {
    const User = mongoose.model('User');
    
    // Update user's online status based on active sessions
    const hasActiveSessions = await this.constructor.countDocuments({
      userId: doc.userId,
      isActive: true,
      isOnline: true
    });

    await User.findByIdAndUpdate(
      doc.userId,
      { 
        isOnline: hasActiveSessions > 0,
        lastActive: doc.lastActivity
      }
    );
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
});

// Pre-remove middleware
userSessionSchema.pre('remove', async function(next) {
  try {
    const User = mongoose.model('User');
    
    // Check if this was the last active session
    const otherActiveSessions = await this.constructor.countDocuments({
      userId: this.userId,
      isActive: true,
      _id: { $ne: this._id }
    });

    if (otherActiveSessions === 0) {
      await User.findByIdAndUpdate(
        this.userId,
        { isOnline: false }
      );
    }
  } catch (error) {
    console.error('Error in session pre-remove middleware:', error);
  }
  
  next();
});

module.exports = mongoose.model('UserSession', userSessionSchema);