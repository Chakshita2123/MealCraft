const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';
const SPOONACULAR_BASE = 'https://api.spoonacular.com';

// =========================================================
// HELPER: Format Spoonacular recipe to our format
// =========================================================
const formatSpoonacularMeal = (recipe, userIngredients = []) => {
  const ingredients = (recipe.extendedIngredients || recipe.usedIngredients || []).map((ing, i) => {
    const ingName = (ing.name || ing.nameClean || '').toLowerCase();
    const have = userIngredients.some(ui => {
      const uiLower = ui.toLowerCase().trim();
      return ingName.includes(uiLower) || uiLower.includes(ingName);
    });
    return {
      id: i + 1,
      name: ing.name || ing.nameClean || '',
      amount: ing.measures?.metric?.amount ? `${ing.measures.metric.amount} ${ing.measures.metric.unitShort || ''}`.trim() : (ing.amount ? `${ing.amount} ${ing.unit || ''}`.trim() : ''),
      original: ing.original || ing.originalString || '',
      unit: ing.unit || '',
      aisle: ing.aisle || 'Other',
      have
    };
  });

  const usedCount = ingredients.filter(i => i.have).length;
  const total = ingredients.length;

  return {
    id: `sp_${recipe.id}`,
    title: recipe.title,
    image: recipe.image,
    category: recipe.dishTypes?.[0] || null,
    area: recipe.cuisines?.[0] || null,
    tags: recipe.dishTypes || [],
    vegetarian: recipe.vegetarian || false,
    readyInMinutes: recipe.readyInMinutes || null,
    servings: recipe.servings || 4,
    matchPercentage: total > 0 ? Math.round((usedCount / total) * 100) : 0,
    usedIngredientCount: usedCount,
    missedIngredientCount: total - usedCount,
    ingredients,
    missedIngredients: ingredients.filter(i => !i.have),
    difficulty: getDifficulty(recipe.readyInMinutes),
    steps: (recipe.analyzedInstructions?.[0]?.steps || []).map(s => ({
      number: s.number,
      step: s.step
    })),
    sourceUrl: recipe.sourceUrl || null,
    youtubeUrl: null,
    source: 'spoonacular'
  };
};

