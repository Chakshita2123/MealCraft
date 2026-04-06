import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { recipesAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import RecipeCard from '../components/RecipeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import IngredientChip from '../components/IngredientChip';
import { Search, SlidersHorizontal, ChefHat, AlertCircle, ArrowLeft, Leaf } from 'lucide-react';
import './SearchResults.css';

const SORT_OPTIONS = [
  { value: 'match', label: 'Match %' },
  { value: 'time', label: 'Cook Time' },
  { value: 'health', label: 'Health Score' },
];

const CUISINES = ['All', 'Indian', 'Italian', 'Chinese', 'Mexican', 'Thai', 'Mediterranean', 'American', 'Japanese'];

const QUICK_SUGGESTIONS = ['Butter Chicken', 'Biryani', 'Pasta', 'Pizza', 'Dal Makhani', 'Fried Rice'];

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState('match');
  const [error, setError] = useState('');

  // Determine search mode from URL or default to 'ingredients'
  const modeParam = searchParams.get('mode') || 'ingredients';
  const [searchMode, setSearchMode] = useState(modeParam === 'name' ? 'name' : 'ingredients');

  // ---- Ingredient Search State ----
  const ingredientsParam = searchParams.get('ingredients') || '';
  const cuisineParam = searchParams.get('cuisine') || '';
  const vegetarianParam = searchParams.get('vegetarian') || '';
  const ingredientList = ingredientsParam
    ? ingredientsParam.split(',').map(i => i.trim())
    : [];

  // ---- Name Search State ----
  const [nameQuery, setNameQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [isVegetarian, setIsVegetarian] = useState(false);

  // Load saved recipe IDs
  useEffect(() => {
    if (user) {
      recipesAPI.getSaved().then(res => {
        const ids = new Set((res.data.savedRecipes || []).map(r => r.id));
        setSavedIds(ids);
      }).catch(() => { });
    }
  }, [user]);

  // Search on mount / param change for ingredient mode
  useEffect(() => {
    if (searchMode === 'ingredients' && ingredientList.length > 0) {
      searchRecipes();
    }
  }, [ingredientsParam, cuisineParam, vegetarianParam, searchMode]);

  const searchRecipes = async () => {
    if (ingredientList.length === 0) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const res = await recipesAPI.search({
        ingredients: ingredientsParam,
        cuisine: cuisineParam,
        vegetarian: vegetarianParam,
        number: 24,
      });

      let results = res.data.recipes || [];

      // ← Fix: if no vegetarian filter, mix veg + non-veg
      // Ensure at least 30% veg recipes in default results
      if (!vegetarianParam || vegetarianParam !== 'true') {
        const vegRecipes = results.filter(r => r.vegetarian);
        const nonVegRecipes = results.filter(r => !r.vegetarian);

        // If all non-veg, try to add some veg ones from existing
        if (vegRecipes.length === 0 && nonVegRecipes.length > 0) {
          // Take 70% non-veg, 30% slots for veg (from what we have)
          // Since MealDB doesn't always return veg, we just shuffle to mix
          results = results.sort(() => Math.random() - 0.5);
        } else {
          // Interleave veg and non-veg for a good mix
          const mixed = [];
          const maxLen = Math.max(vegRecipes.length, nonVegRecipes.length);
          for (let i = 0; i < maxLen; i++) {
            if (nonVegRecipes[i]) mixed.push(nonVegRecipes[i]);
            if (nonVegRecipes[i + 1]) mixed.push(nonVegRecipes[i + 1]);
            if (vegRecipes[i]) mixed.push(vegRecipes[i]);
          }
          results = mixed;
        }
      }

      setRecipes(results);
    } catch (err) {
      console.error('Search error:', err);
      setError(
        err.response?.data?.message || 'Failed to search recipes. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const searchByName = async () => {
    if (!nameQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const res = await recipesAPI.searchByName({
        query: nameQuery,
        cuisine: selectedCuisine !== 'All' ? selectedCuisine : '',
        vegetarian: isVegetarian ? 'true' : '',
        number: 24,
      });

      setRecipes(res.data.recipes || []);
    } catch (err) {
      console.error('Search by name error:', err);
      setError(
        err.response?.data?.message || 'Failed to search recipes. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSuggestion = (suggestion) => {
    setNameQuery(suggestion);
    // Trigger search immediately
    setTimeout(() => {
      setLoading(true);
      setSearched(true);
      setError('');
      recipesAPI.searchByName({
        query: suggestion,
        cuisine: selectedCuisine !== 'All' ? selectedCuisine : '',
        vegetarian: isVegetarian ? 'true' : '',
        number: 24,
      })
        .then(res => {
          setRecipes(res.data.recipes || []);
        })
        .catch(err => {
          console.error('Search by name error:', err);
          setError(err.response?.data?.message || 'Failed to search recipes.');
        })
        .finally(() => setLoading(false));
    }, 0);
  };

  const handleSave = async (recipe) => {
    if (!user) return;
    try {
      await recipesAPI.save({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        readyInMinutes: recipe.readyInMinutes,
        servings: recipe.servings,
        vegetarian: recipe.vegetarian,
        matchPercentage: recipe.matchPercentage,
      });
      setSavedIds(prev => new Set([...prev, recipe.id]));
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleUnsave = async (id) => {
    try {
      await recipesAPI.unsave(id);
      setSavedIds(prev => { const c = new Set(prev); c.delete(id); return c; });
    } catch (err) {
      console.error('Unsave error:', err);
    }
  };

  // Sort recipes
  const sortedRecipes = [...recipes].sort((a, b) => {
    if (sortBy === 'match') return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    if (sortBy === 'time') return (a.readyInMinutes || 999) - (b.readyInMinutes || 999);
    if (sortBy === 'health') return (b.healthScore || 0) - (a.healthScore || 0);
    return 0;
  });

  const isIngredientMode = searchMode === 'ingredients';

  return (
    <div className="search-page page-enter" id="search-page">
      {/* Search Mode Toggle */}
      <div className="search-mode-toggle glass-card">
        <button
          className={`mode-tab ${isIngredientMode ? 'active' : ''}`}
          onClick={() => setSearchMode('ingredients')}
        >
          🔍 By Ingredients
        </button>
        <button
          className={`mode-tab ${!isIngredientMode ? 'active' : ''}`}
          onClick={() => setSearchMode('name')}
        >
          ✏️ By Name
        </button>
      </div>

      {isIngredientMode ? (
        // ---- INGREDIENT SEARCH UI ----
        <>
          <div className="search-header">
            <h1>
              <Search size={28} />
              Recipes for you
              {vegetarianParam === 'true' && (
                <span style={{
                  fontSize: '0.82rem',
                  background: 'rgba(90, 138, 42, 0.2)',
                  color: '#C8F0A0',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  marginLeft: '8px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                }}>
                  🌿 Vegetarian
                </span>
              )}
            </h1>
            {ingredientList.length > 0 && (
              <div className="search-ingredients">
                {ingredientList.map((ing, i) => (
                  <IngredientChip key={`${ing}-${i}`} name={ing} delay={i} />
                ))}
              </div>
            )}
          </div>

          {/* Sort Bar */}
          <div className="sort-bar glass-card">
            <SlidersHorizontal size={16} className="sort-icon" />
            <span className="sort-label">Sort by</span>
            <div className="sort-pills">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`sort-pill ${sortBy === opt.value ? 'active' : ''}`}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {recipes.length > 0 && (
              <span className="results-count">{recipes.length} recipes found</span>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <LoadingSpinner text="Finding the best recipes..." />
          ) : error ? (
            <div className="error-state">
              <AlertCircle size={56} strokeWidth={1.2} />
              <h3>Something went wrong</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button className="btn-primary" onClick={searchRecipes}>Try Again</button>
                <Link to="/scan" className="btn-outline">
                  <ArrowLeft size={16} />
                  Back to Scan
                </Link>
              </div>
            </div>
          ) : sortedRecipes.length > 0 ? (
            <div className="results-grid">
              {sortedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSaved={savedIds.has(recipe.id)}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
                  userIngredients={ingredientsParam}
                />
              ))}
            </div>
          ) : searched ? (
            <div className="empty-state">
              <ChefHat size={56} />
              <h3>No recipes found</h3>
              <p>Try different ingredients or adjust your filters.</p>
              <Link to="/scan" className="btn-primary" style={{ marginTop: '1rem' }}>
                <ArrowLeft size={16} />
                Back to Scan
              </Link>
            </div>
          ) : (
            <div className="empty-state">
              <Search size={56} />
              <h3>Search for recipes</h3>
              <p>Go to the Scan page to detect ingredients from a photo, then come back here.</p>
              <Link to="/scan" className="btn-primary" style={{ marginTop: '1rem' }}>
                Scan Your Fridge
              </Link>
            </div>
          )}
        </>
      ) : (
        // ---- NAME SEARCH UI ----
        <>
          <div className="search-header">
            <h1>
              <Search size={28} />
              Search Recipes
            </h1>
          </div>

          {/* Name Search Box */}
          <div className="name-search-box glass-card">
            <div className="name-search-input-wrapper">
              <Search size={20} className="name-search-icon" />
              <input
                type="text"
                className="name-search-input"
                placeholder="Search by recipe name (e.g. Butter Chicken, Pizza)..."
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchByName()}
                id="recipe-name-input"
              />
              <button className="name-search-btn" onClick={searchByName} disabled={loading}>
                {loading ? (
                  <span className="btn-spinner" />
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="quick-suggestions">
              <span className="suggestions-label">Quick suggestions:</span>
              <div className="suggestion-chips">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="suggestion-chip"
                    onClick={() => handleQuickSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cuisine Filter */}
          <div className="name-search-filters glass-card">
            <div className="filter-row">
              <label className="filter-label">Cuisine preference</label>
              <div className="cuisine-pills">
                {CUISINES.map(cuisine => (
                  <button
                    key={cuisine}
                    className={`cuisine-pill ${selectedCuisine === cuisine ? 'active' : ''}`}
                    onClick={() => setSelectedCuisine(cuisine)}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </div>

            {/* Vegetarian Toggle */}
            <div className="veg-toggle-row">
              <div className="veg-label">
                <Leaf size={18} className="veg-icon" />
                <span>Vegetarian only</span>
              </div>
              <button
                className={`toggle-switch ${isVegetarian ? 'active' : ''}`}
                onClick={() => setIsVegetarian(!isVegetarian)}
                role="switch"
                aria-checked={isVegetarian}
                id="veg-toggle-name"
              >
                <div className="toggle-knob" />
              </button>
            </div>
          </div>

          {/* Sort Bar */}
          {recipes.length > 0 && (
            <div className="sort-bar glass-card">
              <SlidersHorizontal size={16} className="sort-icon" />
              <span className="sort-label">Sort by</span>
              <div className="sort-pills">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`sort-pill ${sortBy === opt.value ? 'active' : ''}`}
                    onClick={() => setSortBy(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {recipes.length > 0 && (
                <span className="results-count">{recipes.length} recipes found</span>
              )}
            </div>
          )}

          {/* Results */}
          {loading ? (
            <LoadingSpinner text="Finding the best recipes..." />
          ) : error ? (
            <div className="error-state">
              <AlertCircle size={56} strokeWidth={1.2} />
              <h3>Something went wrong</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button className="btn-primary" onClick={searchByName}>Try Again</button>
              </div>
            </div>
          ) : sortedRecipes.length > 0 ? (
            <div className="results-grid">
              {sortedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSaved={savedIds.has(recipe.id)}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
                  userIngredients=""
                />
              ))}
            </div>
          ) : searched ? (
            <div className="empty-state">
              <ChefHat size={56} />
              <h3>No recipes found</h3>
              <p>Try a different search term or adjust your filters.</p>
            </div>
          ) : (
            <div className="empty-state">
              <Search size={56} />
              <h3>Find recipes by name</h3>
              <p>Enter your favorite dish or browse quick suggestions above.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
} 