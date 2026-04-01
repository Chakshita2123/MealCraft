const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// POST /api/ingredients/detect
router.post('/detect', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an image.' 
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze this image of a fridge or food items. Identify all visible food ingredients and produce.

Return ONLY a JSON array of ingredient names as simple strings. Use common, simple names suitable for recipe search.

Examples of good names: "eggs", "milk", "tomatoes", "chicken breast", "cheddar cheese", "spinach", "garlic", "onion"

Do NOT include:
- Condiment bottles unless clearly identifiable
- Non-food items
- Brand names
- Prepared meals

Return ONLY the JSON array, no other text. Example: ["eggs", "milk", "tomatoes", "bell pepper"]`;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON array from the response
    let ingredients = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ingredients = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract ingredients from text
      ingredients = text
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0);
    }

    // Clean and validate
    ingredients = ingredients
      .filter(i => typeof i === 'string' && i.length > 0 && i.length < 50)
      .map(i => i.toLowerCase().trim());

    res.json({
      success: true,
      ingredients,
      count: ingredients.length
    });
  } catch (error) {
    console.error('Ingredient detection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error detecting ingredients. Please try again or enter ingredients manually.' 
    });
  }
});

module.exports = router;
