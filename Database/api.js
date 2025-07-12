// routes/api.js
const express = require('express');
const router = express.Router();

// Import models and utilities
const { 
  User, 
  Skill, 
  SwapRequest, 
  Message, 
  UserSession,
  AggregationPipelines 
} = require('../models');

// Import middleware
const { 
  validateRequest, 
  validateObjectId, 
  customValidations,
  handleValidationErrors 
} = require('../middleware/validation');

// Import auth middleware (assuming you have one)
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Import real-time service
const realtimeService = require('../services/realtimeEvents');

// Error handling utility
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// =================== USER ROUTES ===================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/users/profile', 
  authenticateToken, 
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
      .select('-__v')
      .populate('skillsOffered.skillId', 'name category')
      .populate('skillsWanted.skillId', 'name category');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  })
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/users/profile',
  authenticateToken,
  validateRequest('updateUser'),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully'
    });
  })
);

/**
 * @route   POST /api/users/skills
 * @desc    Add skill to user profile
 * @access  Private
 */
router.post('/users/skills',
  authenticateToken,
  validateRequest('addUserSkill'),
  asyncHandler(async (req, res) => {
    const { skillId, skillType, ...skillData } = req.body;
    
    // Verify skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }

    const user = await User.findById(req.user.id);
    const skillInfo = {
      skillId,
      name: skill.name,
      category: skill.category,
      ...skillData
    };

    if (skillType === 'offered') {
      await user.addSkillOffered(skillInfo);
      await skill.incrementPopularity();
    } else {
      await user.addSkillWanted(skillInfo);
    }

    res.json({
      success: true,
      data: { user },
      message: `Skill ${skillType} successfully`
    });
  })
);

/**
 * @route   DELETE /api/users/skills/:skillId
 * @desc    Remove skill from user profile
 * @access  Private
 */
router.delete('/users/skills/:skillId',
  authenticateToken,
  validateObjectId('skillId'),
  asyncHandler(async (req, res) => {
    const { skillId } = req.params;
    const { skillType } = req.query;

    const user = await User.findById(req.user.id);
    
    if (skillType === 'offered') {
      user.skillsOffered = user.skillsOffered.filter(
        skill => skill.skillId.toString() !== skillId
      );
    } else {
      user.skillsWanted = user.skillsWanted.filter(
        skill => skill.skillId.toString() !== skillId
      );
    }

    await user.save();

    res.json({
      success: true,
      message: 'Skill removed successfully'
    });
  })
);

/**
 * @route   GET /api/users/search
 * @desc    Search users by skills and filters
 * @access  Public
 */
