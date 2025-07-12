// models/SwapRequest.js
const mongoose = require('mongoose');

const participantSubSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  profilePhotoUrl: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  }
}, { _id: false });

const skillExchangeSubSchema = new mongoose.Schema({
  offered: {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    }
  },
  wanted: {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    }
  }
}, { _id: false });

const messageSubSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxLength: [1000, 'Message cannot exceed 1000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const ratingSubSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxLength: [500, 'Review cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const ratingsSubSchema = new mongoose.Schema({
  requesterRating: ratingSubSchema,
  receiverRating: ratingSubSchema
}, { _id: false });

const swapRequestSchema = new mongoose.Schema({
  requester: {
    type: participantSubSchema,
    required: true
  },
  receiver: {
    type: participantSubSchema,
    required: true
  },
  skillExchange: {
    type: skillExchangeSubSchema,
    required: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
      message: 'Status must be one of: pending, accepted, rejected, completed, cancelled'
    },
    default: 'pending'
  },
  message: {
    type: String,
    trim: true,
    maxLength: [1000, 'Initial message cannot exceed 1000 characters']
  },
  proposedDuration: {
    type: String,
    trim: true,
    maxLength: [100, 'Duration cannot exceed 100 characters']
  },
  proposedFormat: {
    type: String,
    enum: {
      values: ['in_person', 'online', 'hybrid'],
      message: 'Format must be one of: in_person, online, hybrid'
    },
    default: 'online'
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  },
  completedAt: {
    type: Date
  },
  recentMessages: {
    type: [messageSubSchema],
    default: [],
    validate: {
      validator: function(messages) {
        return messages.length <= 50; // Limit recent messages
      },
      message: 'Cannot store more than 50 recent messages'
    }
  },
  messageCount: {
    type: Number,
    min: 0,
    default: 0
  },
  lastMessageAt: {
    type: Date
  },
  ratings: ratingsSubSchema,
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
swapRequestSchema.index({ 'requester.userId': 1, status: 1 });
swapRequestSchema.index({ 'receiver.userId': 1, status: 1 });
swapRequestSchema.index({ status: 1, createdAt: -1 });
swapRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
swapRequestSchema.index({ 'skillExchange.offered.name': 1 });
swapRequestSchema.index({ 'skillExchange.wanted.name': 1 });
swapRequestSchema.index({ lastMessageAt: -1 });

// Compound indexes
swapRequestSchema.index({
  'requester.userId': 1,
  'receiver.userId': 1,
  status: 1
});

// Virtual properties
swapRequestSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

swapRequestSchema.virtual('canBeRated').get(function() {
  return this.status === 'completed' && !this.ratings;
});

swapRequestSchema.virtual('hasUnreadMessages').get(function() {
  return this.recentMessages.some(msg => !msg.isRead);
});

// Instance methods
swapRequestSchema.methods.updateStatus = function(newStatus, userId) {
  const validTransitions = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['completed', 'cancelled'],
    rejected: [],
    completed: [],
    cancelled: []
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }

  // Validate user can make this transition
  const isRequester = this.requester.userId.toString() === userId.toString();
  const isReceiver = this.receiver.userId.toString() === userId.toString();

  if (newStatus === 'accepted' && !isReceiver) {
    throw new Error('Only receiver can accept a request');
  }

  if (newStatus === 'rejected' && !isReceiver) {
    throw new Error('Only receiver can reject a request');
  }

  this.status = newStatus;
  if (newStatus === 'completed') {
    this.completedAt = new Date();
  }

  return this.save();
};

swapRequestSchema.methods.addMessage = function(messageData) {
  const message = {
    senderId: messageData.senderId,
    senderName: messageData.senderName,
    content: messageData.content,
    timestamp: new Date(),
    isRead: false
  };

  // Add to recent messages (keep only last 50)
  this.recentMessages.push(message);
  if (this.recentMessages.length > 50) {
    this.recentMessages = this.recentMessages.slice(-50);
  }

  this.messageCount += 1;
  this.lastMessageAt = message.timestamp;

  return this.save();
};

swapRequestSchema.methods.markMessagesAsRead = function(userId) {
  let hasUpdates = false;
  
  this.recentMessages.forEach(message => {
    if (message.senderId.toString() !== userId.toString() && !message.isRead) {
      message.isRead = true;
      hasUpdates = true;
    }
  });

  return hasUpdates ? this.save() : Promise.resolve(this);
};

swapRequestSchema.methods.addRating = function(ratingData, raterUserId) {
  if (this.status !== 'completed') {
    throw new Error('Can only rate completed swaps');
  }

  const isRequesterRating = this.requester.userId.toString() === raterUserId.toString();
  const isReceiverRating = this.receiver.userId.toString() === raterUserId.toString();

  if (!isRequesterRating && !isReceiverRating) {
    throw new Error('Only participants can rate this swap');
  }

  if (!this.ratings) {
    this.ratings = {};
  }

  const ratingKey = isRequesterRating ? 'receiverRating' : 'requesterRating';
  
  if (this.ratings[ratingKey]) {
    throw new Error('Rating already submitted');
  }

  this.ratings[ratingKey] = {
    rating: ratingData.rating,
    review: ratingData.review,
    createdAt: new Date()
  };

  return this.save();
};

swapRequestSchema.methods.canUserAccess = function(userId) {
  return this.requester.userId.toString() === userId.toString() ||
         this.receiver.userId.toString() === userId.toString();
};

// Static methods
swapRequestSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { 'requester.userId': userId },
      { 'receiver.userId': userId }
    ]
  };

  if (options.status) {
    query.status = options.status;
  }

  if (options.isArchived !== undefined) {
    query.isArchived = options.isArchived;
  }

  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 50);
};

