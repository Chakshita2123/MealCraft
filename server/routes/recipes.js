const express = require('express');
const axios = require('axios');
const { auth, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const SPOONACULAR_BASE = 'https://api.spoonacular.com';

// =========================================================
// IMPORTANT: Static routes MUST come before :id catch-all
// =========================================================

// GET /api/recipes/saved/all — fetch user's saved recipes
router.get('/saved/all', auth, async (req, res) => {
  try {
    res.json({ success: true, savedRecipes: req.user.savedRecipes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching saved recipes.' });
  }
});

// POST /api/recipes/save — save a recipe
router.post('/save', auth, async (req, res) => {
  try {
    const { recipe } = req.body;

    if (!recipe || !recipe.spoonacularId) {
      return res.status(400).json({ success: false, message: 'Recipe data is required.' });
    }

    const user = req.user;

    // Check if already saved
    const alreadySaved = user.savedRecipes.some(
      r => r.spoonacularId === recipe.spoonacularId
    );
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

// DELETE /api/recipes/unsave/:spoonacularId — unsave a recipe
router.delete('/unsave/:spoonacularId', auth, async (req, res) => {
  try {
    const { spoonacularId } = req.params;
    const user = req.user;

    user.savedRecipes = user.savedRecipes.filter(
      r => r.spoonacularId !== parseInt(spoonacularId)
    );
    await user.save();

    res.json({ success: true, message: 'Recipe removed.', savedRecipes: user.savedRecipes });
  } catch (error) {
    console.error('Unsave recipe error:', error);
    res.status(500).json({ success: false, message: 'Error removing recipe.' });
  }
});

// POST /api/recipes/find — find recipes by ingredients (primary endpoint)
router.post('/find', async (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an ingredients array.'
      });
    }

    const ingredientsStr = ingredients.join(',');

    // Call Spoonacular findByIngredients API
    const response = await axios.get(`${SPOONACULAR_BASE}/recipes/findByIngredients`, {
      params: {
        apiKey: process.env.SPOONACULAR_API_KEY,
        ingredients: ingredientsStr,
        number: 12,
        ranking: 1,
        ignorePantry: true
      }
    });

    const recipes = (response.data || []).map(recipe => {
      const total = recipe.usedIngredientCount + recipe.missedIngredientCount;
      return {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        usedIngredientCount: recipe.usedIngredientCount,
        missedIngredientCount: recipe.missedIngredientCount,
        matchPercentage: total > 0 ? Math.round((recipe.usedIngredientCount / total) * 100) : 0,
        usedIngredients: (recipe.usedIngredients || []).map(i => ({
          id: i.id,
          name: i.name,
          original: i.original,
          image: i.image
        })),
        missedIngredients: (recipe.missedIngredients || []).map(i => ({
          id: i.id,
          name: i.name,
          original: i.original,
          image: i.image
        }))
      };
    });

    res.json({
      success: true,
      recipes,
      total: recipes.length
    });
  } catch (error) {
    console.error('Recipe find error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Error finding recipes. Please try again.'
    });
  }
});

// GET /api/recipes/search?ingredients=...&cuisine=...&diet=...&number=...
router.get('/search', async (req, res) => {
  try {
    const { ingredients, cuisine, diet, number = 12 } = req.query;

    if (!ingredients) {
      return res.status(400).json({
        success: false,
        message: 'Please provide ingredients to search.'
      });
    }

    // Use complexSearch for better filtering support
    const params = {
      apiKey: process.env.SPOONACULAR_API_KEY,
      includeIngredients: ingredients,
      number: Math.min(parseInt(number), 50),
      addRecipeInformation: true,
      addRecipeNutrition: true,
      fillIngredients: true,
      sort: 'max-used-ingredients',
      ignorePantry: true
    };

    if (cuisine) params.cuisine = cuisine;
    if (diet) params.diet = diet;

    const response = await axios.get(`${SPOONACULAR_BASE}/recipes/complexSearch`, { params });

    // Also get findByIngredients for match percentage
    const ingredientResponse = await axios.get(`${SPOONACULAR_BASE}/recipes/findByIngredients`, {
      params: {
        apiKey: process.env.SPOONACULAR_API_KEY,
        ingredients,
        number: Math.min(parseInt(number), 50),
        ranking: 1,
        ignorePantry: true
      }
    });

    // Create a map of recipe match info
    const matchMap = {};
    ingredientResponse.data.forEach(recipe => {
      const total = recipe.usedIngredientCount + recipe.missedIngredientCount;
      matchMap[recipe.id] = {
        matchPercentage: total > 0 ? Math.round((recipe.usedIngredientCount / total) * 100) : 0,
        usedIngredients: recipe.usedIngredients || [],
        missedIngredients: recipe.missedIngredients || [],
        usedIngredientCount: recipe.usedIngredientCount,
        missedIngredientCount: recipe.missedIngredientCount
      };
    });

    // Enrich search results with match data
    const recipes = (response.data.results || []).map(recipe => {
      const matchInfo = matchMap[recipe.id] || {};
      return {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        readyInMinutes: recipe.readyInMinutes,
        servings: recipe.servings,
        vegetarian: recipe.vegetarian,
        vegan: recipe.vegan,
        glutenFree: recipe.glutenFree,
        dairyFree: recipe.dairyFree,
        healthScore: recipe.healthScore,
        matchPercentage: matchInfo.matchPercentage || 0,
        usedIngredientCount: matchInfo.usedIngredientCount || 0,
        missedIngredientCount: matchInfo.missedIngredientCount || 0,
        missedIngredients: matchInfo.missedIngredients || [],
        difficulty: recipe.readyInMinutes <= 20 ? 'Easy' : recipe.readyInMinutes <= 45 ? 'Medium' : 'Hard'
      };
    });

    // If complexSearch returned fewer results, supplement with findByIngredients
    if (recipes.length === 0 && ingredientResponse.data.length > 0) {
      const fallbackRecipes = ingredientResponse.data.map(recipe => {
        const total = recipe.usedIngredientCount + recipe.missedIngredientCount;
        return {
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          matchPercentage: total > 0 ? Math.round((recipe.usedIngredientCount / total) * 100) : 0,
          usedIngredientCount: recipe.usedIngredientCount,
          missedIngredientCount: recipe.missedIngredientCount,
          missedIngredients: recipe.missedIngredients || [],
          difficulty: 'Medium'
        };
      });
      return res.json({ success: true, recipes: fallbackRecipes, total: fallbackRecipes.length });
    }

    res.json({
      success: true,
      recipes,
      total: response.data.totalResults || recipes.length
    });
  } catch (error) {
    console.error('Recipe search error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Error searching recipes. Please try again.'
    });
  }
});

