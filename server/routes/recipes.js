const express = require('express');
const axios = require('axios');
const { auth, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const SPOONACULAR_BASE = 'https://api.spoonacular.com';

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

// GET /api/recipes/:id?userIngredients=...
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIngredients } = req.query;

    const response = await axios.get(`${SPOONACULAR_BASE}/recipes/${id}/information`, {
      params: {
        apiKey: process.env.SPOONACULAR_API_KEY,
        includeNutrition: true
      }
    });

    const recipe = response.data;

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

    // Extract nutrition
    const nutrients = recipe.nutrition?.nutrients || [];
    const nutrition = {
      calories: nutrients.find(n => n.name === 'Calories'),
      protein: nutrients.find(n => n.name === 'Protein'),
      fat: nutrients.find(n => n.name === 'Fat'),
      carbs: nutrients.find(n => n.name === 'Carbohydrates'),
      fiber: nutrients.find(n => n.name === 'Fiber'),
      sugar: nutrients.find(n => n.name === 'Sugar')
    };

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

// POST /api/recipes/save
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

// DELETE /api/recipes/unsave/:spoonacularId
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

// GET /api/recipes/saved/all
router.get('/saved/all', auth, async (req, res) => {
  try {
    res.json({ success: true, savedRecipes: req.user.savedRecipes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching saved recipes.' });
  }
});

module.exports = router;
