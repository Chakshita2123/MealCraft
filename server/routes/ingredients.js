const express = require('express');
const Groq = require('groq-sdk');

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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${image}`
              }
            },
            {
              type: 'text',
              text: `Analyze this image of a fridge or food items. Identify all visible food ingredients and produce.

Return ONLY a JSON array of ingredient names as simple strings. Use common, simple names suitable for recipe search.

Examples of good names: "eggs", "milk", "tomatoes", "chicken breast", "cheddar cheese", "spinach", "garlic", "onion"

Do NOT include:
- Condiment bottles unless clearly identifiable
- Non-food items
- Brand names
- Prepared meals

Return ONLY the JSON array, no other text. Example: ["eggs", "milk", "tomatoes", "bell pepper"]`
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const text = response.choices[0].message.content;

    // Parse the JSON array from the response
    let ingredients = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ingredients = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
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