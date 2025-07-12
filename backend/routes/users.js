const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User.js');
const { authenticateToken, authLimiter, apiLimiter } = require('../middleware/auth.js');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * POST /api/users/register
 * Register a new user
 */
router.post('/register', authLimiter, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('location').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Location must be between 2 and 100 characters'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
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

    const { name, email, password, location, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      location,
      bio,
      profileVisibility: 'public',
      availability: 'flexible'
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Unable to create account. Please try again.'
    });
  }
});

/**
 * POST /api/users/login
 * Login user
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    user.lastActive = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Unable to login. Please try again.'
    });
  }
});

/**
 * GET /api/users/profile
 * Get current user profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('skillsOffered.skillId', 'name category')
      .populate('skillsWanted.skillId', 'name category');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Unable to retrieve profile. Please try again.'
    });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('location').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Location must be between 2 and 100 characters'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('availability').optional().isIn(['weekends', 'weekdays', 'evenings', 'flexible']).withMessage('Invalid availability option'),
  body('profileVisibility').optional().isIn(['public', 'private']).withMessage('Invalid visibility option')
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

    const updates = req.body;
    const allowedUpdates = ['name', 'location', 'bio', 'availability', 'profileVisibility'];
    
    // Filter out non-allowed fields
    const filteredUpdates = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Unable to update profile. Please try again.'
    });
  }
});

/**
 * GET /api/users/:id
 * Get public user profile
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name location bio availability skillsOffered skillsWanted rating profileVisibility isActive')
      .populate('skillsOffered.skillId', 'name category')
      .populate('skillsWanted.skillId', 'name category');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Check if profile is private
    if (user.profileVisibility === 'private') {
      return res.status(403).json({
        error: 'Profile is private',
        message: 'This profile is not publicly visible'
      });
    }

    res.json({
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: 'Unable to retrieve user. Please try again.'
    });
  }
});

/**
 * POST /api/users/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update last active time
    await User.findByIdAndUpdate(req.user._id, {
      lastActive: new Date()
    });

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Unable to logout. Please try again.'
    });
  }
});

module.exports = router;