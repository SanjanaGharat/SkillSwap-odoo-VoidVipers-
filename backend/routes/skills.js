const express = require('express');
const { body, validationResult } = require('express-validator');
const Skill = require('../models/Skills.js');
const User = require('../models/User.js');
const { authenticateToken, apiLimiter } = require('../middleware/auth.js');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * GET /api/skills
 * Get all skills with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'popularity',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'category') {
      sortOptions.category = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.popularity = sortOrder === 'desc' ? -1 : 1;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [skills, totalCount] = await Promise.all([
      Skill.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Skill.countDocuments(query)
    ]);

    res.json({
      skills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      error: 'Failed to get skills',
      message: 'Unable to retrieve skills. Please try again.'
    });
  }
});

/**
 * GET /api/skills/categories
 * Get all skill categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Skill.distinct('category');
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: 'Unable to retrieve categories. Please try again.'
    });
  }
});

/**
 * GET /api/skills/popular
 * Get popular skills
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const skills = await Skill.find()
      .sort({ popularity: -1 })
      .limit(parseInt(limit));

    res.json({ skills });
  } catch (error) {
    console.error('Get popular skills error:', error);
    res.status(500).json({
      error: 'Failed to get popular skills',
      message: 'Unable to retrieve popular skills. Please try again.'
    });
  }
});

/**
 * GET /api/skills/:id
 * Get skill by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    
    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        message: 'Skill not found'
      });
    }

    res.json({ skill });
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({
      error: 'Failed to get skill',
      message: 'Unable to retrieve skill. Please try again.'
    });
  }
});

/**
 * POST /api/skills
 * Create a new skill (admin only)
 */
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Skill name must be between 2 and 50 characters'),
  body('category').trim().isLength({ min: 2, max: 30 }).withMessage('Category must be between 2 and 30 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
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

    const { name, category, description, tags = [] } = req.body;

    // Check if skill already exists
    const existingSkill = await Skill.findOne({ 
      name: { $regex: new RegExp('^' + name + '$', 'i') }
    });
    
    if (existingSkill) {
      return res.status(409).json({
        error: 'Skill already exists',
        message: 'A skill with this name already exists'
      });
    }

    // Create new skill
    const skill = new Skill({
      name: name.trim(),
      category: category.trim(),
      description: description?.trim() || `${name} skill`,
      tags: tags.map(tag => tag.toLowerCase().trim()),
      popularity: 0
    });

    await skill.save();

    res.status(201).json({
      message: 'Skill created successfully',
      skill
    });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({
      error: 'Failed to create skill',
      message: 'Unable to create skill. Please try again.'
    });
  }
});

/**
 * PUT /api/skills/:id
 * Update skill (admin only)
 */
router.put('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Skill name must be between 2 and 50 characters'),
  body('category').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Category must be between 2 and 30 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
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
    const allowedUpdates = ['name', 'category', 'description', 'tags'];
    
    // Filter out non-allowed fields
    const filteredUpdates = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'tags') {
          filteredUpdates[field] = updates[field].map(tag => tag.toLowerCase().trim());
        } else {
          filteredUpdates[field] = updates[field].trim();
        }
      }
    });

    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        message: 'Skill not found'
      });
    }

    res.json({
      message: 'Skill updated successfully',
      skill
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({
      error: 'Failed to update skill',
      message: 'Unable to update skill. Please try again.'
    });
  }
});

/**
 * DELETE /api/skills/:id
 * Delete skill (admin only)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    
    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        message: 'Skill not found'
      });
    }

    // Check if skill is being used by any users
    const usersWithSkill = await User.find({
      $or: [
        { 'skillsOffered.skillId': skill._id },
        { 'skillsWanted.skillId': skill._id }
      ]
    });

    if (usersWithSkill.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete skill',
        message: 'This skill is currently being used by users'
      });
    }

    await Skill.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Skill deleted successfully'
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      error: 'Failed to delete skill',
      message: 'Unable to delete skill. Please try again.'
    });
  }
});

/**
 * GET /api/skills/:id/users
 * Get users who have this skill
 */
router.get('/:id/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, totalCount] = await Promise.all([
      User.find({
        'skillsOffered.skillId': req.params.id,
        profileVisibility: 'public',
        isActive: true
      })
        .select('name location availability rating skillsOffered lastActive')
        .populate('skillsOffered.skillId', 'name category')
        .sort({ 'rating.average': -1, lastActive: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments({
        'skillsOffered.skillId': req.params.id,
        profileVisibility: 'public',
        isActive: true
      })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get skill users error:', error);
    res.status(500).json({
      error: 'Failed to get skill users',
      message: 'Unable to retrieve users with this skill. Please try again.'
    });
  }
});

module.exports = router;