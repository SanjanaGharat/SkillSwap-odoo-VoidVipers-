// models/index.js
require('dotenv').config(); // Load environment variables

const User = require('./User.js');
const Skill = require('./Skills.js');
const SwapRequest = require('./SwapRequest.js');
const Message = require('./Message.js');
const UserSession = require('./UserSession.js');

// Import utilities
const DatabaseConfig = require('../config/database.js');
const AggregationPipelines = require('../utils/aggregations.js');

/**
 * Initialize all models and database connection
 * @param {string} mongoUri - MongoDB connection string (optional, defaults to env)
 * @param {Object} options - Connection options
 */
async function initializeDatabase(mongoUri = null, options = {}) {
  try {
    // Use provided URI or fall back to environment variable
    const connectionUri = mongoUri || process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!connectionUri) {
      throw new Error('MongoDB connection URI is required. Please set MONGO_URI in your .env file');
    }
    
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 Database: ${connectionUri.split('@')[1] || 'local'}`);
    
    // Connect to database
    await DatabaseConfig.connect(connectionUri, options);
    
    // Set up validators
    await DatabaseConfig.createCollectionValidators();
    
    console.log('✅ Database and models initialized successfully');
    
    return {
      User,
      Skill,
      SwapRequest,
      Message,
      UserSession,
      DatabaseConfig,
      AggregationPipelines
    };
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Initialize database with environment variables (convenience method)
 */
async function initializeDatabaseFromEnv() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    throw new Error(`
❌ MongoDB URI not found in environment variables.
Please add one of the following to your .env file:
MONGO_URI=mongodb://localhost:27017/skillswap-dev
or
MONGODB_URI=mongodb://localhost:27017/skillswap-dev
    `);
  }
  
  console.log('🌱 Initializing database from environment variables...');
  return await initializeDatabase(mongoUri);
}

/**
 * Seed initial data for development/testing
 */
async function seedInitialData() {
  try {
    console.log('🌱 Seeding initial data...');
    
    // Create default skills
    const defaultSkills = [
      { name: 'JavaScript', category: 'Programming', description: 'Web development programming language' },
      { name: 'Python', category: 'Programming', description: 'Versatile programming language' },
      { name: 'React', category: 'Web Development', description: 'Frontend JavaScript library' },
      { name: 'Node.js', category: 'Backend Development', description: 'JavaScript runtime for server-side development' },
      { name: 'Graphic Design', category: 'Design', description: 'Visual communication and design' },
      { name: 'Photography', category: 'Creative', description: 'Digital and analog photography' },
      { name: 'Content Writing', category: 'Writing', description: 'Creating engaging written content' },
      { name: 'Data Analysis', category: 'Analytics', description: 'Analyzing and interpreting data' },
      { name: 'Digital Marketing', category: 'Marketing', description: 'Online marketing strategies' },
      { name: 'Project Management', category: 'Management', description: 'Planning and executing projects' }
    ];

    // Check if skills already exist
    const existingSkillsCount = await Skill.countDocuments();
    if (existingSkillsCount === 0) {
      await Skill.insertMany(defaultSkills);
      console.log(`✅ Created ${defaultSkills.length} default skills`);
    } else {
      console.log('ℹ️ Skills already exist, skipping skill creation');
    }

    console.log('✅ Initial data seeding completed');
  } catch (error) {
    console.error('❌ Error seeding initial data:', error);
    throw error;
  }
}

/**
 * Clean up database for testing
 */
async function cleanupDatabase() {
  try {
    console.log('🧹 Cleaning up database...');
    
    await Promise.all([
      User.deleteMany({}),
      Skill.deleteMany({}),
      SwapRequest.deleteMany({}),
      Message.deleteMany({}),
      UserSession.deleteMany({})
    ]);
    
    console.log('✅ Database cleanup completed');
  } catch (error) {
    console.error('❌ Error cleaning up database:', error);
    throw error;
  }
}

/**
 * Health check for all models
 */
async function healthCheck() {
  try {
    const health = {
      database: await DatabaseConfig.healthCheck(),
      models: {}
    };

    // Test each model
    const modelTests = [
      { name: 'User', model: User },
      { name: 'Skill', model: Skill },
      { name: 'SwapRequest', model: SwapRequest },
      { name: 'Message', model: Message },
      { name: 'UserSession', model: UserSession }
    ];

    for (const { name, model } of modelTests) {
      try {
        await model.countDocuments().limit(1);
        health.models[name] = { status: 'healthy' };
      } catch (error) {
        health.models[name] = { 
          status: 'unhealthy', 
          error: error.message 
        };
      }
    }

    return health;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const [
      userCount,
      skillCount,
      swapRequestCount,
      messageCount,
      sessionCount,
      dbStats
    ] = await Promise.all([
      User.countDocuments(),
      Skill.countDocuments(),
      SwapRequest.countDocuments(),
      Message.countDocuments(),
      UserSession.countDocuments(),
      DatabaseConfig.getStats()
    ]);

    return {
      collections: {
        users: userCount,
        skills: skillCount,
        swapRequests: swapRequestCount,
        messages: messageCount,
        userSessions: sessionCount
      },
      database: dbStats,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    throw error;
  }
}

/**
 * Run maintenance tasks
 */
async function runMaintenance() {
  try {
    console.log('🔧 Running maintenance tasks...');
    
    // Run database maintenance
    await DatabaseConfig.runMaintenance();
    
    // Update skill popularity based on current usage
    await updateSkillPopularity();
    
    // Clean up old expired sessions
    await UserSession.cleanupExpiredSessions();
    
    // Archive old completed swaps
    await archiveOldSwapRequests();
    
    console.log('✅ Maintenance tasks completed');
  } catch (error) {
    console.error('❌ Error running maintenance:', error);
    throw error;
  }
}

/**
 * Update skill popularity based on current usage
 */
async function updateSkillPopularity() {
  try {
    const skillUsage = await User.aggregate([
      { $unwind: '$skillsOffered' },
      {
        $group: {
          _id: '$skillsOffered.skillId',
          count: { $sum: 1 }
        }
      }
    ]);

    for (const usage of skillUsage) {
      await Skill.findByIdAndUpdate(
        usage._id,
        { popularity: usage.count }
      );
    }

    console.log(`✅ Updated popularity for ${skillUsage.length} skills`);
  } catch (error) {
    console.error('Error updating skill popularity:', error);
  }
}

/**
 * Archive old completed swap requests
 */
async function archiveOldSwapRequests() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await SwapRequest.updateMany(
      {
        status: 'completed',
        completedAt: { $lt: thirtyDaysAgo },
        isArchived: false
      },
      {
        $set: { isArchived: true }
      }
    );

    console.log(`✅ Archived ${result.modifiedCount} old swap requests`);
  } catch (error) {
    console.error('Error archiving old swap requests:', error);
  }
}

/**
 * Create test data for development
 */
async function createTestData() {
  try {
    console.log('🧪 Creating test data...');
    
    // First ensure we have skills
    await seedInitialData();
    
    // Create test users
    const skills = await Skill.find().limit(10);
    
    const testUsers = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        location: 'New York, NY',
        availability: 'weekends',
        skillsOffered: [
          {
            skillId: skills[0]._id,
            name: skills[0].name,
            category: skills[0].category,
            proficiencyLevel: 'advanced'
          }
        ],
        skillsWanted: [
          {
            skillId: skills[1]._id,
            name: skills[1].name,
            category: skills[1].category
          }
        ]
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        location: 'San Francisco, CA',
        availability: 'evenings',
        skillsOffered: [
          {
            skillId: skills[1]._id,
            name: skills[1].name,
            category: skills[1].category,
            proficiencyLevel: 'expert'
          }
        ],
        skillsWanted: [
          {
            skillId: skills[0]._id,
            name: skills[0].name,
            category: skills[0].category
          }
        ]
      }
    ];

    const createdUsers = await User.insertMany(testUsers);
    console.log(`✅ Created ${createdUsers.length} test users`);
    
    return {
      users: createdUsers,
      skills: skills
    };
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  }
}

// Export everything
module.exports = {
  // Models
  User,
  Skill,
  SwapRequest,
  Message,
  UserSession,
  
  // Utilities
  DatabaseConfig,
  AggregationPipelines,
  
  // Functions
  initializeDatabase,
  initializeDatabaseFromEnv,
  seedInitialData,
  cleanupDatabase,
  healthCheck,
  getDatabaseStats,
  runMaintenance,
  createTestData
};