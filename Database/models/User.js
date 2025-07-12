// models/User.js (Firebase version)
const mongoose = require('mongoose');

const skillSubSchema = new mongoose.Schema({
  skillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  proficiencyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  yearsExperience: {
    type: Number,
    min: 0,
    max: 50
  }
}, { _id: false });

const wantedSkillSubSchema = new mongoose.Schema({
  skillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, { _id: false });

const ratingSubSchema = new mongoose.Schema({
  average: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
    set: function(val) {
      return Math.round(val * 10) / 10;
    }
  },
  count: {
    type: Number,
    min: 0,
    default: 0
  },
  total: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Firebase-specific fields
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User profile
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minLength: [1, 'Name must be at least 1 character'],
    maxLength: [255, 'Name cannot exceed 255 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    trim: true,
    maxLength: [255, 'Location cannot exceed 255 characters']
  },
  profilePhotoUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Profile photo must be a valid URL'
    }
  },
  availability: {
    type: String,
    enum: {
      values: ['weekends', 'weekdays', 'evenings', 'flexible'],
      message: 'Availability must be one of: weekends, weekdays, evenings, flexible'
    },
    default: 'flexible'
  },
  profileVisibility: {
    type: String,
    enum: {
      values: ['public', 'private'],
      message: 'Profile visibility must be either public or private'
    },
    default: 'public'
  },
  
  // Skills
  skillsOffered: [skillSubSchema],
  skillsWanted: [wantedSkillSubSchema],
  
  // Rating system
  rating: {
    type: ratingSubSchema,
    default: () => ({})
  },
  
  // Activity tracking
  lastActive: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
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
userSchema.index({ firebaseUid: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ location: 1 });
userSchema.index({ availability: 1 });
userSchema.index({ 'skillsOffered.name': 1 });
userSchema.index({ 'skillsWanted.name': 1 });
userSchema.index({ 'rating.average': -1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ profileVisibility: 1, isActive: 1 });

// Compound indexes
userSchema.index({ 
  'skillsOffered.name': 1, 
  location: 1, 
  availability: 1 
});
userSchema.index({ 
  'skillsWanted.name': 1, 
  'rating.average': -1 
});

// Static methods
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Keep all the existing methods from the original User model
userSchema.methods.updateRating = function(newRating) {
  this.rating.total += newRating;
  this.rating.count += 1;
  this.rating.average = this.rating.total / this.rating.count;
  return this.save();
};

userSchema.methods.addSkillOffered = function(skillData) {
  const existingSkill = this.skillsOffered.find(
    skill => skill.skillId.toString() === skillData.skillId.toString()
  );
  
  if (!existingSkill) {
    this.skillsOffered.push(skillData);
    return this.save();
  }
  
  throw new Error('Skill already exists in offered skills');
};

userSchema.methods.addSkillWanted = function(skillData) {
  const existingSkill = this.skillsWanted.find(
    skill => skill.skillId.toString() === skillData.skillId.toString()
  );
  
  if (!existingSkill) {
    this.skillsWanted.push(skillData);
    return this.save();
  }
  
  throw new Error('Skill already exists in wanted skills');
};

module.exports = mongoose.model('User', userSchema);