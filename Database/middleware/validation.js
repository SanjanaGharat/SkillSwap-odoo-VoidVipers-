// middleware/validation.js
const Joi = require('joi');
const mongoose = require('mongoose');

/**
 * Validation schemas using Joi for request validation
 */
const validationSchemas = {
  // User validation schemas
  createUser: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    email: Joi.string().email().lowercase().required(),
    location: Joi.string().trim().max(255).optional(),
    profilePhotoUrl: Joi.string().uri().optional(),
    availability: Joi.string().valid('weekends', 'weekdays', 'evenings', 'flexible').default('flexible'),
    profileVisibility: Joi.string().valid('public', 'private').default('public')
  }),

  updateUser: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    location: Joi.string().trim().max(255).optional(),
    profilePhotoUrl: Joi.string().uri().allow('').optional(),
    availability: Joi.string().valid('weekends', 'weekdays', 'evenings', 'flexible').optional(),
    profileVisibility: Joi.string().valid('public', 'private').optional()
  }),

  addUserSkill: Joi.object({
    skillId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    skillType: Joi.string().valid('offered', 'wanted').required(),
    proficiencyLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').when('skillType', {
      is: 'offered',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    yearsExperience: Joi.number().min(0).max(50).when('skillType', {
      is: 'offered',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    }),
    urgency: Joi.string().valid('low', 'medium', 'high').when('skillType', {
      is: 'wanted',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
  }),

  // Skill validation schemas
  createSkill: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    category: Joi.string().trim().max(50).required(),
    description: Joi.string().trim().max(500).optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase()).optional()
  }),

  updateSkill: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    category: Joi.string().trim().max(50).optional(),
    description: Joi.string().trim().max(500).optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase()).optional()
  }),

  // Swap Request validation schemas
  createSwapRequest: Joi.object({
    receiverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    offeredSkillId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    wantedSkillId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    message: Joi.string().trim().max(1000).optional(),
    proposedDuration: Joi.string().trim().max(100).optional(),
    proposedFormat: Joi.string().valid('in_person', 'online', 'hybrid').default('online')
  }),

  updateSwapRequest: Joi.object({
    status: Joi.string().valid('pending', 'accepted', 'rejected', 'completed', 'cancelled').required()
  }),

  addRating: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    review: Joi.string().trim().max(500).optional()
  }),

  // Message validation schemas
  createMessage: Joi.object({
    content: Joi.string().trim().min(1).max(2000).required(),
    messageType: Joi.string().valid('text', 'system', 'image', 'file').default('text'),
    replyTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
  }),

  updateMessage: Joi.object({
    content: Joi.string().trim().min(1).max(2000).required()
  }),

  // Search and filter schemas
  searchUsers: Joi.object({
    skillName: Joi.string().trim().optional(),
    location: Joi.string().trim().optional(),
    availability: Joi.string().valid('weekends', 'weekdays', 'evenings', 'flexible').optional(),
    minRating: Joi.number().min(0).max(5).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),

  searchSkills: Joi.object({
    query: Joi.string().trim().min(1).optional(),
    category: Joi.string().trim().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
  }),

  // Query parameters
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'rating', '-rating').default('-createdAt')
  }),

  mongoIdParam: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
  })
};

/**
 * Middleware factory to validate request data
 * @param {string} schemaName - Name of the validation schema
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 */
function validateRequest(schemaName, source = 'body') {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        error: 'Validation schema not found',
        code: 'SCHEMA_NOT_FOUND'
      });
    }

    const dataToValidate = req[source];
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
}

/**
 * Validate MongoDB ObjectId parameter
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        code: 'INVALID_OBJECT_ID',
        details: {
          field: paramName,
          value: id,
          message: 'Must be a valid MongoDB ObjectId'
        }
      });
    }
    
    next();
  };
}

/**
 * Validate multiple ObjectId parameters
 */
function validateObjectIds(...paramNames) {
  return (req, res, next) => {
    const errors = [];
    
    for (const paramName of paramNames) {
      const id = req.params[paramName] || req.body[paramName] || req.query[paramName];
      
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        errors.push({
          field: paramName,
          value: id,
          message: 'Must be a valid MongoDB ObjectId'
        });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid ID format',
        code: 'INVALID_OBJECT_ID',
        details: errors
      });
    }
    
    next();
  };
}

