import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { recipesAPI } from '../api';
import RecipeCard from '../components/RecipeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { Heart, Camera, ChefHat, AlertCircle } from 'lucide-react';
import './SavedRecipes.css';

export default function SavedRecipes() {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recipesAPI.getSaved();
      setSavedRecipes(res.data.savedRecipes || []);
    } catch (err) {
      console.error('Failed to load saved recipes:', err);
      setError(
        err.response?.data?.message || 'Failed to load saved recipes. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (id) => {
    try {
      await recipesAPI.unsave(id);
      setSavedRecipes(prev => prev.filter(r => r.spoonacularId !== id));
    } catch (err) {
      console.error('Unsave error:', err);
    }
  };

  if (loading) {
    return (
      <div className="saved-page">
        <LoadingSpinner text="Loading saved recipes..." />
      </div>
    );
  }

  return (
    <div className="saved-page page-enter" id="saved-page">
      <div className="saved-header">
        <h1>
          <Heart size={28} />
          Saved Recipes
        </h1>
        <p>{savedRecipes.length} recipe{savedRecipes.length !== 1 ? 's' : ''} saved</p>
      </div>

      {error ? (
        <div className="saved-error">
          <AlertCircle size={48} strokeWidth={1.2} />
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadSaved}>Try Again</button>
        </div>
      ) : savedRecipes.length === 0 ? (
        <div className="saved-empty">
          <div className="empty-illustration">
            <ChefHat size={64} strokeWidth={1} />
            <div className="empty-heart">
              <Heart size={24} fill="var(--terracotta)" color="var(--terracotta)" />
            </div>
          </div>
          <h3>No saved recipes yet</h3>
          <p>Browse recipes and tap the heart icon to save your favorites here!</p>
          <Link to="/scan" className="btn-primary">
            <Camera size={18} />
            Scan Your Fridge
          </Link>
        </div>
      ) : (
        <div className="saved-grid">
          {savedRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.spoonacularId}
              recipe={{
                id: recipe.spoonacularId,
                title: recipe.title,
                image: recipe.image,
                readyInMinutes: recipe.readyInMinutes,
                servings: recipe.servings,
                vegetarian: recipe.vegetarian,
                matchPercentage: recipe.matchPercentage || 0,
              }}
              isSaved={true}
              onUnsave={() => handleUnsave(recipe.spoonacularId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
