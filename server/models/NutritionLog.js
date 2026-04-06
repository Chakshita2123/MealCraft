const mongoose = require('mongoose');

const nutritionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // format: 'YYYY-MM-DD'
  meals: [{
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
    recipeId: { type: String },
    recipeName: { type: String, required: true },
    image: { type: String },
    nutrition: {
      calories: { type: Number, default: 0 },
      protein:  { type: Number, default: 0 }, // grams
      carbs:    { type: Number, default: 0 }, // grams
      fat:      { type: Number, default: 0 }, // grams
      fiber:    { type: Number, default: 0 }, // grams
    },
    servings: { type: Number, default: 1 },
    loggedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Compound index for fast user+date lookups
nutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
