const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

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

// GET /api/shopping
router.get('/', auth, async (req, res) => {
  try {
    const user = req.user;
    res.json({ success: true, shoppingList: user.shoppingList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching shopping list.' });
  }
});

// POST /api/shopping/add
router.post('/add', auth, async (req, res) => {
  try {
    const { items } = req.body; // Array of { name, aisle, recipeId, recipeTitle }
    const user = req.user;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide items to add.' });
    }

    items.forEach(item => {
      // Check for duplicates
      const exists = user.shoppingList.some(
        existing => existing.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!exists) {
        user.shoppingList.push({
          name: item.name,
          category: categorizeIngredient(item.aisle),
          purchased: false,
          recipeId: item.recipeId,
          recipeTitle: item.recipeTitle
        });
      }
    });

    await user.save();
    res.json({ success: true, shoppingList: user.shoppingList });
  } catch (error) {
    console.error('Add shopping error:', error);
    res.status(500).json({ success: false, message: 'Error adding items.' });
  }
});

// PUT /api/shopping/toggle/:itemId
router.put('/toggle/:itemId', auth, async (req, res) => {
  try {
    const user = req.user;
    const item = user.shoppingList.id(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    item.purchased = !item.purchased;
    await user.save();
    
    res.json({ success: true, shoppingList: user.shoppingList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling item.' });
  }
});

// DELETE /api/shopping/remove/:itemId
router.delete('/remove/:itemId', auth, async (req, res) => {
  try {
    const user = req.user;
    user.shoppingList = user.shoppingList.filter(
      item => item._id.toString() !== req.params.itemId
    );
    await user.save();
    
    res.json({ success: true, shoppingList: user.shoppingList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing item.' });
  }
});

// DELETE /api/shopping/clear-purchased
router.delete('/clear-purchased', auth, async (req, res) => {
  try {
    const user = req.user;
    user.shoppingList = user.shoppingList.filter(item => !item.purchased);
    await user.save();
    
    res.json({ success: true, shoppingList: user.shoppingList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing items.' });
  }
});

module.exports = router;
