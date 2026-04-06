const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const MealPlan = require('../models/MealPlan');

const router = express.Router();

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

// Helper: categorize ingredient by aisle
const categorizeIngredient = (aisle) => {
  if (!aisle) return 'Other';
  const lower = aisle.toLowerCase();
  if (lower.includes('produce') || lower.includes('fruit') || lower.includes('vegetable')) return 'Produce';
  if (lower.includes('dairy') || lower.includes('milk') || lower.includes('cheese') || lower.includes('egg')) return 'Dairy';
  if (lower.includes('meat') || lower.includes('seafood') || lower.includes('poultry')) return 'Meat & Seafood';
  if (lower.includes('baking') || lower.includes('canned') || lower.includes('pasta') || lower.includes('grain') || lower.includes('cereal')) return 'Pantry';
  if (lower.includes('frozen')) return 'Frozen';
  if (lower.includes('bread') || lower.includes('bakery')) return 'Bakery';
  if (lower.includes('beverage') || lower.includes('drink') || lower.includes('juice')) return 'Beverages';
  if (lower.includes('spice') || lower.includes('seasoning') || lower.includes('oil') || lower.includes('vinegar') || lower.includes('condiment')) return 'Spices';
  return 'Other';
};

// Helper: extract ingredients from MealDB recipe
const extractIngredientsFromMeal = (meal) => {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push(ingredient.trim());
    }
  }
  return ingredients;
};

// Initialize user's meal plan if not exists
const ensureMealPlanExists = async (userId) => {
  let plan = await MealPlan.findOne({ userId });
  if (!plan) {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const week = daysOfWeek.map(dayName => ({
      dayName,
      breakfast: {},
      lunch: {},
      dinner: {}
    }));
    plan = new MealPlan({ userId, week });
    await plan.save();
  }
  return plan;
};

// =========================================================
// GET /api/mealplan
// =========================================================
router.get('/', auth, async (req, res) => {
  try {
    const user = req.user;
    const plan = await ensureMealPlanExists(user._id);
    res.json({ success: true, mealPlan: plan.week });
  } catch (error) {
    console.error('Get meal plan error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching meal plan.' });
  }
});

// =========================================================
// POST /api/mealplan/add
// =========================================================
router.post('/add', auth, async (req, res) => {
  try {
    const user = req.user;
    const { day, slot, recipe } = req.body;

    if (day === undefined || !slot || !recipe) {
      return res.status(400).json({
        success: false,
        message: 'Please provide day, slot, and recipe.'
      });
    }

    if (day < 0 || day > 6) {
      return res.status(400).json({
        success: false,
        message: 'Day must be 0-6.'
      });
    }

    if (!['breakfast', 'lunch', 'dinner'].includes(slot)) {
      return res.status(400).json({
        success: false,
        message: 'Slot must be breakfast, lunch, or dinner.'
      });
    }

    const plan = await ensureMealPlanExists(user._id);

    // Update the slot
    plan.week[day][slot] = {
      recipeId: recipe.id,
      title: recipe.title,
      image: recipe.image,
      ingredients: recipe.ingredients || [],
      matchPercentage: recipe.matchPercentage || 0
    };

    plan.updatedAt = new Date();
    await plan.save();

    res.json({ success: true, mealPlan: plan.week });
  } catch (error) {
    console.error('Add meal plan error:', error.message);
    res.status(500).json({ success: false, message: 'Error adding meal to plan.' });
  }
});

// =========================================================
// DELETE /api/mealplan/remove
// =========================================================
router.delete('/remove', auth, async (req, res) => {
  try {
    const user = req.user;
    const { day, slot } = req.body;

    if (day === undefined || !slot) {
      return res.status(400).json({
        success: false,
        message: 'Please provide day and slot.'
      });
    }

    if (day < 0 || day > 6) {
      return res.status(400).json({
        success: false,
        message: 'Day must be 0-6.'
      });
    }

    const plan = await ensureMealPlanExists(user._id);

    // Clear the slot
    plan.week[day][slot] = {};
    plan.updatedAt = new Date();
    await plan.save();

    res.json({ success: true, mealPlan: plan.week });
  } catch (error) {
    console.error('Remove meal plan error:', error.message);
    res.status(500).json({ success: false, message: 'Error removing meal from plan.' });
  }
});

// =========================================================
// POST /api/mealplan/generate-shopping
// =========================================================
router.post('/generate-shopping', auth, async (req, res) => {
  try {
    const user = req.user;

    // Get the meal plan
    const plan = await ensureMealPlanExists(user._id);

    // Collect all ingredients from all slots
    const allIngredients = [];
    plan.week.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(slot => {
        if (day[slot] && day[slot].ingredients && Array.isArray(day[slot].ingredients)) {
          allIngredients.push(...day[slot].ingredients);
        }
      });
    });

    // Deduplicate (case-insensitive)
    const uniqueIngredients = [];
    const seen = new Set();
    allIngredients.forEach(ing => {
      const lower = ing.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueIngredients.push(ing);
      }
    });

    // Fetch ingredient details from MealDB to get categories
    const itemsToAdd = [];
    for (const ingredient of uniqueIngredients) {
      // Check if already in shopping list
      const exists = user.shoppingList.some(
        existing => existing.name.toLowerCase() === ingredient.toLowerCase()
      );

      if (!exists) {
        itemsToAdd.push({
          name: ingredient,
          category: 'Other',
          purchased: false
        });
      }
    }

    // Add items to user's shopping list
    if (itemsToAdd.length > 0) {
      user.shoppingList.push(...itemsToAdd);
      await user.save();
    }

    res.json({
      success: true,
      message: `Added ${itemsToAdd.length} ingredients to shopping list`,
      added: itemsToAdd.length
    });
  } catch (error) {
    console.error('Generate shopping error:', error.message);
    res.status(500).json({ success: false, message: 'Error generating shopping list.' });
  }
});

module.exports = router;
