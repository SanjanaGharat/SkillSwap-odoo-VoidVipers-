const express = require('express');
const { body, validationResult } = require('express-validator');
const SwapRequest = require('../models/SwapRequest.js');
const User = require('../models/User.js');
const Message = require('../models/Message.js');
const { authenticateToken, apiLimiter } = require('../middleware/auth.js');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * GET /api/swaps
 * Get swap requests for current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      type = 'all', 
      page = 1, 
      limit = 20 
    } = req.query;

    // Build query
    let query = {};
    
    if (type === 'sent') {
      query['requester.userId'] = req.user._id;
    } else if (type === 'received') {
      query['receiver.userId'] = req.user._id;
    } else {
      // All swaps (both sent and received)
      query.$or = [
        { 'requester.userId': req.user._id },
        { 'receiver.userId': req.user._id }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [swaps, totalCount] = await Promise.all([
      SwapRequest.find(query)
        .populate('requester.userId', 'name location')
        .populate('receiver.userId', 'name location')
        .populate('skillExchange.offered.skillId', 'name category')
        .populate('skillExchange.wanted.skillId', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SwapRequest.countDocuments(query)
    ]);

    res.json({
      swaps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get swaps error:', error);
    res.status(500).json({
      error: 'Failed to get swaps',
      message: 'Unable to retrieve swap requests. Please try again.'
    });
  }
});

/**
 * POST /api/swaps
 * Create a new swap request
 */
router.post('/', authenticateToken, [
  body('receiverId').isMongoId().withMessage('Valid receiver ID is required'),
  body('offeredSkillId').isMongoId().withMessage('Valid offered skill ID is required'),
  body('wantedSkillId').isMongoId().withMessage('Valid wanted skill ID is required'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
  body('proposedFormat').optional().isIn(['in_person', 'online', 'hybrid']).withMessage('Invalid format option'),
  body('proposedDuration').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be between 1 and 480 minutes')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { 
      receiverId, 
      offeredSkillId, 
      wantedSkillId, 
      message, 
      proposedFormat, 
      proposedDuration 
    } = req.body;

    // Check if receiver exists and is active
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.isActive) {
      return res.status(404).json({
        error: 'Receiver not found',
        message: 'The user you want to swap with was not found'
      });
    }

    // Check if receiver has the wanted skill
    const receiverHasWantedSkill = receiver.skillsOffered.some(
      skill => skill.skillId.toString() === wantedSkillId
    );
    if (!receiverHasWantedSkill) {
      return res.status(400).json({
        error: 'Skill not available',
        message: 'The user does not offer the skill you want'
      });
    }

    // Check if requester has the offered skill
    const requesterHasOfferedSkill = req.user.skillsOffered.some(
      skill => skill.skillId.toString() === offeredSkillId
    );
    if (!requesterHasOfferedSkill) {
      return res.status(400).json({
        error: 'Skill not available',
        message: 'You do not offer the skill you want to trade'
      });
    }

    // Check if receiver wants the offered skill
    const receiverWantsOfferedSkill = receiver.skillsWanted.some(
      skill => skill.skillId.toString() === offeredSkillId
    );
    if (!receiverWantsOfferedSkill) {
      return res.status(400).json({
        error: 'Skill not wanted',
        message: 'The user does not want the skill you are offering'
      });
    }

    // Check if there's already a pending swap between these users
    const existingSwap = await SwapRequest.findOne({
      $or: [
        {
          'requester.userId': req.user._id,
          'receiver.userId': receiverId,
          status: { $in: ['pending', 'accepted'] }
        },
        {
          'requester.userId': receiverId,
          'receiver.userId': req.user._id,
          status: { $in: ['pending', 'accepted'] }
        }
      ]
    });

    if (existingSwap) {
      return res.status(409).json({
        error: 'Swap already exists',
        message: 'You already have a pending swap request with this user'
      });
    }

    // Get skill details
    const [offeredSkill, wantedSkill] = await Promise.all([
      require('../models/Skills.js').findById(offeredSkillId),
      require('../models/Skills.js').findById(wantedSkillId)
    ]);

    if (!offeredSkill || !wantedSkill) {
      return res.status(404).json({
        error: 'Skill not found',
        message: 'One or both skills were not found'
      });
    }

    // Create swap request
    const swapRequest = new SwapRequest({
      requester: {
        userId: req.user._id,
        name: req.user.name,
        location: req.user.location
      },
      receiver: {
        userId: receiverId,
        name: receiver.name,
        location: receiver.location
      },
      skillExchange: {
        offered: {
          skillId: offeredSkillId,
          name: offeredSkill.name,
          category: offeredSkill.category
        },
        wanted: {
          skillId: wantedSkillId,
          name: wantedSkill.name,
          category: wantedSkill.category
        }
      },
      message: message?.trim(),
      proposedFormat: proposedFormat || 'online',
      proposedDuration: proposedDuration || 60,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await swapRequest.save();

    // Create initial message if provided
    if (message?.trim()) {
      const initialMessage = new Message({
        swapRequestId: swapRequest._id,
        sender: {
          userId: req.user._id,
          name: req.user.name
        },
        receiver: {
          userId: receiverId,
          name: receiver.name
        },
        content: message.trim(),
        messageType: 'text'
      });

      await initialMessage.save();
      
      // Update swap request with message info
      swapRequest.lastMessageAt = new Date();
      await swapRequest.save();
    }

    // Populate the response
    await swapRequest.populate([
      { path: 'requester.userId', select: 'name location' },
      { path: 'receiver.userId', select: 'name location' },
      { path: 'skillExchange.offered.skillId', select: 'name category' },
      { path: 'skillExchange.wanted.skillId', select: 'name category' }
    ]);

    res.status(201).json({
      message: 'Swap request created successfully',
      swapRequest
    });
  } catch (error) {
    console.error('Create swap error:', error);
    res.status(500).json({
      error: 'Failed to create swap request',
      message: 'Unable to create swap request. Please try again.'
    });
  }
});

/**
 * GET /api/swaps/:id
 * Get specific swap request
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const swapRequest = await SwapRequest.findById(req.params.id)
      .populate('requester.userId', 'name location')
      .populate('receiver.userId', 'name location')
      .populate('skillExchange.offered.skillId', 'name category')
      .populate('skillExchange.wanted.skillId', 'name category');

    if (!swapRequest) {
      return res.status(404).json({
        error: 'Swap request not found',
        message: 'Swap request not found'
      });
    }

    // Check if user is part of this swap
    const isParticipant = swapRequest.requester.userId._id.toString() === req.user._id.toString() ||
                          swapRequest.receiver.userId._id.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view swap requests you are part of'
      });
    }

    res.json({ swapRequest });
  } catch (error) {
    console.error('Get swap error:', error);
    res.status(500).json({
      error: 'Failed to get swap request',
      message: 'Unable to retrieve swap request. Please try again.'
    });
  }
});

/**
 * PUT /api/swaps/:id/status
 * Update swap request status
 */
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['accepted', 'rejected', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { status, message } = req.body;

    const swapRequest = await SwapRequest.findById(req.params.id);
    if (!swapRequest) {
      return res.status(404).json({
        error: 'Swap request not found',
        message: 'Swap request not found'
      });
    }

    // Check if user is the receiver (only receiver can accept/reject)
    if (swapRequest.receiver.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only the receiver can update the status'
      });
    }

    // Check if swap can be updated
    if (swapRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid action',
        message: 'This swap request cannot be updated'
      });
    }

    // Update status
    swapRequest.status = status;
    swapRequest.updatedAt = new Date();

    if (status === 'accepted') {
      swapRequest.acceptedAt = new Date();
    } else if (status === 'rejected') {
      swapRequest.rejectedAt = new Date();
    }

    await swapRequest.save();

    // Create status message if provided
    if (message?.trim()) {
      const statusMessage = new Message({
        swapRequestId: swapRequest._id,
        sender: {
          userId: req.user._id,
          name: req.user.name
        },
        receiver: {
          userId: swapRequest.requester.userId,
          name: swapRequest.requester.name
        },
        content: message.trim(),
        messageType: 'text'
      });

      await statusMessage.save();
      
      // Update swap request with message info
      swapRequest.lastMessageAt = new Date();
      await swapRequest.save();
    }

    // Populate the response
    await swapRequest.populate([
      { path: 'requester.userId', select: 'name location' },
      { path: 'receiver.userId', select: 'name location' },
      { path: 'skillExchange.offered.skillId', select: 'name category' },
      { path: 'skillExchange.wanted.skillId', select: 'name category' }
    ]);

    res.json({
      message: `Swap request ${status} successfully`,
      swapRequest
    });
  } catch (error) {
    console.error('Update swap status error:', error);
    res.status(500).json({
      error: 'Failed to update swap status',
      message: 'Unable to update swap status. Please try again.'
    });
  }
});

