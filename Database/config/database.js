const mongoose = require('mongoose');

class DatabaseConfig {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect(mongoUri, options = {}) {
    try {
      const defaultOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        ...options
      };

      this.connection = await mongoose.connect(mongoUri, defaultOptions);
      this.isConnected = true;

      console.log('✅ MongoDB connected successfully');
      
      this.setupEventListeners();
      
      await this.createIndexes();
      
      this.setupGracefulShutdown();

      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  setupEventListeners() {
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      this.isConnected = true;
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔄 Connecting to MongoDB...');
    });
  }

  async createIndexes() {
    try {
      console.log('🔧 Creating database indexes...');

      const db = mongoose.connection.db;

      await this.createUsersIndexes(db);
      
      await this.createSkillsIndexes(db);
      
      await this.createSwapRequestsIndexes(db);
      
      await this.createMessagesIndexes(db);
      
      await this.createUserSessionsIndexes(db);

      console.log('✅ All indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
      throw error;
    }
  }

  async createUsersIndexes(db) {
    const usersCollection = db.collection('users');
    
    const userIndexes = [
      { key: { email: 1 }, options: { unique: true, background: true } },
      { key: { location: 1 }, options: { background: true } },
      { key: { availability: 1 }, options: { background: true } },
      { key: { 'skillsOffered.name': 1 }, options: { background: true } },
      { key: { 'skillsWanted.name': 1 }, options: { background: true } },
      { key: { 'rating.average': -1 }, options: { background: true } },
      { key: { lastActive: -1 }, options: { background: true } },
      { key: { profileVisibility: 1, isActive: 1 }, options: { background: true } },
      { 
        key: { 'skillsOffered.name': 1, location: 1, availability: 1 }, 
        options: { background: true } 
      },
      { 
        key: { 'skillsWanted.name': 1, 'rating.average': -1 }, 
        options: { background: true } 
      }
    ];

    for (const index of userIndexes) {
      await usersCollection.createIndex(index.key, index.options);
    }
  }

  async createSkillsIndexes(db) {
    const skillsCollection = db.collection('skills');
    
    const skillIndexes = [
      { key: { name: 1 }, options: { unique: true, background: true } },
      { key: { category: 1 }, options: { background: true } },
      { key: { tags: 1 }, options: { background: true } },
      { key: { popularity: -1 }, options: { background: true } },
      { 
        key: { name: 'text', description: 'text', tags: 'text' }, 
        options: { background: true } 
      }
    ];

    for (const index of skillIndexes) {
      await skillsCollection.createIndex(index.key, index.options);
    }
  }

  async createSwapRequestsIndexes(db) {
    const swapRequestsCollection = db.collection('swaprequests');
    
    const swapRequestIndexes = [
      { key: { 'requester.userId': 1, status: 1 }, options: { background: true } },
      { key: { 'receiver.userId': 1, status: 1 }, options: { background: true } },
      { key: { status: 1, createdAt: -1 }, options: { background: true } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, background: true } },
      { key: { 'skillExchange.offered.name': 1 }, options: { background: true } },
      { key: { 'skillExchange.wanted.name': 1 }, options: { background: true } },
      { key: { lastMessageAt: -1 }, options: { background: true } },
      { 
        key: { 'requester.userId': 1, 'receiver.userId': 1, status: 1 }, 
        options: { background: true } 
      }
    ];

    for (const index of swapRequestIndexes) {
      await swapRequestsCollection.createIndex(index.key, index.options);
    }
  }

  async createMessagesIndexes(db) {
    const messagesCollection = db.collection('messages');
    
    const messageIndexes = [
      { key: { swapRequestId: 1, createdAt: -1 }, options: { background: true } },
      { key: { 'receiver.userId': 1, isRead: 1 }, options: { background: true } },
      { key: { createdAt: -1 }, options: { background: true } },
      { key: { 'sender.userId': 1, createdAt: -1 }, options: { background: true } },
      { 
        key: { swapRequestId: 1, isDeleted: 1, createdAt: -1 }, 
        options: { background: true } 
      }
    ];

    for (const index of messageIndexes) {
      await messagesCollection.createIndex(index.key, index.options);
    }
  }

  async createUserSessionsIndexes(db) {
    const userSessionsCollection = db.collection('usersessions');
    
    const sessionIndexes = [
      { key: { userId: 1 }, options: { background: true } },
      { key: { sessionToken: 1 }, options: { unique: true, background: true } },
      { key: { socketId: 1 }, options: { sparse: true, background: true } },
      { key: { lastActivity: 1 }, options: { expireAfterSeconds: 86400, background: true } },
      { key: { isOnline: 1, userId: 1 }, options: { background: true } },
      { 
        key: { userId: 1, isActive: 1, lastActivity: -1 }, 
        options: { background: true } 
      }
    ];

    for (const index of sessionIndexes) {
      await userSessionsCollection.createIndex(index.key, index.options);
    }
  }

  async createCollectionValidators() {
    try {
      console.log('🔧 Setting up collection validators...');
      
      const db = mongoose.connection.db;

      await db.command({
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'email'],
            properties: {
              name: { 
                bsonType: 'string', 
                minLength: 1, 
                maxLength: 255 
              },
              email: { 
                bsonType: 'string', 
                pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' 
              },
              availability: { 
                enum: ['weekends', 'weekdays', 'evenings', 'flexible'] 
              },
              profileVisibility: { 
                enum: ['public', 'private'] 
              }
            }
          }
        },
        validationLevel: 'moderate',
        validationAction: 'warn'
      });

      await db.command({
        collMod: 'swaprequests',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['requester', 'receiver', 'skillExchange', 'status'],
            properties: {
              status: { 
                enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'] 
              },
              proposedFormat: { 
                enum: ['in_person', 'online', 'hybrid'] 
              }
            }
          }
        },
        validationLevel: 'moderate',
        validationAction: 'warn'
      });

      console.log('✅ Collection validators set up successfully');
    } catch (error) {
      console.error('❌ Error setting up validators:', error);
      
    }
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}. Closing MongoDB connection...`);
      
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✅ MongoDB disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name
    };
  }

  async getStats() {
    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      const [dbStats, collections] = await Promise.all([
        db.stats(),
        db.listCollections().toArray()
      ]);

      const collectionStats = {};
      for (const collection of collections) {
        const stats = await db.collection(collection.name).stats();
        collectionStats[collection.name] = {
          documents: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          indexes: stats.nindexes
        };
      }

      return {
        database: dbStats,
        collections: collectionStats
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        timestamp: new Date(),
        ...this.getConnectionStatus()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async runMaintenance() {
    try {
      console.log('🔧 Running database maintenance...');
      
     
      const UserSession = mongoose.model('UserSession');
      await UserSession.cleanupExpiredSessions();
      
      // You can add more maintenance tasks here
      // - Clean up old messages
      // - Update skill popularity
      // - Archive old swap requests
      
      console.log('✅ Database maintenance completed');
    } catch (error) {
      console.error('❌ Error during maintenance:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseConfig();