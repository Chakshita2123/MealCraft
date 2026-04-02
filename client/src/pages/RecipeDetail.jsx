import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { recipesAPI, shoppingAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Clock, Users, Flame, Heart, ShoppingCart, ArrowLeft, ArrowRight,
  Check, X, Leaf, WheatOff, Share2, Minus, Plus, AlertCircle
} from 'lucide-react';
import './RecipeDetail.css';

export default function RecipeDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [addedToList, setAddedToList] = useState(false);
  const [servings, setServings] = useState(0);
  const [saving, setSaving] = useState(false);

  const userIngredients = searchParams.get('ingredients') || '';

  useEffect(() => {
    const loadRecipe = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await recipesAPI.getById(id, userIngredients);
        setRecipe(res.data.recipe);
        setServings(res.data.recipe.servings || 2);

        if (user) {
          try {
            const savedRes = await recipesAPI.getSaved();
            const saved = (savedRes.data.savedRecipes || []).some(
              r => r.spoonacularId === parseInt(id)
            );
            setIsSaved(saved);
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load recipe:', err);
        setError(
          err.response?.data?.message || 'Failed to load recipe details. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };
    loadRecipe();
  }, [id, userIngredients, user]);

  const handleSave = async () => {
    if (!user) return navigate('/login');
    setSaving(true);
    try {
      if (isSaved) {
        await recipesAPI.unsave(recipe.id);
        setIsSaved(false);
      } else {
        await recipesAPI.save({
          spoonacularId: recipe.id,
          title: recipe.title,
          image: recipe.image,
          readyInMinutes: recipe.readyInMinutes,
          servings: recipe.servings,
          vegetarian: recipe.vegetarian,
        });
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Save/unsave error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMissing = async () => {
    if (!user) return navigate('/login');
    const missing = recipe.ingredients.filter(i => !i.have);
    if (missing.length === 0) return;

    setAddingToList(true);
    try {
      await shoppingAPI.addItems(
        missing.map(i => ({
          name: i.original || i.name,
          aisle: i.aisle,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
        }))
      );
      setAddedToList(true);
    } catch (err) {
      console.error('Add to list error:', err);
    } finally {
      setAddingToList(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, url: window.location.href });
      } catch {} 
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const adjustServings = (delta) => {
    setServings(prev => Math.max(1, prev + delta));
  };

  const servingMultiplier = recipe ? servings / (recipe.servings || 1) : 1;

  if (loading) {
    return (
      <div className="recipe-detail-page">
        <LoadingSpinner text="Loading recipe..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="recipe-detail-page">
        <div className="detail-error-state">
          <AlertCircle size={56} strokeWidth={1.2} />
          <h3>Failed to load recipe</h3>
          <p>{error}</p>
          <div className="detail-error-actions">
            <button className="btn-primary" onClick={() => window.location.reload()}>Try Again</button>
            <button className="btn-outline" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="recipe-detail-page">
        <div className="empty-state">
          <h3>Recipe not found</h3>
          <button className="btn-primary" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  const missingIngredients = recipe.ingredients.filter(i => !i.have);
  const haveIngredients = recipe.ingredients.filter(i => i.have);

  return (
    <div className="recipe-detail-page page-enter" id="recipe-detail-page">
      {/* Hero Image */}
      <div className="detail-hero">
        {recipe.image && (
          <img src={recipe.image} alt={recipe.title} className="detail-hero-img" />
        )}
        <div className="detail-hero-overlay">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="hero-glow" />
      </div>

      <div className="detail-body">
        {/* Title & Meta */}
        <div className="detail-title-section">
          <h1 className="detail-title">{recipe.title}</h1>
          <div className="detail-meta">
            {recipe.readyInMinutes && (
              <span className="detail-tag"><Clock size={15} /> {recipe.readyInMinutes} min</span>
            )}
            {recipe.difficulty && (
              <span className={`detail-tag diff-${recipe.difficulty.toLowerCase()}`}>
                <Flame size={15} /> {recipe.difficulty}
              </span>
            )}
            {recipe.vegetarian && (
              <span className="detail-tag tag-veg"><Leaf size={15} /> Vegetarian</span>
            )}
            {recipe.glutenFree && (
              <span className="detail-tag tag-gf"><WheatOff size={15} /> Gluten Free</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="detail-actions">
          <button
            className={`action-btn ${isSaved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            <Heart size={18} fill={isSaved ? '#ff6b6b' : 'none'} color={isSaved ? '#ff6b6b' : 'currentColor'} />
            {saving ? '...' : isSaved ? 'Saved' : 'Save'}
          </button>
          <button className="action-btn" onClick={handleShare}>
            <Share2 size={18} />
            Share
          </button>
        </div>

        {/* Servings Adjuster */}
        <div className="servings-adjuster glass-card">
          <Users size={18} />
          <span className="servings-label">Servings</span>
          <div className="servings-controls">
            <button className="servings-btn" onClick={() => adjustServings(-1)} disabled={servings <= 1}>
              <Minus size={16} />
            </button>
            <span className="servings-count">{servings}</span>
            <button className="servings-btn" onClick={() => adjustServings(1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Nutrition Row */}
        {recipe.nutrition && (
          <div className="nutrition-row">
            {[
              { label: 'Calories', data: recipe.nutrition.calories, color: 'var(--terracotta)' },
              { label: 'Protein', data: recipe.nutrition.protein, color: 'var(--accent)' },
              { label: 'Carbs', data: recipe.nutrition.carbs, color: 'var(--accent-secondary)' },
              { label: 'Fat', data: recipe.nutrition.fat, color: '#f0a500' },
            ].filter(n => n.data).map((n, i) => (
              <div key={i} className="nutrition-mini-card glass-card" style={{ '--n-color': n.color }}>
                <div className="n-value">{Math.round(n.data.amount * servingMultiplier)}</div>
                <div className="n-unit">{n.data.unit}</div>
                <div className="n-label">{n.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Ingredients */}
        <section className="detail-section">
          <h2>Ingredients</h2>
          <div className="ingredients-list">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className={`ingredient-chip-row ${ing.have ? 'have' : 'missing'}`}>
                <div className={`ing-badge ${ing.have ? 'have' : 'missing'}`}>
                  {ing.have ? <Check size={12} /> : <X size={12} />}
                </div>
                <span className="ing-text">
                  {ing.amount ? `${(ing.amount * servingMultiplier).toFixed(1).replace(/\.0$/, '')} ${ing.unit || ''} ` : ''}
                  {ing.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Instructions */}
        {recipe.steps && recipe.steps.length > 0 && (
          <section className="detail-section">
            <h2>Instructions</h2>
            <div className="steps-list">
              {recipe.steps.map((step, i) => (
                <div key={i} className="step-item">
                  <div className="step-number">{step.number}</div>
                  <div className="step-content">
                    <p>{step.step}</p>
                    {step.equipment && step.equipment.length > 0 && (
                      <div className="step-equipment">
                        {step.equipment.map((eq, j) => (
                          <span key={j} className="equip-tag">{eq}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No Instructions Fallback */}
        {(!recipe.steps || recipe.steps.length === 0) && recipe.summary && (
          <section className="detail-section">
            <h2>About This Recipe</h2>
            <div
              className="recipe-summary"
              dangerouslySetInnerHTML={{ __html: recipe.summary }}
            />
          </section>
        )}

        {/* Missing Ingredients Section */}
        {missingIngredients.length > 0 && (
          <section className="detail-section missing-section glass-card">
            <h2>
              <ShoppingCart size={20} />
              Missing Ingredients ({missingIngredients.length})
            </h2>
            <div className="missing-list">
              {missingIngredients.map((ing, i) => (
                <span key={i} className="missing-chip">{ing.name}</span>
              ))}
            </div>
            <button
              className={`btn-primary btn-lg ${addedToList ? 'added' : ''}`}
              onClick={handleAddMissing}
              disabled={addingToList || addedToList}
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
            >
              {addedToList ? <><Check size={18} /> Added to Shopping List!</> :
               addingToList ? 'Adding...' :
               <>Add Missing to Shopping List <ArrowRight size={18} /></>}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
