// services/realtimeEvents.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { UserSession, User, SwapRequest, Message } = require('../models');

class RealtimeEventService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> Set of socketIds
    this.socketUsers = new Map(); // socketId -> userId
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} server - HTTP server instance
   * @param {Object} options - Socket.IO options
   */
  initialize(server, options = {}) {
    const defaultOptions = {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      },
      ...options
    };

    this.io = new Server(server, defaultOptions);
    this.setupMiddleware();
    this.setupEventHandlers();
    
    console.log('✅ Real-time event service initialized');
    return this.io;
  }

  /**
   * Setup Socket.IO middleware for authentication
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          throw new Error('No authentication token provided');
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Verify user exists and get user data
        const user = await User.findById(userId);
        if (!user || !user.isActive) {
          throw new Error('User not found or inactive');
        }

        // Create or update user session
        const session = await UserSession.findOneAndUpdate(
          { userId: userId, socketId: socket.id },
          {
            userId: userId,
            socketId: socket.id,
            isOnline: true,
            lastActivity: new Date()
          },
          { upsert: true, new: true }
        );

        socket.userId = userId;
        socket.sessionId = session._id;
        socket.user = user;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup main event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
      this.setupUserEventHandlers(socket);
      this.setupSwapRequestHandlers(socket);
      this.setupMessageHandlers(socket);
      this.setupGeneralHandlers(socket);
    });
  }

  /**
   * Handle user connection
   */
  async handleConnection(socket) {
    const userId = socket.userId;
    
    try {
      // Add to connected users tracking
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId).add(socket.id);
      this.socketUsers.set(socket.id, userId);

      // Update user online status
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastActive: new Date()
      });

      // Join user to their personal room
      socket.join(`user_${userId}`);

      // Notify user's contacts that they're online
      await this.broadcastUserStatusChange(userId, 'online');

      // Send initial data to user
      await this.sendInitialData(socket);

      console.log(`✅ User ${userId} connected (${socket.id})`);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

    } catch (error) {
      console.error('Connection handling error:', error);
      socket.disconnect();
    }
  }

  /**
   * Handle user disconnection
   */
  async handleDisconnection(socket) {
    const userId = socket.userId;
    
    try {
      // Remove from tracking
      if (this.connectedUsers.has(userId)) {
        this.connectedUsers.get(userId).delete(socket.id);
        if (this.connectedUsers.get(userId).size === 0) {
          this.connectedUsers.delete(userId);
          
          // Update user offline status if no more connections
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: new Date()
          });

          // Notify contacts that user is offline
          await this.broadcastUserStatusChange(userId, 'offline');
        }
      }
      
      this.socketUsers.delete(socket.id);

      // Update session
      await UserSession.findOneAndUpdate(
        { socketId: socket.id },
        {
          isOnline: false,
          socketId: null,
          lastActivity: new Date()
        }
      );

      console.log(`❌ User ${userId} disconnected (${socket.id})`);
    } catch (error) {
      console.error('Disconnection handling error:', error);
    }
  }

  /**
   * Setup user-related event handlers
   */
  setupUserEventHandlers(socket) {
    // User typing indicator
    socket.on('user_typing', (data) => {
      const { swapRequestId, isTyping } = data;
      socket.to(`swap_${swapRequestId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.name,
        isTyping
      });
    });

    // User activity update
    socket.on('user_activity', async () => {
      try {
        await UserSession.findOneAndUpdate(
          { socketId: socket.id },
          { lastActivity: new Date() }
        );
      } catch (error) {
        console.error('Error updating user activity:', error);
      }
    });

    // Request online users
    socket.on('get_online_users', async (callback) => {
      try {
        const onlineUsers = await UserSession.getOnlineUsers(socket.userId);
        callback({ success: true, users: onlineUsers });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });
  }

  /**
   * Setup swap request event handlers
   */
  setupSwapRequestHandlers(socket) {
    // Join swap request room
    socket.on('join_swap_request', async (data) => {
      const { swapRequestId } = data;
      
      try {
        const swapRequest = await SwapRequest.findById(swapRequestId);
        
        if (!swapRequest || !swapRequest.canUserAccess(socket.userId)) {
          socket.emit('error', { message: 'Access denied to swap request' });
          return;
        }

        socket.join(`swap_${swapRequestId}`);
        
        // Mark messages as read
        await swapRequest.markMessagesAsRead(socket.userId);
        
        socket.emit('joined_swap_request', { swapRequestId });
      } catch (error) {
        socket.emit('error', { message: 'Error joining swap request' });
      }
    });

    // Leave swap request room
    socket.on('leave_swap_request', (data) => {
      const { swapRequestId } = data;
      socket.leave(`swap_${swapRequestId}`);
    });

    // New swap request created
    socket.on('swap_request_created', async (data) => {
      const { swapRequestId } = data;
      
      try {
        const swapRequest = await SwapRequest.findById(swapRequestId)
          .populate('requester.userId receiver.userId');
        
        // Notify receiver
        this.io.to(`user_${swapRequest.receiver.userId}`).emit('new_swap_request', {
          swapRequest: swapRequest
        });

        // Send push notification (you can implement this)
        // await this.sendPushNotification(swapRequest.receiver.userId, {
        //   title: 'New Skill Swap Request',
        //   body: `${swapRequest.requester.name} wants to swap skills with you`
        // });

      } catch (error) {
        console.error('Error handling new swap request:', error);
      }
    });

    // Swap request status updated
    socket.on('swap_request_status_updated', async (data) => {
      const { swapRequestId, status } = data;
      
      try {
        const swapRequest = await SwapRequest.findById(swapRequestId);
        
        if (!swapRequest) return;

        // Notify both participants
        this.io.to(`swap_${swapRequestId}`).emit('swap_request_status_changed', {
          swapRequestId,
          status,
          updatedBy: socket.userId
        });

        // Notify the other participant in their personal room
        const otherUserId = swapRequest.requester.userId.toString() === socket.userId 
          ? swapRequest.receiver.userId 
          : swapRequest.requester.userId;
          
        this.io.to(`user_${otherUserId}`).emit('swap_request_update', {
          swapRequestId,
          status
        });

      } catch (error) {
        console.error('Error handling swap request status update:', error);
      }
    });
  }

  /**
   * Setup message event handlers
   */
  setupMessageHandlers(socket) {
    // Send new message
    socket.on('send_message', async (data) => {
      const { swapRequestId, content, messageType = 'text' } = data;
      
      try {
        const messageData = {
          swapRequestId,
          sender: {
            userId: socket.userId,
            name: socket.user.name
          },
          content,
          messageType
        };

        const message = await Message.createMessage(messageData);
        
        // Send to swap request room
        this.io.to(`swap_${swapRequestId}`).emit('new_message', {
          message: message
        });

        // Send notification to receiver if not in room
        const swapRequest = await SwapRequest.findById(swapRequestId);
        const receiverId = swapRequest.requester.userId.toString() === socket.userId 
          ? swapRequest.receiver.userId 
          : swapRequest.requester.userId;

        const receiverSockets = this.connectedUsers.get(receiverId.toString());
        if (!receiverSockets || receiverSockets.size === 0) {
          // User is offline, you can queue for push notification
          // await this.queuePushNotification(receiverId, {
          //   title: `New message from ${socket.user.name}`,
          //   body: content
          // });
        }

      } catch (error) {
        socket.emit('message_error', { 
          error: 'Failed to send message',
          details: error.message 
        });
      }
    });

    // Message read
    socket.on('message_read', async (data) => {
      const { messageId } = data;
      
      try {
        const message = await Message.findById(messageId);
        if (message && message.canUserAccess(socket.userId)) {
          await message.markAsRead(socket.userId);
          
          // Notify sender
          socket.to(`swap_${message.swapRequestId}`).emit('message_read', {
            messageId,
            readBy: socket.userId
          });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Message edited
    socket.on('edit_message', async (data) => {
      const { messageId, newContent } = data;
      
      try {
        const message = await Message.findById(messageId);
        if (message && message.sender.userId.toString() === socket.userId) {
          await message.editContent(newContent, socket.userId);
          
          this.io.to(`swap_${message.swapRequestId}`).emit('message_edited', {
            messageId,
            newContent,
            editedAt: message.editedAt
          });
        }
      } catch (error) {
        socket.emit('message_error', { 
          error: 'Failed to edit message',
          details: error.message 
        });
      }
    });

    // Message deleted
    socket.on('delete_message', async (data) => {
      const { messageId } = data;
      
      try {
        const message = await Message.findById(messageId);
        if (message && message.sender.userId.toString() === socket.userId) {
          await message.softDelete(socket.userId);
          
          this.io.to(`swap_${message.swapRequestId}`).emit('message_deleted', {
            messageId,
            deletedAt: message.deletedAt
          });
        }
      } catch (error) {
        socket.emit('message_error', { 
          error: 'Failed to delete message',
          details: error.message 
        });
      }
    });
  }

  /**
   * Setup general event handlers
   */
  setupGeneralHandlers(socket) {
    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  /**
   * Send initial data to newly connected user
   */
  async sendInitialData(socket) {
    try {
      const userId = socket.userId;
      
      // Get pending swap requests
      const pendingRequests = await SwapRequest.findPendingRequests(userId);
      
      // Get unread message count
      const unreadCount = await Message.getUnreadCount(userId);
      
      socket.emit('initial_data', {
        pendingRequests: pendingRequests,
        unreadMessageCount: unreadCount,
        userStatus: 'online'
      });
      
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  /**
   * Broadcast user status change to relevant contacts
   */
  async broadcastUserStatusChange(userId, status) {
    try {
      // Find users who have active conversations with this user
      const activeChats = await SwapRequest.find({
        $or: [
          { 'requester.userId': userId },
          { 'receiver.userId': userId }
        ],
        status: { $in: ['pending', 'accepted'] }
      });

      const contactIds = new Set();
      activeChats.forEach(chat => {
        const otherUserId = chat.requester.userId.toString() === userId 
          ? chat.receiver.userId.toString()
          : chat.requester.userId.toString();
        contactIds.add(otherUserId);
      });

      // Notify each contact
      contactIds.forEach(contactId => {
        this.io.to(`user_${contactId}`).emit('user_status_changed', {
          userId,
          status,
          timestamp: new Date()
        });
      });

    } catch (error) {
      console.error('Error broadcasting status change:', error);
    }
  }

  /**
   * Public methods for triggering events from other parts of the application
   */

  // Notify user of new swap request
  notifyNewSwapRequest(receiverId, swapRequest) {
    this.io.to(`user_${receiverId}`).emit('new_swap_request', {
      swapRequest: swapRequest
    });
  }

  // Notify swap request status change
  notifySwapRequestStatusChange(swapRequestId, status, updatedBy) {
    this.io.to(`swap_${swapRequestId}`).emit('swap_request_status_changed', {
      swapRequestId,
      status,
      updatedBy
    });
  }

  // Notify new message
  notifyNewMessage(swapRequestId, message) {
    this.io.to(`swap_${swapRequestId}`).emit('new_message', {
      message: message
    });
  }

  // Get online status
  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get socket count for user
  getUserSocketCount(userId) {
    const sockets = this.connectedUsers.get(userId.toString());
    return sockets ? sockets.size : 0;
  }

  // Force disconnect user (admin function)
  async forceDisconnectUser(userId, reason = 'Administrative action') {
    const sockets = this.connectedUsers.get(userId.toString());
    if (sockets) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('force_disconnect', { reason });
          socket.disconnect(true);
        }
      });
    }
  }

  // Broadcast system message
  broadcastSystemMessage(message, targetUsers = null) {
    if (targetUsers) {
      targetUsers.forEach(userId => {
        this.io.to(`user_${userId}`).emit('system_message', { message });
      });
    } else {
      this.io.emit('system_message', { message });
    }
  }
}

// Export singleton instance
module.exports = new RealtimeEventService();