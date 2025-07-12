// models/Skill.js
const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    unique: true,
    trim: true,
    minLength: [1, 'Skill name must be at least 1 character'],
    maxLength: [100, 'Skill name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxLength: [50, 'Category cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  popularity: {
    type: Number,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
skillSchema.index({ name: 1 }, { unique: true });
skillSchema.index({ category: 1 });
skillSchema.index({ tags: 1 });
skillSchema.index({ popularity: -1 });
skillSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtual for display name
skillSchema.virtual('displayName').get(function() {
  return this.name;
});

// Methods
skillSchema.methods.incrementPopularity = function() {
  this.popularity += 1;
  return this.save();
};

skillSchema.methods.decrementPopularity = function() {
  if (this.popularity > 0) {
    this.popularity -= 1;
    return this.save();
  }
  return Promise.resolve(this);
};

skillSchema.methods.addTag = function(tag) {
  const normalizedTag = tag.toLowerCase().trim();
  if (!this.tags.includes(normalizedTag)) {
    this.tags.push(normalizedTag);
    return this.save();
  }
  return Promise.resolve(this);
};

// Static methods
skillSchema.statics.findByName = function(name) {
  return this.findOne({ 
    name: new RegExp(`^${name}$`, 'i'),
    isActive: true 
  });
};

skillSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category: new RegExp(category, 'i'),
    isActive: true 
  }).sort({ popularity: -1 });
};

skillSchema.statics.searchSkills = function(searchTerm) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: new RegExp(searchTerm, 'i') },
          { description: new RegExp(searchTerm, 'i') },
          { tags: new RegExp(searchTerm, 'i') }
        ]
      }
    ]
  }).sort({ popularity: -1 });
};

skillSchema.statics.getPopularSkills = function(limit = 20) {
  return this.find({ isActive: true })
    .sort({ popularity: -1 })
    .limit(limit);
};

skillSchema.statics.getSkillsByCategory = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        skills: {
          $push: {
            _id: '$_id',
            name: '$name',
            popularity: '$popularity'
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

skillSchema.statics.createSkillWithTags = function(skillData) {
  const skill = new this(skillData);
  
  // Auto-generate tags from name and category
  const autoTags = [
    ...skillData.name.toLowerCase().split(' '),
    ...skillData.category.toLowerCase().split(' ')
  ].filter(tag => tag.length > 2);
  
  skill.tags = [...new Set([...(skillData.tags || []), ...autoTags])];
  
  return skill.save();
};

// Pre-save middleware
skillSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  
  if (this.isModified('tags')) {
    this.tags = [...new Set(this.tags.map(tag => tag.toLowerCase().trim()))]
      .filter(tag => tag.length > 1);
  }
  
  next();
});

// Post-save middleware
skillSchema.post('save', async function(doc) {
  // Update skill references in User collection when skill name changes
  if (this.isModified('name')) {
    const User = mongoose.model('User');
    
    await Promise.all([
      User.updateMany(
        { 'skillsOffered.skillId': doc._id },
        { $set: { 'skillsOffered.$.name': doc.name, 'skillsOffered.$.category': doc.category } }
      ),
      User.updateMany(
        { 'skillsWanted.skillId': doc._id },
        { $set: { 'skillsWanted.$.name': doc.name, 'skillsWanted.$.category': doc.category } }
      )
    ]);
  }
});

module.exports = mongoose.model('Skill', skillSchema);