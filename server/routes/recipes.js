const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

// =========================================================
// HELPER: Estimate cook time from instructions length
// =========================================================
const estimateCookTime = (instructions = '') => {
  // Try to find time mentions like "30 minutes", "1 hour"
  const minMatch = instructions.match(/(\d+)\s*(?:to\s*\d+\s*)?minutes?/i);
  const hrMatch = instructions.match(/(\d+)\s*(?:to\s*\d+\s*)?hours?/i);

  if (hrMatch) return parseInt(hrMatch[1]) * 60;
  if (minMatch) return parseInt(minMatch[1]);
  return null; // unknown
};

const getDifficulty = (minutes) => {
  if (!minutes) return null;
  if (minutes <= 20) return 'Easy';
  if (minutes <= 45) return 'Medium';
  return 'Hard';
};

// =========================================================
// HELPER: Convert MealDB meal to our format
// =========================================================
const formatMeal = (meal, userIngredients = []) => {
  const ingredients = [];

  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];

    if (name && name.trim()) {
      const ingName = name.toLowerCase().trim();
      const measureClean = measure?.trim() || '';

      const have = userIngredients.some(ui => {
        const uiLower = ui.toLowerCase().trim();
        return ingName.includes(uiLower) || uiLower.includes(ingName);
      });

      ingredients.push({
        id: i,
        name: name.trim(),
        // FIX: amount is the full measure string (e.g. "2 tbsp"), not a number
        // Kept as string to avoid NaN on frontend
        amount: measureClean,
        original: measureClean ? `${measureClean} ${name.trim()}` : name.trim(),
        unit: '',
        aisle: 'Other',
        have
      });
    }
  }

  const usedCount = ingredients.filter(i => i.have).length;
  const missedCount = ingredients.filter(i => !i.have).length;
  const total = usedCount + missedCount;

  const isVegetarian =
    meal.strCategory === 'Vegetarian' ||
    meal.strCategory === 'Vegan' ||
    (meal.strTags?.toLowerCase().includes('vegetarian')) ||
    (meal.strTags?.toLowerCase().includes('vegan'));

  const cookTime = estimateCookTime(meal.strInstructions);

  // Parse steps — handle both \r\n and \n, and skip blank/numbering-only lines
  const steps = meal.strInstructions
    ? meal.strInstructions
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 3 && !/^\d+\.?$/.test(s)) // skip "1." "2" etc
      .map((step, idx) => ({
        number: idx + 1,
        step
      }))
    : [];

  return {
    id: meal.idMeal,
    title: meal.strMeal,
    image: meal.strMealThumb,
    category: meal.strCategory || null,
    area: meal.strArea || null,
    tags: meal.strTags ? meal.strTags.split(',').map(t => t.trim()).filter(Boolean) : [],
    vegetarian: isVegetarian,
    // FIX: null instead of hardcoded 30 — frontend should show "N/A" if null
    readyInMinutes: cookTime,
    servings: 4,
    matchPercentage: total > 0 ? Math.round((usedCount / total) * 100) : 0,
    usedIngredientCount: usedCount,
    missedIngredientCount: missedCount,
    ingredients,
    missedIngredients: ingredients.filter(i => !i.have),
    // FIX: null instead of hardcoded "Medium"
    difficulty: getDifficulty(cookTime),
    steps,
    sourceUrl: meal.strSource || null,
    youtubeUrl: meal.strYoutube || null
  };
};

// =========================================================
// HELPER: Fetch & deduplicate meals by ingredient list
// Max ingredients to search: raised from 5 → 8
// =========================================================
const fetchMealsByIngredients = async (ingredientList, limit = 8) => {
  const mealMap = {};

  await Promise.all(
    ingredientList.slice(0, limit).map(async (ingredient) => {
      try {
        const response = await axios.get(`${MEALDB_BASE}/filter.php`, {
          params: { i: ingredient },
          timeout: 5000
        });
        const meals = response.data?.meals || [];
        meals.forEach(meal => {
          // idMeal as key = automatic deduplication
          if (!mealMap[meal.idMeal]) mealMap[meal.idMeal] = meal;
        });
      } catch (e) {
        console.warn(`Ingredient search failed for "${ingredient}":`, e.message);
      }
    })
  );

  return mealMap;
};

// =========================================================
// HELPER: Fetch detailed meals from id list
// =========================================================
const fetchDetailedMeals = async (mealIds, userIngredients, fetchLimit = 24) => {
  const results = await Promise.all(
    mealIds.slice(0, fetchLimit).map(async (id) => {
      try {
        const res = await axios.get(`${MEALDB_BASE}/lookup.php`, {
          params: { i: id },
          timeout: 5000
        });
        const meal = res.data?.meals?.[0];
        if (!meal) return null;
        return formatMeal(meal, userIngredients);
      } catch (e) {
        return null;
      }
    })
  );
  return results.filter(Boolean);
};

