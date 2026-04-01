import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { recipesAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import RecipeCard from '../components/RecipeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import IngredientChip from '../components/IngredientChip';
import { Search, SlidersHorizontal, ChefHat } from 'lucide-react';
import './SearchResults.css';

const SORT_OPTIONS = [
  { value: 'match', label: 'Match %' },
  { value: 'time', label: 'Cook Time' },
  { value: 'health', label: 'Health Score' },
];

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState('match');

  const ingredientsParam = searchParams.get('ingredients') || '';
  const cuisineParam = searchParams.get('cuisine') || '';
  const dietParam = searchParams.get('diet') || '';
  const ingredientList = ingredientsParam ? ingredientsParam.split(',').map(i => i.trim()) : [];

  // Load saved recipe IDs
  useEffect(() => {
    if (user) {
      recipesAPI.getSaved().then(res => {
        const ids = new Set((res.data.savedRecipes || []).map(r => r.spoonacularId));
        setSavedIds(ids);
      }).catch(() => {});
    }
  }, [user]);

  // Search on mount
  useEffect(() => {
    if (ingredientList.length > 0) {
      searchRecipes();
    }
  }, [ingredientsParam, cuisineParam, dietParam]);

  const searchRecipes = async () => {
    if (ingredientList.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await recipesAPI.search({
        ingredients: ingredientsParam,
        cuisine: cuisineParam,
        diet: dietParam,
        number: 24,
      });
      setRecipes(res.data.recipes || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (recipe) => {
    if (!user) return;
    try {
      await recipesAPI.save({
        spoonacularId: recipe.id,
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

  return (
    <div className="search-page page-enter" id="search-page">
      <div className="search-header">
        <h1>
          <Search size={28} />
          Recipes for you
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
        </div>
      ) : (
        <div className="empty-state">
          <Search size={56} />
          <h3>Search for recipes</h3>
          <p>Go to the Scan page to detect ingredients from a photo, then come back here.</p>
        </div>
      )}
    </div>
  );
}