router.get('/users/search',
  optionalAuth,
  validateRequest('searchUsers', 'query'),
  asyncHandler(async (req, res) => {
    const { skillName, location, availability, minRating, page, limit } = req.query;
    
    let query = {
      profileVisibility: 'public',
      isActive: true
    };

    // Add filters
    if (skillName) {
      query['skillsOffered.name'] = new RegExp(skillName, 'i');
    }
    if (location) {
      query.location = new RegExp(location, 'i');
    }
    if (availability) {
      query.availability = availability;
    }
    if (minRating) {
      query['rating.average'] = { $gte: parseFloat(minRating) };
    }

    // Exclude current user if authenticated
    if (req.user) {
      query._id = { $ne: req.user.id };
    }

    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('name profilePhotoUrl location availability rating skillsOffered lastActive isOnline')
        .sort({ 'rating.average': -1, lastActive: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

/**
 * @route   GET /api/users/:id/match
 * @desc    Find matching users for skill exchange
 * @access  Private
 */
router.get('/users/:id/match',
  authenticateToken,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const { skillOffered, skillWanted, location, availability } = req.query;
    
    if (!skillOffered || !skillWanted) {
      return res.status(400).json({
        success: false,
        error: 'Both skillOffered and skillWanted are required'
      });
    }

    const pipeline = AggregationPipelines.findMatchingUsers({
      skillOffered,
      skillWanted,
      currentUserId: req.user.id,
      location,
      availability,
      limit: 20
    });

    const matchingUsers = await User.aggregate(pipeline);

    res.json({
      success: true,
      data: { users: matchingUsers }
    });
  })
);

// =================== SKILL ROUTES ===================

/**
 * @route   GET /api/skills
 * @desc    Get all skills with search and filtering
 * @access  Public
 */
router.get('/skills',
  validateRequest('searchSkills', 'query'),
  asyncHandler(async (req, res) => {
    const { query, category, page, limit } = req.query;
    
    let searchQuery = { isActive: true };
    
    if (query) {
      searchQuery.$or = [
        { name: new RegExp(query, 'i') },
        { description: new RegExp(query, 'i') },
        { tags: new RegExp(query, 'i') }
      ];
    }
    
    if (category) {
      searchQuery.category = new RegExp(category, 'i');
    }

    const skip = (page - 1) * limit;
    
    const [skills, total] = await Promise.all([
      Skill.find(searchQuery)
        .sort({ popularity: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      Skill.countDocuments(searchQuery)
    ]);

    res.json({
      success: true,
      data: {
        skills,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

/**
 * @route   GET /api/skills/popular
 * @desc    Get popular skills
 * @access  Public
 */
router.get('/skills/popular',
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const skills = await Skill.getPopularSkills(limit);

    res.json({
      success: true,
      data: { skills }
    });
  })
);

/**
 * @route   GET /api/skills/trending
 * @desc    Get trending skills based on recent activity
 * @access  Public
 */
router.get('/skills/trending',
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 20;
    
    const trendingSkills = await SwapRequest.aggregate(
      AggregationPipelines.getTrendingSkills(days, limit)
    );

    res.json({
      success: true,
      data: { skills: trendingSkills }
    });
  })
);

/**
 * @route   POST /api/skills
 * @desc    Create new skill (admin only)
 * @access  Private
 */
router.post('/skills',
  authenticateToken,
  validateRequest('createSkill'),
  asyncHandler(async (req, res) => {
    // Check if user has admin privileges (implement as needed)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const skill = await Skill.createSkillWithTags(req.body);

    res.status(201).json({
      success: true,
      data: { skill },
      message: 'Skill created successfully'
    });
  })
);

// =================== SWAP REQUEST ROUTES ===================

/**
 * @route   POST /api/swap-requests
 * @desc    Create new swap request
 * @access  Private
 */
router.post('/swap-requests',
  authenticateToken,
  validateRequest('createSwapRequest'),
  customValidations.validateSwapRequestParticipants,
  customValidations.validateSkillOwnership,
  customValidations.validateRateLimit('swap_request', 5, 60000), // 5 per minute
  asyncHandler(async (req, res) => {
    const { receiverId, offeredSkillId, wantedSkillId, message, proposedDuration, proposedFormat } = req.body;
    
    // Get user and receiver data
    const [requester, receiver, offeredSkill, wantedSkill] = await Promise.all([
      User.findById(req.user.id),
      User.findById(receiverId),
      Skill.findById(offeredSkillId),
      Skill.findById(wantedSkillId)
    ]);

    const swapRequestData = {
      requester: {
        userId: requester._id,
        name: requester.name,
        profilePhotoUrl: requester.profilePhotoUrl,
        rating: requester.rating.average
      },
      receiver: {
        userId: receiver._id,
        name: receiver.name,
        profilePhotoUrl: receiver.profilePhotoUrl,
        rating: receiver.rating.average
      },
      skillExchange: {
        offered: {
          skillId: offeredSkill._id,
          name: offeredSkill.name,
          category: offeredSkill.category
        },
        wanted: {
          skillId: wantedSkill._id,
          name: wantedSkill.name,
          category: wantedSkill.category
        }
      },
      message,
      proposedDuration,
      proposedFormat
    };

    const swapRequest = await SwapRequest.createRequest(swapRequestData);
    
    // Notify receiver via real-time events
    realtimeService.notifyNewSwapRequest(receiverId, swapRequest);

    res.status(201).json({
      success: true,
      data: { swapRequest },
      message: 'Swap request created successfully'
    });
  })
);

/**
 * @route   GET /api/swap-requests
 * @desc    Get user's swap requests
 * @access  Private
 */
router.get('/swap-requests',
  authenticateToken,
  validateRequest('paginationQuery', 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, sort } = req.query;
    const { status, type } = req.query;
    
    const options = { limit: parseInt(limit) };
    if (status) options.status = status;

    const skip = (page - 1) * limit;
    
    let swapRequests = await SwapRequest.findByUser(req.user.id, options);
    
    // Filter by type (sent/received)
    if (type === 'sent') {
      swapRequests = swapRequests.filter(sr => 
        sr.requester.userId.toString() === req.user.id
      );
    } else if (type === 'received') {
      swapRequests = swapRequests.filter(sr => 
        sr.receiver.userId.toString() === req.user.id
      );
    }

    res.json({
      success: true,
      data: { swapRequests }
    });
  })
);

/**
 * @route   GET /api/swap-requests/:id
 * @desc    Get specific swap request
 * @access  Private
 */
router.get('/swap-requests/:id',
  authenticateToken,
  validateObjectId('id'),
  customValidations.validateSwapRequestAccess,
  asyncHandler(async (req, res) => {
    const swapRequest = req.swapRequest; // Set by validation middleware

    res.json({
      success: true,
      data: { swapRequest }
    });
  })
);

/**
 * @route   PUT /api/swap-requests/:id/status
 * @desc    Update swap request status
 * @access  Private
 */
router.put('/swap-requests/:id/status',
  authenticateToken,
  validateObjectId('id'),
  validateRequest('updateSwapRequest'),
  customValidations.validateSwapRequestAccess,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const swapRequest = req.swapRequest;
    
    await swapRequest.updateStatus(status, req.user.id);
    
    // Notify via real-time events
    realtimeService.notifySwapRequestStatusChange(
      swapRequest._id, 
      status, 
      req.user.id
    );

    res.json({
      success: true,
      data: { swapRequest },
      message: `Swap request ${status} successfully`
    });
  })
);

/**
 * @route   POST /api/swap-requests/:id/rating
 * @desc    Add rating to completed swap request
 * @access  Private
 */
router.post('/swap-requests/:id/rating',
  authenticateToken,
  validateObjectId('id'),
  validateRequest('addRating'),
  customValidations.validateSwapRequestAccess,
  asyncHandler(async (req, res) => {
    const swapRequest = req.swapRequest;
    const { rating, review } = req.body;
    
    await swapRequest.addRating({ rating, review }, req.user.id);

    res.json({
      success: true,
      data: { swapRequest },
      message: 'Rating submitted successfully'
    });
  })
);

// =================== MESSAGE ROUTES ===================

/**
 * @route   GET /api/swap-requests/:id/messages
 * @desc    Get messages for a swap request
 * @access  Private
 */
router.get('/swap-requests/:id/messages',
  authenticateToken,
  validateObjectId('id'),
  customValidations.validateSwapRequestAccess,
  validateRequest('paginationQuery', 'query'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page, limit } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: (page - 1) * limit,
      ascending: false
    };

    const messages = await Message.findBySwapRequest(id, options);
    const total = await Message.countDocuments({ 
      swapRequestId: id, 
      isDeleted: false 
    });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

/**
 * @route   POST /api/swap-requests/:id/messages
 * @desc    Send message in swap request
 * @access  Private
 */
router.post('/swap-requests/:id/messages',
  authenticateToken,
  validateObjectId('id'),
  validateRequest('createMessage'),
  customValidations.validateSwapRequestAccess,
  customValidations.validateRateLimit('message', 30, 60000), // 30 per minute
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, messageType, replyTo } = req.body;
    
    const messageData = {
      swapRequestId: id,
      sender: {
        userId: req.user.id,
        name: req.user.name
      },
      content,
      messageType,
      replyTo
    };

    const message = await Message.createMessage(messageData);
    
    // Notify via real-time events
    realtimeService.notifyNewMessage(id, message);

    res.status(201).json({
      success: true,
      data: { message },
      message: 'Message sent successfully'
    });
  })
);

