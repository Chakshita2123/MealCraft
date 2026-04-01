import { Heart, Clock, Users, Flame, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './RecipeCard.css';

export default function RecipeCard({ recipe, onSave, onUnsave, isSaved, userIngredients }) {
  const navigate = useNavigate();

  const matchColor = recipe.matchPercentage >= 80 ? 'var(--accent)' :
                     recipe.matchPercentage >= 50 ? 'var(--accent-secondary)' :
                     'var(--terracotta)';

  const handleClick = () => {
    const params = userIngredients ? `?ingredients=${encodeURIComponent(userIngredients)}` : '';
    navigate(`/recipe/${recipe.id}${params}`);
  };

  return (
    <div className="recipe-card" onClick={handleClick} id={`recipe-card-${recipe.id}`}>
      <div className="recipe-card-img-wrap">
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.title} className="recipe-card-img" loading="lazy" />
        ) : (
          <div className="recipe-card-img-placeholder">
            <Flame size={32} />
          </div>
        )}

        {/* Match Badge */}
        {recipe.matchPercentage > 0 && (
          <div className="match-badge" style={{ background: matchColor }}>
            {recipe.matchPercentage}% match
          </div>
        )}

        {/* Difficulty Badge */}
        {recipe.difficulty && (
          <div className={`difficulty-badge diff-${recipe.difficulty.toLowerCase()}`}>
            {recipe.difficulty}
          </div>
        )}

        {/* Veg / Non-veg Indicator */}
        <div className={`veg-indicator ${recipe.vegetarian ? 'veg' : 'non-veg'}`}>
          <div className="veg-dot" />
        </div>

        {/* Bookmark Button */}
        <button
          className={`bookmark-btn ${isSaved ? 'saved' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            isSaved ? onUnsave?.(recipe.id) : onSave?.(recipe);
          }}
          aria-label={isSaved ? 'Unsave recipe' : 'Save recipe'}
        >
          <Heart size={16} fill={isSaved ? '#ff6b6b' : 'none'} color={isSaved ? '#ff6b6b' : '#fff'} />
        </button>
      </div>

      <div className="recipe-card-body">
        <h3 className="recipe-card-title">{recipe.title}</h3>

        <div className="recipe-card-meta">
          {recipe.readyInMinutes && (
            <span className="meta-item">
              <Clock size={14} />
              {recipe.readyInMinutes} min
            </span>
          )}
          {recipe.servings && (
            <span className="meta-item">
              <Users size={14} />
              {recipe.servings}
            </span>
          )}
          {recipe.vegetarian && (
            <span className="meta-item meta-veg">
              <Leaf size={14} />
              Veg
            </span>
          )}
        </div>

        <div className="recipe-card-tags">
          {recipe.vegan && <span className="tag tag-vegan">Vegan</span>}
          {recipe.glutenFree && <span className="tag tag-gf">GF</span>}
          {recipe.dairyFree && <span className="tag tag-df">DF</span>}
        </div>

        {recipe.missedIngredientCount > 0 && (
          <p className="missing-count">
            Missing {recipe.missedIngredientCount} ingredient{recipe.missedIngredientCount > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