// =========================================================
// STATIC ROUTES FIRST
// =========================================================

// GET /api/recipes/saved/all
router.get('/saved/all', auth, async (req, res) => {
  try {
    res.json({ success: true, savedRecipes: req.user.savedRecipes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching saved recipes.' });
  }
});

// POST /api/recipes/save
router.post('/save', auth, async (req, res) => {
  try {
    const { recipe } = req.body;
    if (!recipe || !recipe.id) {
      return res.status(400).json({ success: false, message: 'Recipe data is required.' });
    }

    const user = req.user;
    const alreadySaved = user.savedRecipes.some(r => r.id === recipe.id);
    if (alreadySaved) {
      return res.status(400).json({ success: false, message: 'Recipe already saved.' });
    }

    user.savedRecipes.push(recipe);
    await user.save();

    res.json({ success: true, message: 'Recipe saved!', savedRecipes: user.savedRecipes });
  } catch (error) {
    console.error('Save recipe error:', error);
    res.status(500).json({ success: false, message: 'Error saving recipe.' });
  }
});

// DELETE /api/recipes/unsave/:id
router.delete('/unsave/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    user.savedRecipes = user.savedRecipes.filter(r => r.id !== id);
    await user.save();
    res.json({ success: true, message: 'Recipe removed.', savedRecipes: user.savedRecipes });
  } catch (error) {
    console.error('Unsave recipe error:', error);
    res.status(500).json({ success: false, message: 'Error removing recipe.' });
  }
});

// =========================================================
// POST /api/recipes/find — find recipes by ingredients
// =========================================================
router.post('/find', async (req, res) => {
  try {
    const { ingredients, vegetarian } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an ingredients array.'
      });
    }

    // FIX: raised from 5 → 8 ingredients searched
    const mealMap = await fetchMealsByIngredients(ingredients, 8);
    const mealIds = Object.keys(mealMap);

    if (mealIds.length === 0) {
      return res.json({ success: true, recipes: [], total: 0 });
    }

    // FIX: fetch more (24) so filters have enough results, return 12
    let recipes = await fetchDetailedMeals(mealIds, ingredients, 24);

    // Sort by match % descending
    recipes.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // Vegetarian filter
    if (vegetarian === true || vegetarian === 'true') {
      recipes = recipes.filter(r => r.vegetarian);
    }

    recipes = recipes.slice(0, 12);

    res.json({ success: true, recipes, total: recipes.length });
  } catch (error) {
    console.error('Recipe find error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error finding recipes. Please try again.'
    });
  }
});

// =========================================================
// GET /api/recipes/search
// =========================================================
router.get('/search', async (req, res) => {
  try {
    const { ingredients, cuisine, vegetarian } = req.query;

    if (!ingredients) {
      return res.status(400).json({
        success: false,
        message: 'Please provide ingredients to search.'
      });
    }

    const ingredientList = ingredients.split(',').map(i => i.trim()).filter(Boolean);

    // FIX: raised from 5 → 8 ingredients searched
    const mealMap = await fetchMealsByIngredients(ingredientList, 8);
    let mealIds = Object.keys(mealMap);

    // Cuisine filter — intersect with area results
    if (cuisine && cuisine.toLowerCase() !== 'all') {
      try {
        const areaRes = await axios.get(`${MEALDB_BASE}/filter.php`, {
          params: { a: cuisine },
          timeout: 5000
        });
        const areaMealIds = new Set((areaRes.data?.meals || []).map(m => m.idMeal));
        mealIds = mealIds.filter(id => areaMealIds.has(id));
      } catch (e) {
        console.warn('Cuisine filter failed:', e.message);
      }
    }

    if (mealIds.length === 0) {
      return res.json({ success: true, recipes: [], total: 0 });
    }

    // FIX: fetch more so filters have enough to work with
    let recipes = await fetchDetailedMeals(mealIds, ingredientList, 24);

    recipes.sort((a, b) => b.matchPercentage - a.matchPercentage);

    if (vegetarian === 'true') {
      recipes = recipes.filter(r => r.vegetarian);
    }

    recipes = recipes.slice(0, 12);

    res.json({ success: true, recipes, total: recipes.length });
  } catch (error) {
    console.error('Recipe search error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error searching recipes. Please try again.'
    });
  }
});

// =========================================================
// GET /api/recipes/:id — MUST BE LAST
// =========================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIngredients } = req.query;

    const response = await axios.get(`${MEALDB_BASE}/lookup.php`, {
      params: { i: id },
      timeout: 5000
    });

    const meal = response.data?.meals?.[0];
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Recipe not found.' });
    }

    const userIngList = userIngredients
      ? userIngredients.split(',').map(i => i.trim()).filter(Boolean)
      : [];

    const recipe = formatMeal(meal, userIngList);

    res.json({ success: true, recipe });
  } catch (error) {
    console.error('Recipe detail error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching recipe details.'
    });
  }
});

module.exports = router;