// =========================================================
// HELPER: Search Spoonacular by name/cuisine
// =========================================================
const searchSpoonacular = async (query = '', cuisine = '', vegetarian = false, number = 12) => {
  try {
    const params = {
      apiKey: process.env.SPOONACULAR_API_KEY,
      number,
      addRecipeInformation: true,
      fillIngredients: true,
      instructionsRequired: true,
    };
    if (query) params.query = query;
    if (cuisine && cuisine !== 'All') params.cuisine = cuisine;
    if (vegetarian) params.diet = 'vegetarian';

    const res = await axios.get(`${SPOONACULAR_BASE}/recipes/complexSearch`, { params, timeout: 8000 });
    return (res.data?.results || []).map(r => formatSpoonacularMeal(r));
  } catch (e) {
    console.warn('Spoonacular search failed:', e.message);
    return [];
  }
};

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
        (response.data?.meals || []).forEach(meal => {
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

    // Supplement with Spoonacular results
    const spoonacularResults = await searchSpoonacular(ingredients.slice(0,3).join(','), '', vegetarian === true || vegetarian === 'true', 8);
    const titlesSeen = new Set(recipes.map(r => r.title.toLowerCase()));
    const uniqueSpoon = spoonacularResults.filter(r => !titlesSeen.has(r.title.toLowerCase()));
    const combined = [...recipes, ...uniqueSpoon];

    res.json({ success: true, recipes: combined, total: combined.length });
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
// GET /api/recipes/search-by-name
// =========================================================
router.get('/search-by-name', async (req, res) => {
  try {
    const { query, cuisine, vegetarian, number = 24 } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a search query.' });
    }

    const mealMap = {};

    // Strategy 1: search by name
    try {
      const nameRes = await axios.get(`${MEALDB_BASE}/search.php`, { params: { s: query.trim() }, timeout: 5000 });
      (nameRes.data?.meals || []).forEach(m => { mealMap[m.idMeal] = m; });
    } catch (e) { console.warn('Name search failed:', e.message); }

    // Strategy 2: search by first letter (catches more results)
    try {
      const letterRes = await axios.get(`${MEALDB_BASE}/search.php`, { params: { f: query.trim()[0] }, timeout: 5000 });
      const queryLower = query.trim().toLowerCase();
      (letterRes.data?.meals || [])
        .filter(m => m.strMeal.toLowerCase().includes(queryLower))
        .forEach(m => { mealMap[m.idMeal] = m; });
    } catch (e) { console.warn('Letter search failed:', e.message); }

    // Strategy 3: if cuisine filter set, fetch all from that area and filter by query
    if (cuisine && cuisine !== 'All') {
      try {
        const areaRes = await axios.get(`${MEALDB_BASE}/filter.php`, { params: { a: cuisine }, timeout: 5000 });
        const queryLower = query.trim().toLowerCase();
        (areaRes.data?.meals || [])
          .filter(m => m.strMeal.toLowerCase().includes(queryLower))
          .forEach(m => { if (!mealMap[m.idMeal]) mealMap[m.idMeal] = m; });
      } catch (e) { console.warn('Area search failed:', e.message); }
    }

    // Strategy 4: if no cuisine filter or query is short, also search ingredient
    if (Object.keys(mealMap).length < 5) {
      try {
        const ingRes = await axios.get(`${MEALDB_BASE}/filter.php`, { params: { i: query.trim() }, timeout: 5000 });
        (ingRes.data?.meals || []).forEach(m => { if (!mealMap[m.idMeal]) mealMap[m.idMeal] = m; });
      } catch (e) {}
    }

    let meals = Object.values(mealMap);

    // Apply cuisine filter
    if (cuisine && cuisine !== 'All') {
      meals = meals.filter(m => (m.strArea || '').toLowerCase() === cuisine.toLowerCase());
    }

    if (meals.length === 0) {
      return res.json({ success: true, recipes: [] });
    }

    // Fetch full details for top results
    const detailedMeals = await Promise.all(
      meals.slice(0, parseInt(number)).map(async (meal) => {
        if (meal.strInstructions) return meal; // already detailed
        try {
          const detailRes = await axios.get(`${MEALDB_BASE}/lookup.php`, { params: { i: meal.idMeal }, timeout: 5000 });
          return detailRes.data?.meals?.[0] || meal;
        } catch { return meal; }
      })
    );

    let filtered = detailedMeals.filter(Boolean);

    // Vegetarian filter
    if (vegetarian === 'true') {
      filtered = filtered.filter(meal => {
        const cat = (meal.strCategory || '').toLowerCase();
        const tags = (meal.strTags || '').toLowerCase();
        return cat.includes('vegetarian') || cat.includes('vegan') || tags.includes('vegetarian') || tags.includes('vegan');
      });
    }

    const mealdbRecipes = filtered.map(meal => formatMeal(meal, []));

    // Also fetch from Spoonacular for richer results (especially Indian)
    const spoonacularRecipes = await searchSpoonacular(query, cuisine, vegetarian === 'true', 12);

    // Merge — deduplicate by title (case insensitive)
    const titlesSeen = new Set(mealdbRecipes.map(r => r.title.toLowerCase()));
    const uniqueSpoonacular = spoonacularRecipes.filter(r => !titlesSeen.has(r.title.toLowerCase()));

    const recipes = [...mealdbRecipes, ...uniqueSpoonacular];

    res.json({ success: true, recipes });
  } catch (error) {
    console.error('Recipe search-by-name error:', error.message);
    res.status(500).json({ success: false, message: 'Error searching recipes. Please try again.' });
  }
});

// =========================================================
// GET /api/recipes/:id — MUST BE LAST
// =========================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIngredients } = req.query;

    const userIngList = userIngredients
      ? userIngredients.split(',').map(i => i.trim()).filter(Boolean)
      : [];

    // Spoonacular recipe (id starts with sp_)
    if (id.startsWith('sp_')) {
      const spoonId = id.replace('sp_', '');
      const response = await axios.get(`${SPOONACULAR_BASE}/recipes/${spoonId}/information`, {
        params: { apiKey: process.env.SPOONACULAR_API_KEY, includeNutrition: true },
        timeout: 8000
      });
      const recipe = formatSpoonacularMeal(response.data, userIngList);
      return res.json({ success: true, recipe });
    }

    // TheMealDB recipe
    const response = await axios.get(`${MEALDB_BASE}/lookup.php`, {
      params: { i: id },
      timeout: 5000
    });

    const meal = response.data?.meals?.[0];
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Recipe not found.' });
    }

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