import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { nutritionAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Search, Target, Flame, Beef, Wheat, Droplets, Check, Activity } from 'lucide-react';
import './NutritionTracker.css';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', color: '#E8956D' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️', color: '#C4622D' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙', color: '#8B4513' },
  { key: 'snack', label: 'Snack', emoji: '🍎', color: '#5C7A3E' },
];

const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 250, fat: 65 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } }
};

export default function NutritionTracker() {
  const { user } = useAuth();
  const [todayLog, setTodayLog] = useState({ meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } });
  const [weeklyData, setWeeklyData] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [servings, setServings] = useState(1);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [tempGoals, setTempGoals] = useState({ ...DEFAULT_GOALS });
  const [toastMsg, setToastMsg] = useState('');

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      // Load goals from localStorage
      const saved = localStorage.getItem('nc_goals');
      if (saved) {
        const parsedGoals = JSON.parse(saved);
        setGoals(parsedGoals);
        setTempGoals(parsedGoals);
      }

      setLoading(true);
      try {
        const results = await Promise.allSettled([
          nutritionAPI.getToday(),
          nutritionAPI.getWeekly()
        ]);

        if (results[0].status === 'fulfilled') {
          setTodayLog(results[0].value.data.log);
        }
        if (results[1].status === 'fulfilled') {
          setWeeklyData(results[1].value.data.weekly);
        }
      } catch (err) {
        console.error('Load data error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Search recipes with debounce
  useEffect(() => {
    const searchRecipes = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const res = await nutritionAPI.search(searchQuery);
        setSearchResults(res.data.recipes || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchRecipes, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogMeal = async () => {
    if (!selectedRecipe) return;

    try {
      const data = {
        mealType: selectedMealType,
        recipeId: selectedRecipe.id,
        recipeName: selectedRecipe.title,
        image: selectedRecipe.image,
        nutrition: selectedRecipe.nutrition,
        servings
      };

      await nutritionAPI.log(data);

      // Refresh today's log
      const todayRes = await nutritionAPI.getToday();
      setTodayLog(todayRes.data.log);

      // Update weekly data
      const weeklyRes = await nutritionAPI.getWeekly();
      setWeeklyData(weeklyRes.data.weekly);

      // Reset modal
      setAddModalOpen(false);
      setSelectedRecipe(null);
      setSearchQuery('');
      setServings(1);
      showToast('Meal logged! 🎉');
    } catch (err) {
      console.error('Log meal error:', err);
      showToast('Error logging meal');
    }
  };

  const handleRemoveMeal = async (mealId) => {
    try {
      await nutritionAPI.remove(mealId);

      const todayRes = await nutritionAPI.getToday();
      setTodayLog(todayRes.data.log);

      const weeklyRes = await nutritionAPI.getWeekly();
      setWeeklyData(weeklyRes.data.weekly);
    } catch (err) {
      console.error('Remove meal error:', err);
    }
  };

  const handleSaveGoals = () => {
    setGoals(tempGoals);
    localStorage.setItem('nc_goals', JSON.stringify(tempGoals));
    setGoalsModalOpen(false);
    showToast('Goals updated!');
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  if (loading) {
    return (
      <div className="nutrition-page">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading nutrition tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nutrition-page">
      {/* Header */}
      <motion.div
        className="nutrition-header"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <div>
          <h1>
            <Activity size={28} />
            Nutrition Tracker
          </h1>
          <p>Track your daily nutrition and hit your goals</p>
        </div>
        <div className="header-actions">
          <motion.button
            className="btn-outline goals-btn"
            onClick={() => {
              setTempGoals({ ...goals });
              setGoalsModalOpen(true);
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Target size={16} /> Set Goals
          </motion.button>
          <motion.button
            className="btn-primary add-meal-btn"
            onClick={() => setAddModalOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Plus size={18} /> Log Meal
          </motion.button>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="nutrition-toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Check size={16} /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals Grid */}
      <motion.div
        className="goals-grid"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {[
          { key: 'calories', label: 'Calories', icon: <Flame size={22} />, unit: 'kcal', color: '#C4622D' },
          { key: 'protein', label: 'Protein', icon: <Beef size={22} />, unit: 'g', color: '#E8956D' },
          { key: 'carbs', label: 'Carbs', icon: <Wheat size={22} />, unit: 'g', color: '#5C7A3E' },
          { key: 'fat', label: 'Fat', icon: <Droplets size={22} />, unit: 'g', color: '#8B4513' }
        ].map(({ key, label, icon, unit, color }, idx) => {
          const current = todayLog.totals?.[key] || 0;
          const goal = goals[key];
          const pct = Math.min((current / goal) * 100, 100);
          const over = current > goal;

          return (
            <motion.div
              key={key}
              className="goal-card"
              style={{ '--goal-color': color }}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              custom={idx * 0.1}
            >
              <div className="goal-card-top">
                <div className="goal-icon">{icon}</div>
                <div className="goal-values">
                  <span className="goal-current" style={{ color: over ? '#e53e3e' : color }}>
                    {Math.round(current)}{unit}
                  </span>
                  <span className="goal-target">/ {goal}{unit}</span>
                </div>
              </div>
              <div className="goal-label">{label}</div>
              <div className="goal-progress-bar">
                <motion.div
                  className="goal-progress-fill"
                  style={{ background: over ? '#e53e3e' : color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
              <div className="goal-pct">{Math.round(pct)}% of daily goal</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Today's Meals */}
      <motion.div
        className="todays-meals"
        initial="hidden"
        animate="show"
        variants={fadeUp}
        custom={0.4}
      >
        <h2>Today's Meals</h2>
        {MEAL_TYPES.map(mt => {
          const meals = todayLog.meals?.filter(m => m.mealType === mt.key) || [];
          const mealsCal = meals.reduce((s, m) => s + (m.nutrition.calories || 0) * (m.servings || 1), 0);

          return (
            <div key={mt.key} className="meal-group">
              <div className="meal-group-header">
                <span className="meal-group-emoji">{mt.emoji}</span>
                <span className="meal-group-label">{mt.label}</span>
                <span className="meal-group-cal">{Math.round(mealsCal)} kcal</span>
                <button
                  className="meal-group-add"
                  onClick={() => {
                    setSelectedMealType(mt.key);
                    setAddModalOpen(true);
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <AnimatePresence>
                {meals.map(meal => (
                  <motion.div
                    key={meal._id}
                    className="meal-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {meal.image && <img src={meal.image} className="meal-item-img" alt={meal.recipeName} />}
                    <div className="meal-item-info">
                      <span className="meal-item-name">{meal.recipeName}</span>
                      <span className="meal-item-macros">
                        {Math.round((meal.nutrition.calories || 0) * (meal.servings || 1))} kcal · P:{' '}
                        {Math.round((meal.nutrition.protein || 0) * (meal.servings || 1))}g · C:{' '}
                        {Math.round((meal.nutrition.carbs || 0) * (meal.servings || 1))}g · F:{' '}
                        {Math.round((meal.nutrition.fat || 0) * (meal.servings || 1))}g
                      </span>
                      {meal.servings > 1 && (
                        <span className="meal-item-servings">{meal.servings} servings</span>
                      )}
                    </div>
                    <button
                      className="meal-item-remove"
                      onClick={() => handleRemoveMeal(meal._id)}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {meals.length === 0 && (
                <div className="meal-group-empty">Nothing logged yet</div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Weekly Chart */}
      <motion.div
        className="weekly-chart-card"
        initial="hidden"
        animate="show"
        variants={fadeUp}
        custom={0.5}
      >
        <h2>Weekly Calories</h2>
        <p>Your calorie intake over the last 7 days</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData} barSize={32}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B7355', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis hide={true} />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid rgba(196,98,45,0.15)',
                borderRadius: '12px',
                fontSize: '0.85rem'
              }}
              formatter={(val) => [`${val} kcal`, 'Calories']}
            />
            <Bar dataKey="calories" radius={[8, 8, 0, 0]}>
              {weeklyData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.calories >= goals.calories ? '#C4622D' : 'rgba(196,98,45,0.25)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span className="legend-dot" style={{ background: '#C4622D' }} /> Goal reached
          <span className="legend-dot" style={{ background: 'rgba(196,98,45,0.25)' }} /> Under goal
        </div>
      </motion.div>

      {/* Add Meal Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddModalOpen(false)}
            />
            <motion.div
              className="add-meal-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Log a Meal</h3>
                <button className="modal-close" onClick={() => setAddModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              {/* Meal type tabs */}
              <div className="meal-type-tabs">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.key}
                    className={`meal-type-tab ${selectedMealType === mt.key ? 'active' : ''}`}
                    onClick={() => setSelectedMealType(mt.key)}
                  >
                    {mt.emoji} {mt.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="modal-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search recipes e.g. 'oatmeal', 'chicken salad'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searching && <div className="btn-spinner dark" style={{ width: 16, height: 16 }} />}
              </div>

              {/* Results */}
              <div className="modal-results">
                {searchResults.map(recipe => (
                  <motion.div
                    key={recipe.id}
                    className={`search-result-item ${selectedRecipe?.id === recipe.id ? 'selected' : ''}`}
                    onClick={() => setSelectedRecipe(recipe)}
                    whileHover={{ backgroundColor: 'rgba(196,98,45,0.05)' }}
                  >
                    {recipe.image && <img src={recipe.image} className="result-thumb" alt={recipe.title} />}
                    <div className="result-info">
                      <span className="result-name">{recipe.title}</span>
                      <span className="result-macros">
                        {recipe.nutrition.calories} kcal · P {recipe.nutrition.protein}g · C{' '}
                        {recipe.nutrition.carbs}g · F {recipe.nutrition.fat}g
                      </span>
                    </div>
                    {selectedRecipe?.id === recipe.id && (
                      <Check size={18} style={{ color: '#C4622D', flexShrink: 0 }} />
                    )}
                  </motion.div>
                ))}
                {searchQuery.length < 2 && (
                  <div className="modal-hint">🔍 Search for any food or recipe to log its nutrition</div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <div className="modal-hint">No results found. Try a different search.</div>
                )}
              </div>

              {/* Footer */}
              <AnimatePresence>
                {selectedRecipe && (
                  <motion.div
                    className="modal-footer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="selected-recipe-preview">
                      <img src={selectedRecipe.image} className="selected-thumb" alt={selectedRecipe.title} />
                      <div>
                        <div className="selected-name">{selectedRecipe.title}</div>
                        <div className="selected-macros">
                          {Math.round(selectedRecipe.nutrition.calories * servings)} kcal for {servings} serving
                          {servings > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="servings-row">
                      <span className="servings-label">Servings:</span>
                      <div className="servings-control">
                        <button onClick={() => setServings(Math.max(0.5, servings - 0.5))}>−</button>
                        <span>{servings}</span>
                        <button onClick={() => setServings(servings + 0.5)}>+</button>
                      </div>
                    </div>
                    <motion.button
                      className="btn-primary log-btn"
                      onClick={handleLogMeal}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus size={16} /> Log {MEAL_TYPES.find(m => m.key === selectedMealType)?.emoji}{' '}
                      {MEAL_TYPES.find(m => m.key === selectedMealType)?.label}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Set Goals Modal */}
      <AnimatePresence>
        {goalsModalOpen && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGoalsModalOpen(false)}
            />
            <motion.div
              className="goals-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <Target size={20} /> Daily Goals
                </h3>
                <button className="modal-close" onClick={() => setGoalsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="goals-form">
                {[
                  { key: 'calories', label: 'Calories', unit: 'kcal', min: 500, max: 5000, step: 50 },
                  { key: 'protein', label: 'Protein', unit: 'g', min: 20, max: 500, step: 5 },
                  { key: 'carbs', label: 'Carbs', unit: 'g', min: 20, max: 700, step: 5 },
                  { key: 'fat', label: 'Fat', unit: 'g', min: 10, max: 300, step: 5 }
                ].map(({ key, label, unit, min, max, step }) => (
                  <div key={key} className="goal-input-row">
                    <label>
                      {label} ({unit})
                    </label>
                    <div className="goal-input-control">
                      <button onClick={() => setTempGoals(g => ({ ...g, [key]: Math.max(min, g[key] - step) }))}>
                        −
                      </button>
                      <input
                        type="number"
                        value={tempGoals[key]}
                        onChange={(e) => setTempGoals(g => ({ ...g, [key]: Number(e.target.value) }))}
                        min={min}
                        max={max}
                      />
                      <button onClick={() => setTempGoals(g => ({ ...g, [key]: Math.min(max, g[key] + step) }))}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="goals-modal-footer">
                <button className="btn-outline" onClick={() => setTempGoals({ ...DEFAULT_GOALS })}>
                  Reset to Default
                </button>
                <motion.button
                  className="btn-primary"
                  onClick={handleSaveGoals}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Check size={16} /> Save Goals
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
