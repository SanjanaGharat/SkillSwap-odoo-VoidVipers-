// utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config/env');

/**
 * Custom log formats
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

/**
 * Create transports based on environment
 */
function createTransports() {
  const transports = [];

  // Console transport (always enabled in development)
  if (config.LOGGING.CONSOLE || config.IS_DEVELOPMENT) {
    transports.push(
      new winston.transports.Console({
        level: config.LOGGING.LEVEL,
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );
  }

  // File transports for production
  if (config.IS_PRODUCTION || config.LOGGING.FILE) {
    const logsDir = path.dirname(config.LOGGING.FILE);

    // Combined logs (all levels)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: config.LOGGING.LEVEL,
        format: logFormat,
        maxSize: config.LOGGING.MAX_SIZE,
        maxFiles: config.LOGGING.MAX_FILES,
        handleExceptions: true,
        handleRejections: true,
        zippedArchive: true
      })
    );

    // Error logs (error level only)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: logFormat,
        maxSize: config.LOGGING.MAX_SIZE,
        maxFiles: config.LOGGING.MAX_FILES,
        handleExceptions: true,
        handleRejections: true,
        zippedArchive: true
      })
    );

    // HTTP access logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'access-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        format: logFormat,
        maxSize: config.LOGGING.MAX_SIZE,
        maxFiles: config.LOGGING.MAX_FILES,
        zippedArchive: true
      })
    );
  }

  return transports;
}

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.LOGGING.LEVEL,
  format: logFormat,
  defaultMeta: {
    service: 'skillswap-platform',
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: createTransports(),
  exitOnError: false
});

/**
 * Custom logging methods
 */

/**
 * Log database operations
 */
logger.database = (operation, details = {}) => {
  logger.info('Database operation', {
    category: 'database',
    operation,
    ...details
  });
};

/**
 * Log authentication events
 */
logger.auth = (event, userId = null, details = {}) => {
  logger.info('Authentication event', {
    category: 'authentication',
    event,
    userId,
    ...details
  });
};

/**
 * Log API requests
 */
logger.request = (req, res, responseTime) => {
  const logData = {
    category: 'http',
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('content-length') || 0,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id
  };

  // Determine log level based on status code
  if (res.statusCode >= 500) {
    logger.error('HTTP request error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP request warning', logData);
  } else {
    logger.http('HTTP request', logData);
  }
};

/**
 * Log performance metrics
 */
logger.performance = (operation, duration, details = {}) => {
  logger.info('Performance metric', {
    category: 'performance',
    operation,
    duration: `${duration}ms`,
    ...details
  });
};

/**
 * Log security events
 */
logger.security = (event, severity = 'medium', details = {}) => {
  const logMethod = severity === 'high' ? 'error' : 
                   severity === 'medium' ? 'warn' : 'info';

  logger[logMethod]('Security event', {
    category: 'security',
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Log business events
 */
logger.business = (event, details = {}) => {
  logger.info('Business event', {
    category: 'business',
    event,
    ...details
  });
};

/**
 * Log real-time events
 */
logger.realtime = (event, details = {}) => {
  logger.info('Real-time event', {
    category: 'realtime',
    event,
    ...details
  });
};

/**
 * Create request-specific logger with correlation ID
 */
logger.createRequestLogger = (correlationId) => {
  return logger.child({ correlationId });
};

/**
 * Log structured data with better formatting
 */
logger.structured = (level, message, data = {}) => {
  logger[level](message, {
    structured: true,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Development helper methods
 */
if (config.IS_DEVELOPMENT) {
  logger.dev = (message, data = {}) => {
    logger.debug('DEV', { message, ...data });
  };

  logger.trace = (message, data = {}) => {
    logger.debug('TRACE', { 
      message, 
      stack: new Error().stack,
      ...data 
    });
  };
}

/**
 * Express middleware for request logging
 */
logger.requestMiddleware = () => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Generate correlation ID
    req.correlationId = require('crypto').randomBytes(8).toString('hex');
    
    // Add correlation ID to response headers
    res.set('X-Correlation-ID', req.correlationId);

    // Attach request logger
    req.logger = logger.createRequestLogger(req.correlationId);

    // Log request start
    req.logger.http('Request started', {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Override res.end to log when response finishes
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      // Log request completion
      logger.request(req, res, responseTime);
      
      // Call original end method
      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Express middleware for error logging
 */
logger.errorMiddleware = () => {
  return (error, req, res, next) => {
    const requestLogger = req.logger || logger;
    
    requestLogger.error('Request error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      request: {
        method: req.method,
        url: req.originalUrl || req.url,
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
        ip: req.ip,
        userId: req.user?.id
      }
    });

    next(error);
  };
};

/**
 * Create logs directory if it doesn't exist
 */
function ensureLogsDirectory() {
  const fs = require('fs');
  const logsDir = path.dirname(config.LOGGING.FILE);
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info('Created logs directory', { path: logsDir });
  }
}

/**
 * Setup log rotation and cleanup
 */
function setupLogMaintenance() {
  // Ensure logs directory exists
  ensureLogsDirectory();

  // Log startup information
  logger.info('Logger initialized', {
    level: config.LOGGING.LEVEL,
    environment: config.NODE_ENV,
    transports: logger.transports.length,
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage()
  });

  // Setup graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, closing logger...');
    logger.end();
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, closing logger...');
    logger.end();
  });
}

/**
 * Performance monitoring helpers
 */
logger.time = (label) => {
  const startTime = process.hrtime.bigint();
  
  return {
    end: (details = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      logger.performance(label, duration, details);
      return duration;
    }
  };
};

/**
 * Memory usage logger
 */
logger.memoryUsage = () => {
  const usage = process.memoryUsage();
  
  logger.info('Memory usage', {
    category: 'system',
    memory: {
      rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(usage.external / 1024 / 1024) + ' MB'
    },
    uptime: Math.round(process.uptime()) + ' seconds'
  });
};

// Initialize logger
setupLogMaintenance();

module.exports = logger;