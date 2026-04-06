import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { mealplanAPI, recipesAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Sparkles, X, Search, Plus, Trash2 } from 'lucide-react';
import './MealPlanner.css';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_SLOTS = [
  { key: 'breakfast', emoji: '🌅', label: 'Breakfast' },
  { key: 'lunch', emoji: '☀️', label: 'Lunch' },
  { key: 'dinner', emoji: '🌙', label: 'Dinner' }
];

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

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

export default function MealPlanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mealPlan, setMealPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);

  // Load meal plan on mount
  useEffect(() => {
    loadMealPlan();
    loadSavedRecipes();
  }, [user]);

  const loadMealPlan = async () => {
    setLoading(true);
    try {
      const res = await mealplanAPI.get();
      setMealPlan(res.data.mealPlan || []);
    } catch (err) {
      console.error('Load meal plan error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedRecipes = async () => {
    try {
      const res = await recipesAPI.getSaved();
      setSavedRecipes(res.data.savedRecipes || []);
    } catch (err) {
      console.error('Load saved recipes error:', err);
    }
  };

  // Search recipes from MealDB + saved recipes
  useEffect(() => {
    const searchRecipes = async () => {
      if (!searchQuery.trim()) {
        // Show saved recipes first when query is empty
        setSearchResults(savedRecipes.slice(0, 10));
        return;
      }

      setPickerLoading(true);
      try {
        const mealdbRes = await fetch(`${MEALDB_BASE}/search.php?s=${searchQuery}`);
        const mealdbData = await mealdbRes.json();
        const mealdbRecipes = (mealdbData.meals || []).map(meal => ({
          id: meal.idMeal,
          title: meal.strMeal,
          image: meal.strMealThumb,
          ingredients: extractIngredientsFromMeal(meal),
          isMealDB: true
        }));

        // Combine with saved recipes
        const combined = [
          ...savedRecipes.filter(s =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(s => ({ ...s, isSaved: true })),
          ...mealdbRecipes.filter(m =>
            !savedRecipes.some(s => s.id === m.id)
          )
        ];

        setSearchResults(combined.slice(0, 15));
      } catch (err) {
        console.error('Search recipes error:', err);
        setSearchResults([]);
      } finally {
        setPickerLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchRecipes, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, savedRecipes]);

  const handleSlotClick = (day, slot) => {
    setSelectedSlot({ day, slot });
    setSearchQuery('');
    setSearchResults(savedRecipes.slice(0, 10));
    setModalOpen(true);
  };

  const handleRecipeSelect = async (recipe) => {
    if (!selectedSlot) return;

    // Optimistic update
    const newMealPlan = JSON.parse(JSON.stringify(mealPlan));
    newMealPlan[selectedSlot.day][selectedSlot.slot] = {
      recipeId: recipe.id,
      title: recipe.title,
      image: recipe.image,
      ingredients: recipe.ingredients || [],
      matchPercentage: recipe.matchPercentage || 0
    };
    setMealPlan(newMealPlan);

    // Close modal
    setModalOpen(false);

    // Sync with API
    try {
      await mealplanAPI.add(selectedSlot.day, selectedSlot.slot, {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        ingredients: recipe.ingredients || [],
        matchPercentage: recipe.matchPercentage || 0
      });
    } catch (err) {
      console.error('Add to meal plan error:', err);
      // Revert on error
      loadMealPlan();
    }
  };

  const handleRemoveSlot = async (day, slot) => {
    // Optimistic update
    const newMealPlan = JSON.parse(JSON.stringify(mealPlan));
    newMealPlan[day][slot] = {};
    setMealPlan(newMealPlan);

    // Sync with API
    try {
      await mealplanAPI.remove(day, slot);
    } catch (err) {
      console.error('Remove from meal plan error:', err);
      loadMealPlan();
    }
  };

  const handleGenerateShopping = async () => {
    setGenerating(true);
    try {
      const res = await mealplanAPI.generateShopping();
      alert(`✅ ${res.data.added} ingredients added to your shopping list!`);
    } catch (err) {
      console.error('Generate shopping error:', err);
      alert('Error generating shopping list');
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  if (loading) {
    return (
      <div className="planner-page">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading meal planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="planner-page page-enter">
      {/* Header */}
      <div className="planner-header">
        <div className="header-content">
          <h1>
            <Sparkles size={28} className="header-icon" />
            Weekly Meal Planner
          </h1>
          <p>Plan your week, waste nothing</p>
        </div>
        <button
          className="btn-primary generate-btn"
          onClick={handleGenerateShopping}
          disabled={generating}
        >
          <ShoppingCart size={18} />
          {generating ? 'Generating...' : 'Generate Shopping List'}
        </button>
      </div>

      {/* Grid */}
      <div className="planner-grid">
        {DAYS_OF_WEEK.map((day, dayIndex) => (
          <motion.div
            key={day}
            className={`day-column ${day === today ? 'today' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIndex * 0.05 }}
          >
            <div className="day-label">{day}</div>

            {MEAL_SLOTS.map((meal) => {
              const slot = mealPlan[dayIndex]?.[meal.key];
              const isFilled = slot && slot.recipeId;

              return (
                <motion.div
                  key={`${day}-${meal.key}`}
                  className={`meal-slot ${isFilled ? 'filled' : 'empty'}`}
                  onClick={() => !isFilled && handleSlotClick(dayIndex, meal.key)}
                  whileHover={!isFilled ? { scale: 1.02 } : {}}
                  whileTap={!isFilled ? { scale: 0.98 } : {}}
                >
                  {isFilled ? (
                    <>
                      <img src={slot.image} alt={slot.title} className="slot-image" />
                      <div className="slot-content">
                        <p className="slot-title">{slot.title}</p>
                      </div>
                      <button
                        className="slot-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSlot(dayIndex, meal.key);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="slot-label">{meal.emoji} {meal.label}</p>
                      <button className="slot-add-btn">
                        <Plus size={20} />
                        Add
                      </button>
                    </>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        ))}
      </div>

      {/* Recipe Picker Modal */}
      {modalOpen && (
        <motion.div
          className="picker-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setModalOpen(false)}
        >
          <motion.div
            className="recipe-picker-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="picker-header">
              <h2>
                {selectedSlot && MEAL_SLOTS[
                  MEAL_SLOTS.findIndex(m => m.key === selectedSlot.slot)
                ]?.emoji} Pick Recipe
              </h2>
              <button
                className="picker-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="picker-search">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="picker-search-input"
              />
            </div>

            <div className="picker-results">
              {pickerLoading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Searching...
                </p>
              ) : searchResults.length > 0 ? (
                searchResults.map((recipe) => (
                  <motion.div
                    key={`${recipe.id}-${recipe.isSaved ? 'saved' : 'mealdb'}`}
                    className="picker-recipe-item"
                    onClick={() => handleRecipeSelect(recipe)}
                    whileHover={{ x: 4 }}
                  >
                    {recipe.image && (
                      <img src={recipe.image} alt={recipe.title} className="picker-recipe-image" />
                    )}
                    <div className="picker-recipe-info">
                      <p className="picker-recipe-title">{recipe.title}</p>
                      {recipe.isSaved && (
                        <span className="badge-saved">Saved</span>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {searchQuery ? 'No recipes found' : 'Search or pick from saved recipes'}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