/**
 * @route   PUT /api/messages/:id
 * @desc    Edit message
 * @access  Private
 */
router.put('/messages/:id',
  authenticateToken,
  validateObjectId('id'),
  validateRequest('updateMessage'),
  customValidations.validateMessageOwnership,
  asyncHandler(async (req, res) => {
    const message = req.message; // Set by validation middleware
    const { content } = req.body;
    
    await message.editContent(content, req.user.id);

    res.json({
      success: true,
      data: { message },
      message: 'Message updated successfully'
    });
  })
);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete message
 * @access  Private
 */
router.delete('/messages/:id',
  authenticateToken,
  validateObjectId('id'),
  customValidations.validateMessageOwnership,
  asyncHandler(async (req, res) => {
    const message = req.message;
    
    await message.softDelete(req.user.id);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  })
);

// =================== DASHBOARD & ANALYTICS ROUTES ===================

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get user dashboard statistics
 * @access  Private
 */
router.get('/dashboard/stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const dashboardData = await User.aggregate(
      AggregationPipelines.getUserDashboardStats(req.user.id)
    );

    res.json({
      success: true,
      data: dashboardData[0] || {}
    });
  })
);

/**
 * @route   GET /api/dashboard/recommendations
 * @desc    Get personalized user recommendations
 * @access  Private
 */
router.get('/dashboard/recommendations',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    
    const recommendations = await User.aggregate(
      AggregationPipelines.getUserRecommendations(req.user.id, limit)
    );

    res.json({
      success: true,
      data: { recommendations: recommendations[0]?.recommendations || [] }
    });
  })
);

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get user activity timeline
 * @access  Private
 */
router.get('/dashboard/activity',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    
    const activity = await SwapRequest.aggregate(
      AggregationPipelines.getUserActivityTimeline(req.user.id, days)
    );

    res.json({
      success: true,
      data: { activity }
    });
  })
);

// Error handling middleware
router.use(handleValidationErrors);

// Global error handler
router.use((error, req, res, next) => {
  console.error('API Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;