/**
 * Custom validation middleware for business logic
 */
const customValidations = {
  /**
   * Ensure user cannot create swap request with themselves
   */
  validateSwapRequestParticipants: (req, res, next) => {
    const { receiverId } = req.body;
    const requesterId = req.user.id; // Assuming user is attached to req by auth middleware
    
    if (receiverId === requesterId) {
      return res.status(400).json({
        error: 'Cannot create swap request with yourself',
        code: 'INVALID_SWAP_PARTICIPANTS'
      });
    }
    
    next();
  },

  /**
   * Validate skill ownership for swap requests
   */
  validateSkillOwnership: async (req, res, next) => {
    try {
      const { offeredSkillId, wantedSkillId, receiverId } = req.body;
      const requesterId = req.user.id;
      
      const { User } = require('../../models');
      
      // Check if requester has the offered skill
      const requester = await User.findById(requesterId);
      const hasOfferedSkill = requester.skillsOffered.some(
        skill => skill.skillId.toString() === offeredSkillId
      );
      
      if (!hasOfferedSkill) {
        return res.status(400).json({
          error: 'You do not offer the specified skill',
          code: 'SKILL_NOT_OFFERED'
        });
      }
      
      // Check if receiver has the wanted skill
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({
          error: 'Receiver not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      const hasWantedSkill = receiver.skillsOffered.some(
        skill => skill.skillId.toString() === wantedSkillId
      );
      
      if (!hasWantedSkill) {
        return res.status(400).json({
          error: 'Receiver does not offer the requested skill',
          code: 'SKILL_NOT_AVAILABLE'
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Error validating skill ownership',
        code: 'VALIDATION_ERROR'
      });
    }
  },

  /**
   * Validate user can access swap request
   */
  validateSwapRequestAccess: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const { SwapRequest } = require('../../models');
      const swapRequest = await SwapRequest.findById(id);
      
      if (!swapRequest) {
        return res.status(404).json({
          error: 'Swap request not found',
          code: 'SWAP_REQUEST_NOT_FOUND'
        });
      }
      
      if (!swapRequest.canUserAccess(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
      
      req.swapRequest = swapRequest;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Error validating access',
        code: 'VALIDATION_ERROR'
      });
    }
  },

  /**
   * Validate message ownership for editing/deleting
   */
  validateMessageOwnership: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const { Message } = require('../../models');
      const message = await Message.findById(id);
      
      if (!message) {
        return res.status(404).json({
          error: 'Message not found',
          code: 'MESSAGE_NOT_FOUND'
        });
      }
      
      if (message.sender.userId.toString() !== userId) {
        return res.status(403).json({
          error: 'You can only edit your own messages',
          code: 'MESSAGE_ACCESS_DENIED'
        });
      }
      
      req.message = message;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Error validating message ownership',
        code: 'VALIDATION_ERROR'
      });
    }
  },

  /**
   * Rate limiting validation for actions
   */
  validateRateLimit: (action, limit, timeWindow) => {
    const attempts = new Map();
    
    return (req, res, next) => {
      const userId = req.user.id;
      const key = `${action}:${userId}`;
      const now = Date.now();
      
      const userAttempts = attempts.get(key) || [];
      const recentAttempts = userAttempts.filter(
        timestamp => now - timestamp < timeWindow
      );
      
      if (recentAttempts.length >= limit) {
        return res.status(429).json({
          error: `Too many ${action} attempts. Please try again later.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((recentAttempts[0] + timeWindow - now) / 1000)
        });
      }
      
      recentAttempts.push(now);
      attempts.set(key, recentAttempts);
      
      next();
    };
  }
};


function handleValidationErrors(error, req, res, next) {
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));

    return res.status(400).json({
      error: 'Validation failed',
      code: 'MONGOOSE_VALIDATION_ERROR',
      details: validationErrors
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid data format',
      code: 'CAST_ERROR',
      details: {
        field: error.path,
        value: error.value,
        message: `Expected ${error.kind} but got ${typeof error.value}`
      }
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({
      error: 'Duplicate value',
      code: 'DUPLICATE_KEY_ERROR',
      details: {
        field: field,
        message: `${field} already exists`
      }
    });
  }

  next(error);
}

module.exports = {
  validationSchemas,
  validateRequest,
  validateObjectId,
  validateObjectIds,
  customValidations,
  handleValidationErrors
};