swapRequestSchema.statics.findPendingRequests = function(userId) {
  return this.find({
    'receiver.userId': userId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

swapRequestSchema.statics.createRequest = async function(requestData) {
  // Validate users exist and have the required skills
  const User = mongoose.model('User');
  
  const [requester, receiver] = await Promise.all([
    User.findById(requestData.requester.userId),
    User.findById(requestData.receiver.userId)
  ]);

  if (!requester || !receiver) {
    throw new Error('Invalid user IDs');
  }

  // Check if requester has offered skill
  const hasOfferedSkill = requester.skillsOffered.some(
    skill => skill.skillId.toString() === requestData.skillExchange.offered.skillId.toString()
  );

  if (!hasOfferedSkill) {
    throw new Error('Requester does not offer the specified skill');
  }

  // Check if receiver has wanted skill
  const hasWantedSkill = receiver.skillsOffered.some(
    skill => skill.skillId.toString() === requestData.skillExchange.wanted.skillId.toString()
  );

  if (!hasWantedSkill) {
    throw new Error('Receiver does not offer the requested skill');
  }

  const request = new this(requestData);
  return request.save();
};

swapRequestSchema.statics.getActiveRequestsBetweenUsers = function(userId1, userId2) {
  return this.find({
    $or: [
      {
        'requester.userId': userId1,
        'receiver.userId': userId2
      },
      {
        'requester.userId': userId2,
        'receiver.userId': userId1
      }
    ],
    status: { $in: ['pending', 'accepted'] }
  });
};

// Pre-save middleware
swapRequestSchema.pre('save', function(next) {
  // Validate that requester and receiver are different
  if (this.requester.userId.toString() === this.receiver.userId.toString()) {
    next(new Error('Requester and receiver cannot be the same user'));
    return;
  }

  // Set expiry if not set
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  next();
});

// Post-save middleware to update user ratings
swapRequestSchema.post('save', async function(doc) {
  if (doc.isModified('ratings') && doc.ratings) {
    const User = mongoose.model('User');
    
    // Update requester rating if receiver rated them
    if (doc.ratings.requesterRating) {
      await User.findByIdAndUpdate(
        doc.requester.userId,
        { $inc: { 
          'rating.total': doc.ratings.requesterRating.rating,
          'rating.count': 1
        }},
        { new: true }
      ).then(user => {
        if (user) {
          user.rating.average = user.rating.total / user.rating.count;
          return user.save();
        }
      });
    }

    // Update receiver rating if requester rated them
    if (doc.ratings.receiverRating) {
      await User.findByIdAndUpdate(
        doc.receiver.userId,
        { $inc: { 
          'rating.total': doc.ratings.receiverRating.rating,
          'rating.count': 1
        }},
        { new: true }
      ).then(user => {
        if (user) {
          user.rating.average = user.rating.total / user.rating.count;
          return user.save();
        }
      });
    }
  }
});

module.exports = mongoose.model('SwapRequest', swapRequestSchema);