// models/Message.js
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
  }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  swapRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SwapRequest',
    required: true,
    index: true
  },
  sender: {
    type: participantSubSchema,
    required: true
  },
  receiver: {
    type: participantSubSchema,
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    minLength: [1, 'Message cannot be empty'],
    maxLength: [2000, 'Message cannot exceed 2000 characters']
  },
  messageType: {
    type: String,
    enum: {
      values: ['text', 'system', 'image', 'file'],
      message: 'Message type must be one of: text, system, image, file'
    },
    default: 'text'
  },
  attachments: [{
    fileName: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'File URL must be a valid URL'
      }
    },
    fileSize: {
      type: Number,
      min: 0
    },
    mimeType: {
      type: String,
      trim: true
    }
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
messageSchema.index({ swapRequestId: 1, createdAt: -1 });
messageSchema.index({ 'receiver.userId': 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'sender.userId': 1, createdAt: -1 });

// Compound indexes
messageSchema.index({
  swapRequestId: 1,
  isDeleted: 1,
  createdAt: -1
});

// Virtual properties
messageSchema.virtual('isEdited').get(function() {
  return !!this.editedAt;
});

messageSchema.virtual('timeSinceCreated').get(function() {
  return Date.now() - this.createdAt.getTime();
});

messageSchema.virtual('canBeEdited').get(function() {
  const fiveMinutes = 5 * 60 * 1000;
  return this.messageType === 'text' && 
         this.timeSinceCreated < fiveMinutes && 
         !this.isDeleted;
});

messageSchema.virtual('canBeDeleted').get(function() {
  const oneHour = 60 * 60 * 1000;
  return this.timeSinceCreated < oneHour && !this.isDeleted;
});

// Instance methods
messageSchema.methods.markAsRead = function(readerId) {
  if (this.receiver.userId.toString() === readerId.toString() && !this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

messageSchema.methods.editContent = function(newContent, editorId) {
  if (!this.canBeEdited) {
    throw new Error('Message cannot be edited after 5 minutes');
  }

  if (this.sender.userId.toString() !== editorId.toString()) {
    throw new Error('Only the sender can edit this message');
  }

  if (this.isDeleted) {
    throw new Error('Cannot edit a deleted message');
  }

  this.content = newContent.trim();
  this.editedAt = new Date();
  return this.save();
};

messageSchema.methods.softDelete = function(deleterId) {
  if (!this.canBeDeleted) {
    throw new Error('Message cannot be deleted after 1 hour');
  }

  if (this.sender.userId.toString() !== deleterId.toString()) {
    throw new Error('Only the sender can delete this message');
  }

  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = '[Message deleted]';
  return this.save();
};

messageSchema.methods.canUserAccess = function(userId) {
  return this.sender.userId.toString() === userId.toString() ||
         this.receiver.userId.toString() === userId.toString();
};

// Static methods
messageSchema.statics.findBySwapRequest = function(swapRequestId, options = {}) {
  const query = {
    swapRequestId: swapRequestId,
    isDeleted: false
  };

  let findQuery = this.find(query);

  if (options.limit) {
    findQuery = findQuery.limit(options.limit);
  }

  if (options.skip) {
    findQuery = findQuery.skip(options.skip);
  }

  return findQuery.sort({ createdAt: options.ascending ? 1 : -1 });
};

messageSchema.statics.findUnreadMessages = function(userId) {
  return this.find({
    'receiver.userId': userId,
    isRead: false,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    'receiver.userId': userId,
    isRead: false,
    isDeleted: false
  });
};

messageSchema.statics.markAllAsRead = function(swapRequestId, userId) {
  return this.updateMany(
    {
      swapRequestId: swapRequestId,
      'receiver.userId': userId,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

messageSchema.statics.createMessage = async function(messageData) {
  // Validate swap request exists and user has access
  const SwapRequest = mongoose.model('SwapRequest');
  const swapRequest = await SwapRequest.findById(messageData.swapRequestId);

  if (!swapRequest) {
    throw new Error('Swap request not found');
  }

  if (!swapRequest.canUserAccess(messageData.sender.userId)) {
    throw new Error('User not authorized to send messages in this swap');
  }

  // Determine receiver
  const receiverId = swapRequest.requester.userId.toString() === messageData.sender.userId.toString()
    ? swapRequest.receiver.userId
    : swapRequest.requester.userId;

  const receiverName = swapRequest.requester.userId.toString() === messageData.sender.userId.toString()
    ? swapRequest.receiver.name
    : swapRequest.requester.name;

  const message = new this({
    ...messageData,
    receiver: {
      userId: receiverId,
      name: receiverName
    }
  });

  // Save message and update swap request
  const savedMessage = await message.save();
  
  // Update swap request with recent message
  await swapRequest.addMessage({
    senderId: messageData.sender.userId,
    senderName: messageData.sender.name,
    content: messageData.content
  });

  return savedMessage;
};

messageSchema.statics.getConversationStats = function(swapRequestId) {
  return this.aggregate([
    { $match: { swapRequestId: mongoose.Types.ObjectId(swapRequestId), isDeleted: false } },
    {
      $group: {
        _id: '$sender.userId',
        messageCount: { $sum: 1 },
        lastMessage: { $max: '$createdAt' },
        senderName: { $first: '$sender.name' }
      }
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        senderName: 1,
        messageCount: 1,
        lastMessage: 1
      }
    }
  ]);
};

messageSchema.statics.searchMessages = function(swapRequestId, searchTerm) {
  return this.find({
    swapRequestId: swapRequestId,
    content: new RegExp(searchTerm, 'i'),
    isDeleted: false
  }).sort({ createdAt: -1 });
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Trim content
  if (this.isModified('content')) {
    this.content = this.content.trim();
  }

  // Validate content length based on message type
  if (this.messageType === 'text' && this.content.length === 0) {
    next(new Error('Text messages cannot be empty'));
    return;
  }

  next();
});

// Post-save middleware
messageSchema.post('save', async function(doc) {
  // Only for new messages 
  if (doc.isNew) {
    try {
      // You could emit real-time events here
      // For example, using Socket.io or similar
      // socketService.emitToUser(doc.receiver.userId, 'new_message', doc);
      
      // Update user's last activity
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.sender.userId,
        { lastActive: new Date() }
      );
    } catch (error) {
      console.error('Error in message post-save middleware:', error);
    }
  }
});

messageSchema.pre('remove', async function(next) {
  const SwapRequest = mongoose.model('SwapRequest');
  await SwapRequest.findByIdAndUpdate(
    this.swapRequestId,
    { $inc: { messageCount: -1 } }
  );
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);