const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const NutritionLog = require('../models/NutritionLog');

const router = express.Router();

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

// Helper to get today's date string
const getToday = () => new Date().toISOString().split('T')[0];

// =========================================================
// GET /api/nutrition/today
// Returns today's log with all meals and computed totals
// =========================================================
router.get('/today', auth, async (req, res) => {
  try {
    const today = getToday();
    let log = await NutritionLog.findOne({ userId: req.user._id, date: today });
    
    if (!log) {
      return res.json({
        success: true,
        log: { date: today, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } }
      });
    }

    // Compute totals considering servings
    const totals = log.meals.reduce((acc, meal) => {
      const s = meal.servings || 1;
      acc.calories += (meal.nutrition.calories || 0) * s;
      acc.protein += (meal.nutrition.protein || 0) * s;
      acc.carbs += (meal.nutrition.carbs || 0) * s;
      acc.fat += (meal.nutrition.fat || 0) * s;
      acc.fiber += (meal.nutrition.fiber || 0) * s;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    // Round all totals to 1 decimal
    Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);

    res.json({ success: true, log: { ...log.toObject(), totals } });
  } catch (error) {
    console.error('Get today nutrition error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching today\'s nutrition' });
  }
});

// =========================================================
// POST /api/nutrition/log
// Body: { mealType, recipeId, recipeName, image, nutrition, servings }
// =========================================================
router.post('/log', auth, async (req, res) => {
  try {
    const today = getToday();
    const { mealType, recipeId, recipeName, image, nutrition, servings = 1 } = req.body;

    if (!mealType || !recipeName) {
      return res.status(400).json({
        success: false,
        message: 'mealType and recipeName are required'
      });
    }

    let log = await NutritionLog.findOne({ userId: req.user._id, date: today });
    if (!log) {
      log = new NutritionLog({ userId: req.user._id, date: today, meals: [] });
    }

    log.meals.push({ mealType, recipeId, recipeName, image, nutrition, servings });
    await log.save();

    res.json({ success: true, message: 'Meal logged!', log });
  } catch (error) {
    console.error('Log meal error:', error.message);
    res.status(500).json({ success: false, message: 'Error logging meal' });
  }
});

// =========================================================
// DELETE /api/nutrition/remove
// Body: { mealId } — remove specific meal entry by its _id
// =========================================================
router.delete('/remove', auth, async (req, res) => {
  try {
    const today = getToday();
    const { mealId } = req.body;

    const log = await NutritionLog.findOne({ userId: req.user._id, date: today });
    if (!log) {
      return res.status(404).json({ success: false, message: 'No log found for today' });
    }

    log.meals = log.meals.filter(m => m._id.toString() !== mealId);
    await log.save();

    res.json({ success: true, message: 'Meal removed', log });
  } catch (error) {
    console.error('Remove meal error:', error.message);
    res.status(500).json({ success: false, message: 'Error removing meal' });
  }
});

// =========================================================
// GET /api/nutrition/weekly
// Returns last 7 days of calorie data for chart
// =========================================================
router.get('/weekly', auth, async (req, res) => {
  try {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const logs = await NutritionLog.find({
      userId: req.user._id,
      date: { $in: dates }
    });

    const logMap = {};
    logs.forEach(log => {
      const cal = log.meals.reduce((sum, m) => sum + (m.nutrition.calories || 0) * (m.servings || 1), 0);
      logMap[log.date] = Math.round(cal);
    });

    const weekly = dates.map(date => ({
      date,
      day: new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }),
      calories: logMap[date] || 0
    }));

    res.json({ success: true, weekly });
  } catch (error) {
    console.error('Get weekly nutrition error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching weekly data' });
  }
});

// =========================================================
// GET /api/nutrition/search?q=query
// Search recipes with nutrition data from MealDB
// =========================================================
router.get('/search', auth, async (req, res) => {
  try {
    const { q, number = 8 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, recipes: [] });
    }

    // Search MealDB by meal name
    const response = await axios.get(`${MEALDB_BASE}/search.php?s=${q}`, {
      timeout: 5000
    });

    const meals = (response.data.meals || []).slice(0, number);

    // Helper function to estimate nutrition based on meal category
    const estimateNutrition = (meal) => {
      // Default moderate nutrition values (can be customized per meal type)
      // These are rough estimates for a typical meal serving
      return {
        calories: 350,
        protein: 25,
        carbs: 45,
        fat: 12,
        fiber: 4
      };
    };

    const recipes = meals.map(meal => ({
      id: meal.idMeal,
      title: meal.strMeal,
      image: meal.strMealThumb,
      readyInMinutes: null, // MealDB doesn't provide cooking time
      servings: 1,
      nutrition: estimateNutrition(meal)
    }));

    res.json({ success: true, recipes });
  } catch (error) {
    console.error('Nutrition search error:', error.message);
    // Silently return empty array on error
    res.json({ success: true, recipes: [] });
  }
});

module.exports = router;