// GET /api/recipes/:id — get recipe details (MUST be last due to catch-all :id)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIngredients } = req.query;

    // Fetch recipe info with nutrition
    const [infoResponse, nutritionResponse] = await Promise.allSettled([
      axios.get(`${SPOONACULAR_BASE}/recipes/${id}/information`, {
        params: {
          apiKey: process.env.SPOONACULAR_API_KEY,
          includeNutrition: true
        }
      }),
      axios.get(`${SPOONACULAR_BASE}/recipes/${id}/nutritionWidget.json`, {
        params: {
          apiKey: process.env.SPOONACULAR_API_KEY
        }
      })
    ]);

    if (infoResponse.status === 'rejected') {
      throw infoResponse.reason;
    }

    const recipe = infoResponse.value.data;

    // Parse user ingredients for matching
    const userIngList = userIngredients
      ? userIngredients.toLowerCase().split(',').map(i => i.trim())
      : [];

    // Categorize ingredients as have/missing
    const ingredients = (recipe.extendedIngredients || []).map(ing => {
      const ingName = ing.name.toLowerCase();
      const have = userIngList.some(ui =>
        ingName.includes(ui) || ui.includes(ingName)
      );
      return {
        id: ing.id,
        name: ing.name,
        original: ing.original,
        amount: ing.amount,
        unit: ing.unit,
        aisle: ing.aisle || 'Other',
        have
      };
    });

    // Extract nutrition from recipe info or dedicated nutrition endpoint
    const nutrients = recipe.nutrition?.nutrients || [];
    let nutrition = {
      calories: nutrients.find(n => n.name === 'Calories'),
      protein: nutrients.find(n => n.name === 'Protein'),
      fat: nutrients.find(n => n.name === 'Fat'),
      carbs: nutrients.find(n => n.name === 'Carbohydrates'),
      fiber: nutrients.find(n => n.name === 'Fiber'),
      sugar: nutrients.find(n => n.name === 'Sugar')
    };

    // If nutrition widget endpoint succeeded, enhance with that data
    if (nutritionResponse.status === 'fulfilled') {
      const nwData = nutritionResponse.value.data;
      if (nwData) {
        if (!nutrition.calories && nwData.calories) {
          nutrition.calories = { amount: parseFloat(nwData.calories), unit: 'kcal', name: 'Calories' };
        }
        if (!nutrition.protein && nwData.protein) {
          nutrition.protein = { amount: parseFloat(nwData.protein), unit: 'g', name: 'Protein' };
        }
        if (!nutrition.fat && nwData.fat) {
          nutrition.fat = { amount: parseFloat(nwData.fat), unit: 'g', name: 'Fat' };
        }
        if (!nutrition.carbs && nwData.carbs) {
          nutrition.carbs = { amount: parseFloat(nwData.carbs), unit: 'g', name: 'Carbohydrates' };
        }
      }
    }

    // Parse steps
    const steps = (recipe.analyzedInstructions?.[0]?.steps || []).map(step => ({
      number: step.number,
      step: step.step,
      ingredients: step.ingredients?.map(i => i.name) || [],
      equipment: step.equipment?.map(e => e.name) || []
    }));

    res.json({
      success: true,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        readyInMinutes: recipe.readyInMinutes,
        servings: recipe.servings,
        vegetarian: recipe.vegetarian,
        vegan: recipe.vegan,
        glutenFree: recipe.glutenFree,
        dairyFree: recipe.dairyFree,
        healthScore: recipe.healthScore,
        summary: recipe.summary,
        sourceUrl: recipe.sourceUrl,
        ingredients,
        steps,
        nutrition,
        difficulty: recipe.readyInMinutes <= 20 ? 'Easy' : recipe.readyInMinutes <= 45 ? 'Medium' : 'Hard'
      }
    });
  } catch (error) {
    console.error('Recipe detail error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching recipe details.'
    });
  }
});

module.exports = router;