/**
 * DELETE /api/swaps/:id
 * Cancel swap request (only requester can cancel)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const swapRequest = await SwapRequest.findById(req.params.id);
    
    if (!swapRequest) {
      return res.status(404).json({
        error: 'Swap request not found',
        message: 'Swap request not found'
      });
    }

    // Check if user is the requester
    if (swapRequest.requester.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only the requester can cancel the swap request'
      });
    }

    // Check if swap can be cancelled
    if (swapRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid action',
        message: 'This swap request cannot be cancelled'
      });
    }

    swapRequest.status = 'cancelled';
    swapRequest.cancelledAt = new Date();
    await swapRequest.save();

    res.json({
      message: 'Swap request cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel swap error:', error);
    res.status(500).json({
      error: 'Failed to cancel swap request',
      message: 'Unable to cancel swap request. Please try again.'
    });
  }
});

/**
 * GET /api/swaps/:id/messages
 * Get messages for a swap request
 */
router.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check if swap request exists and user is participant
    const swapRequest = await SwapRequest.findById(req.params.id);
    if (!swapRequest) {
      return res.status(404).json({
        error: 'Swap request not found',
        message: 'Swap request not found'
      });
    }

    const isParticipant = swapRequest.requester.userId.toString() === req.user._id.toString() ||
                          swapRequest.receiver.userId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view messages for swap requests you are part of'
      });
    }

    // Get messages
    const [messages, totalCount] = await Promise.all([
      Message.find({ 
        swapRequestId: req.params.id,
        isDeleted: false
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments({ 
        swapRequestId: req.params.id,
        isDeleted: false
      })
    ]);

    // Mark messages as read
    await Message.updateMany(
      {
        swapRequestId: req.params.id,
        'receiver.userId': req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      messages: messages.reverse(), // Show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: 'Failed to get messages',
      message: 'Unable to retrieve messages. Please try again.'
    });
  }
});

module.exports = router;