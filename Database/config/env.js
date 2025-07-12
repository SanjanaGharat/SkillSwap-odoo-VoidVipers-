// config/env.js
require('dotenv').config();

const config = {
  // =================== ENVIRONMENT ===================
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',

  // =================== SERVER ===================
  SERVER: {
    PORT: parseInt(process.env.PORT) || 3000,
    HOST: process.env.HOST || 'localhost',
    API_VERSION: process.env.API_VERSION || 'v1'
  },

  // =================== DATABASE ===================
  DATABASE: {
    URI: process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/skillswap-test'
      : process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap-dev',
    
    OPTIONS: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    },

    // Separate test database configuration
    TEST_OPTIONS: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 30000
    }
  },

  // =================== AUTHENTICATION ===================
  AUTH: {
    JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'default-refresh-secret',
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    SESSION_SECRET: process.env.SESSION_SECRET || 'default-session-secret',
    SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
    
    // Password requirements
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRE_UPPERCASE: true,
    PASSWORD_REQUIRE_LOWERCASE: true,
    PASSWORD_REQUIRE_NUMBERS: true,
    PASSWORD_REQUIRE_SYMBOLS: false
  },

  // =================== REAL-TIME ===================
  REALTIME: {
    SOCKET_IO_ORIGINS: process.env.SOCKET_IO_ORIGINS || 'http://localhost:3000',
    SOCKET_IO_TRANSPORTS: process.env.SOCKET_IO_TRANSPORTS?.split(',') || ['websocket', 'polling'],
    MAX_CONNECTIONS_PER_USER: parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 5,
    CONNECTION_TIMEOUT: 20000,
    HEARTBEAT_INTERVAL: 25000,
    HEARTBEAT_TIMEOUT: 60000
  },

  // =================== CORS ===================
  CORS: {
    ORIGIN: process.env.CLIENT_URL || 'http://localhost:3000',
    CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  // =================== RATE LIMITING ===================
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    
    // Specific rate limits
    AUTH_ATTEMPTS: {
      WINDOW_MS: 900000, // 15 minutes
      MAX_ATTEMPTS: 5
    },
    
    SWAP_REQUESTS: {
      WINDOW_MS: 60000, // 1 minute
      MAX_REQUESTS: 5
    },
    
    MESSAGES: {
      WINDOW_MS: 60000, // 1 minute
      MAX_REQUESTS: 30
    }
  },

  // =================== FILE UPLOAD ===================
  UPLOAD: {
    MAX_FILE_SIZE: parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 5242880, // 5MB
    ALLOWED_TYPES: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'application/pdf'
    ],
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
    
    // Cloud storage
    USE_CLOUD_STORAGE: process.env.NODE_ENV === 'production',
    AWS_CONFIG: {
      ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      REGION: process.env.AWS_REGION || 'us-east-1',
      S3_BUCKET: process.env.S3_BUCKET_NAME
    }
  },

  // =================== EMAIL ===================
  EMAIL: {
    SERVICE: process.env.EMAIL_SERVICE || 'gmail',
    HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
    PORT: parseInt(process.env.EMAIL_PORT) || 587,
    SECURE: false, // true for 465, false for other ports
    AUTH: {
      USER: process.env.EMAIL_USER,
      PASS: process.env.EMAIL_PASS
    },
    FROM: process.env.EMAIL_FROM || 'SkillSwap <noreply@skillswap.com>',
    
    // Email templates
    TEMPLATES: {
      WELCOME: 'welcome',
      SWAP_REQUEST: 'swap-request-notification',
      SWAP_ACCEPTED: 'swap-accepted',
      PASSWORD_RESET: 'password-reset'
    }
  },

  // =================== PUSH NOTIFICATIONS ===================
  PUSH_NOTIFICATIONS: {
    FCM: {
      SERVER_KEY: process.env.FCM_SERVER_KEY,
      PROJECT_ID: process.env.FCM_PROJECT_ID
    },
    
    APNS: {
      KEY_ID: process.env.APNS_KEY_ID,
      TEAM_ID: process.env.APNS_TEAM_ID,
      TOPIC: process.env.APNS_TOPIC || 'com.yourapp.skillswap',
      PRODUCTION: process.env.NODE_ENV === 'production'
    }
  },

  // =================== REDIS ===================
  REDIS: {
    URL: process.env.REDIS_URL || 'redis://localhost:6379',
    PASSWORD: process.env.REDIS_PASSWORD,
    DB: process.env.NODE_ENV === 'test' ? 1 : 0,
    
    // Redis configuration
    RETRY_DELAY_ON_FAIL: 100,
    MAX_RETRY_DELAY: 3000,
    RETRY_ATTEMPTS: 3,
    
    // Session store
    SESSION_STORE: {
      TTL: 86400, // 24 hours
      PREFIX: 'skillswap:sess:'
    },
    
    // Caching
    CACHE: {
      DEFAULT_TTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
      PREFIXES: {
        USER: 'user:',
        SKILL: 'skill:',
        SWAP_REQUEST: 'swap:',
        SEARCH: 'search:'
      }
    }
  },

  // =================== LOGGING ===================
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE: process.env.LOG_FILE || './logs/app.log',
    MAX_SIZE: '20m',
    MAX_FILES: '14d',
    
    // Console logging in development
    CONSOLE: process.env.NODE_ENV === 'development',
    
    // Log formats
    FORMAT: process.env.NODE_ENV === 'production' ? 'json' : 'simple'
  },

  // =================== SECURITY ===================
  SECURITY: {
    // Helmet configuration
    HELMET: {
      CONTENT_SECURITY_POLICY: process.env.HELMET_CONTENT_SECURITY_POLICY || "default-src 'self'",
      HSTS_MAX_AGE: parseInt(process.env.HELMET_HSTS_MAX_AGE) || 31536000
    },
    
    // API keys
    RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET_KEY,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    
    // Security settings
    BCRYPT_ROUNDS: 12,
    MAX_LOGIN_ATTEMPTS: 5,
    ACCOUNT_LOCK_TIME: 2 * 60 * 60 * 1000, // 2 hours
    
    // OWASP recommended headers
    FORCE_HTTPS: process.env.NODE_ENV === 'production',
    TRUST_PROXY: process.env.NODE_ENV === 'production'
  },

  // =================== MONITORING ===================
  MONITORING: {
    SENTRY_DSN: process.env.SENTRY_DSN,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID,
    
    // Health check endpoints
    HEALTH_CHECK_PATH: '/health',
    METRICS_PATH: '/metrics',
    
    // Performance monitoring
    ENABLE_PROFILING: process.env.NODE_ENV === 'development',
    REQUEST_TIMEOUT: 30000
  },

  // =================== DEVELOPMENT ===================
  DEVELOPMENT: {
    SEED_DATABASE: process.env.SEED_DATABASE === 'true',
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    MOCK_EXTERNAL_SERVICES: process.env.MOCK_EXTERNAL_SERVICES === 'true',
    
    // Hot reloading
    ENABLE_HOT_RELOAD: process.env.NODE_ENV === 'development',
    
    // API documentation
    ENABLE_API_DOCS: process.env.NODE_ENV !== 'production',
    API_DOCS_PATH: '/api-docs'
  },

  // =================== TESTING ===================
  TESTING: {
    RUN_INTEGRATION_TESTS: process.env.RUN_INTEGRATION_TESTS === 'true',
    TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT) || 30000,
    
    // Test database cleanup
    AUTO_CLEANUP_TEST_DB: true,
    KEEP_TEST_DATA: false,
    
    // Mock services in tests
    MOCK_EMAIL_SERVICE: true,
    MOCK_PUSH_NOTIFICATIONS: true,
    MOCK_FILE_UPLOADS: true
  },

  // =================== PERFORMANCE ===================
  PERFORMANCE: {
    // Compression
    ENABLE_GZIP: process.env.ENABLE_GZIP === 'true',
    COMPRESSION_LEVEL: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    
    // Caching
    ENABLE_ETAG: process.env.ENABLE_ETAG === 'true',
    STATIC_CACHE_MAX_AGE: 86400000, // 24 hours
    
    // Clustering
    CLUSTER_WORKERS: process.env.CLUSTER_WORKERS === 'auto' 
      ? require('os').cpus().length 
      : parseInt(process.env.CLUSTER_WORKERS) || 1,
    
    // Request parsing limits
    JSON_LIMIT: '10mb',
    URL_ENCODED_LIMIT: '10mb',
    
    // Connection pooling
    KEEP_ALIVE_TIMEOUT: 5000,
    HEADERS_TIMEOUT: 60000
  },

  // =================== BUSINESS LOGIC ===================
  BUSINESS: {
    // Swap request settings
    SWAP_REQUEST_EXPIRY_DAYS: 7,
    MAX_ACTIVE_SWAP_REQUESTS: 10,
    
    // Skills settings
    MAX_SKILLS_OFFERED: 20,
    MAX_SKILLS_WANTED: 10,
    
    // Rating settings
    MIN_RATING: 1,
    MAX_RATING: 5,
    RATING_DECIMAL_PLACES: 1,
    
    // Message settings
    MAX_MESSAGE_LENGTH: 2000,
    MESSAGE_EDIT_TIME_LIMIT: 5 * 60 * 1000, // 5 minutes
    MESSAGE_DELETE_TIME_LIMIT: 60 * 60 * 1000, // 1 hour
    
    // User settings
    PROFILE_PHOTO_MAX_SIZE: 2 * 1024 * 1024, // 2MB
    BIO_MAX_LENGTH: 500,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 30
  }
};

// Validation
function validateConfig() {
  const requiredVars = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];
  
  const missingVars = requiredVars.filter(varName => {
    const keys = varName.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined || value === null || value === '') {
        return true;
      }
    }
    return false;
  });
  
  if (missingVars.length > 0 && config.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Warn about default values in production
  if (config.NODE_ENV === 'production') {
    if (config.AUTH.JWT_SECRET === 'default-jwt-secret-change-in-production') {
      console.warn('⚠️  Using default JWT secret in production!');
    }
    
    if (!config.DATABASE.URI.includes('mongodb+srv://') && !config.DATABASE.URI.includes('replica')) {
      console.warn('⚠️  Consider using MongoDB Atlas or a replica set in production');
    }
  }
}

// Initialize validation
validateConfig();

// Freeze config to prevent modifications
Object.freeze(config);

module.exports = config;