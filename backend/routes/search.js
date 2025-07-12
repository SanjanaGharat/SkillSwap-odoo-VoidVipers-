const express = require('express');
const User = require('../models/User.js');
const Skill = require('../models/Skills.js');
const { optionalAuth, apiLimiter } = require('../middleware/auth.js');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * GET /api/search/users
 * Search for users with specific criteria
 */
router.get('/users', optionalAuth, async (req, res) => {
  try {
    const {
      q = '', // General search query
      skill,
      location,
      availability,
      minRating = 0,
      maxDistance,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {
      profileVisibility: 'public',
      isActive: true
    };

    // General search
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ];
    }

    // Skill filter
    if (skill) {
      query['skillsOffered.name'] = { $regex: skill, $options: 'i' };
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Availability filter
    if (availability && availability !== 'all') {
      query.availability = availability;
    }

    // Rating filter
    if (minRating > 0) {
      query['rating.average'] = { $gte: parseFloat(minRating) };
    }

    // Exclude current user from results
    if (req.user) {
      query._id = { $ne: req.user._id };
    }

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'location') {
      sortOptions.location = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'recent') {
      sortOptions.lastActive = sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default: sort by rating
      sortOptions['rating.average'] = sortOrder === 'desc' ? -1 : 1;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('name location availability bio rating skillsOffered skillsWanted lastActive profilePhotoUrl')
        .populate('skillsOffered.skillId', 'name category')
        .populate('skillsWanted.skillId', 'name category')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Format response
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      location: user.location,
      availability: user.availability,
      bio: user.bio,
      rating: user.rating,
      skillsOffered: user.skillsOffered.slice(0, 5), // Show first 5 skills
      skillsWanted: user.skillsWanted.slice(0, 5), // Show first 5 skills
      lastActive: user.lastActive,
      profilePhotoUrl: user.profilePhotoUrl
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Failed to search users',
      message: 'Unable to search users. Please try again.'
    });
  }
});

/**
 * GET /api/search/skills
 * Search for skills
 */
router.get('/skills', async (req, res) => {
  try {
    const {
      q = '', // Search query
      category,
      page = 1,
      limit = 20,
      sortBy = 'popularity',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};

    // General search
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'category') {
      sortOptions.category = sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default: sort by popularity
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
    console.error('Search skills error:', error);
    res.status(500).json({
      error: 'Failed to search skills',
      message: 'Unable to search skills. Please try again.'
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        users: [],
        skills: [],
        locations: []
      });
    }

    const suggestions = {};

    // Get user suggestions
    if (type === 'all' || type === 'users') {
      const userSuggestions = await User.find({
        profileVisibility: 'public',
        isActive: true,
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { location: { $regex: q, $options: 'i' } }
        ]
      })
        .select('name location')
        .limit(5);

      suggestions.users = userSuggestions.map(user => ({
        id: user._id,
        name: user.name,
        location: user.location
      }));
    }

    // Get skill suggestions
    if (type === 'all' || type === 'skills') {
      const skillSuggestions = await Skill.find({
        name: { $regex: q, $options: 'i' }
      })
        .select('name category')
        .sort({ popularity: -1 })
        .limit(5);

      suggestions.skills = skillSuggestions.map(skill => ({
        id: skill._id,
        name: skill.name,
        category: skill.category
      }));
    }

    // Get location suggestions
    if (type === 'all' || type === 'locations') {
      const locationSuggestions = await User.distinct('location', {
        profileVisibility: 'public',
        isActive: true,
        location: { $regex: q, $options: 'i' }
      });

      suggestions.locations = locationSuggestions
        .filter(location => location && location.trim())
        .slice(0, 5);
    }

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: 'Unable to get search suggestions. Please try again.'
    });
  }
});

/**
 * GET /api/search/autocomplete
 * Get autocomplete suggestions
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    let results = [];

    if (type === 'all' || type === 'skills') {
      const skills = await Skill.find({
        name: { $regex: `^${q}`, $options: 'i' }
      })
        .select('name category')
        .sort({ popularity: -1 })
        .limit(10);

      results.push(...skills.map(skill => ({
        type: 'skill',
        id: skill._id,
        name: skill.name,
        category: skill.category,
        display: `${skill.name} (${skill.category})`
      })));
    }

    if (type === 'all' || type === 'users') {
      const users = await User.find({
        profileVisibility: 'public',
        isActive: true,
        name: { $regex: `^${q}`, $options: 'i' }
      })
        .select('name location')
        .limit(5);

      results.push(...users.map(user => ({
        type: 'user',
        id: user._id,
        name: user.name,
        location: user.location,
        display: `${user.name} (${user.location || 'No location'})`
      })));
    }

    // Sort by relevance (skills first, then users)
    results.sort((a, b) => {
      if (a.type === 'skill' && b.type === 'user') return -1;
      if (a.type === 'user' && b.type === 'skill') return 1;
      return 0;
    });

    res.json(results.slice(0, 15)); // Limit to 15 total results
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      error: 'Failed to get autocomplete',
      message: 'Unable to get autocomplete suggestions. Please try again.'
    });
  }
});

/**
 * GET /api/search/advanced
 * Advanced search with multiple criteria
 */
router.get('/advanced', optionalAuth, async (req, res) => {
  try {
    const {
      skills = [],
      location,
      availability,
      minRating = 0,
      maxRating = 5,
      hasSkillsOffered,
      hasSkillsWanted,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    let query = {
      profileVisibility: 'public',
      isActive: true
    };

    // Skills filter
    if (skills.length > 0) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      query['skillsOffered.name'] = { $in: skillsArray.map(s => new RegExp(s, 'i')) };
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Availability filter
    if (availability && availability !== 'all') {
      query.availability = availability;
    }

    // Rating filter
    if (minRating > 0 || maxRating < 5) {
      query['rating.average'] = {
        $gte: parseFloat(minRating),
        $lte: parseFloat(maxRating)
      };
    }

    // Skills offered/wanted filter
    if (hasSkillsOffered === 'true') {
      query['skillsOffered.0'] = { $exists: true };
    }
    if (hasSkillsWanted === 'true') {
      query['skillsWanted.0'] = { $exists: true };
    }

    // Exclude current user
    if (req.user) {
      query._id = { $ne: req.user._id };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('name location availability bio rating skillsOffered skillsWanted lastActive profilePhotoUrl')
        .populate('skillsOffered.skillId', 'name category')
        .populate('skillsWanted.skillId', 'name category')
        .sort({ 'rating.average': -1, lastActive: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Format response
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      location: user.location,
      availability: user.availability,
      bio: user.bio,
      rating: user.rating,
      skillsOffered: user.skillsOffered,
      skillsWanted: user.skillsWanted,
      lastActive: user.lastActive,
      profilePhotoUrl: user.profilePhotoUrl
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      error: 'Failed to perform advanced search',
      message: 'Unable to perform advanced search. Please try again.'
    });
  }
});

module.exports = router;