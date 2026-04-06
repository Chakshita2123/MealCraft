const mongoose = require('mongoose');

const mealSlotSchema = new mongoose.Schema({
  recipeId: String,
  title: String,
  image: String,
  ingredients: [String],
  matchPercentage: { type: Number, default: 0 }
});

const dayMealSchema = new mongoose.Schema({
  dayName: String,
  breakfast: mealSlotSchema,
  lunch: mealSlotSchema,
  dinner: mealSlotSchema
}, { _id: false });

const mealPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  week: [dayMealSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MealPlan', mealPlanSchema);
