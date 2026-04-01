const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const shoppingItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Produce', 'Dairy', 'Meat & Seafood', 'Pantry', 'Frozen', 'Bakery', 'Beverages', 'Spices', 'Other'],
    default: 'Other'
  },
  purchased: { type: Boolean, default: false },
  recipeId: { type: Number },
  recipeTitle: { type: String }
});

const savedRecipeSchema = new mongoose.Schema({
  spoonacularId: { type: Number, required: true },
  title: { type: String, required: true },
  image: { type: String },
  readyInMinutes: { type: Number },
  servings: { type: Number },
  vegetarian: { type: Boolean },
  matchPercentage: { type: Number },
  savedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  savedRecipes: [savedRecipeSchema],
  shoppingList: [shoppingItemSchema]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
