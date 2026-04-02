import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ingredientsAPI, recipesAPI } from '../api';
import { Camera, Plus, ArrowRight, Sparkles, X, Image, Leaf, AlertCircle } from 'lucide-react';
import IngredientChip from '../components/IngredientChip';
import LoadingSpinner from '../components/LoadingSpinner';
import RecipeCard from '../components/RecipeCard';
import { useAuth } from '../context/AuthContext';
import './ScanPage.css';

const CUISINES = ['All', 'Indian', 'Italian', 'Chinese', 'Mexican', 'Thai', 'Japanese', 'Mediterranean'];

export default function ScanPage() {
  const { ingredients, dispatch } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState('All');

  // Recipe results state (inline results)
  const [recipes, setRecipes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setScanError('Please upload an image file.');
      return;
    }

    setScanError('');
    setScanning(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setPreview(dataUrl);

      const base64 = dataUrl.split(',')[1];

      try {
        const res = await ingredientsAPI.detect(base64, file.type);
        if (res.data.success && res.data.ingredients.length > 0) {
          dispatch({ type: 'SET_INGREDIENTS', payload: res.data.ingredients });
          setScanError('');
        } else {
          setScanError('No ingredients detected. Try a clearer photo or add manually.');
        }
      } catch (err) {
        setScanError(err.response?.data?.message || 'Failed to scan image. Try again or add ingredients manually.');
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  }, [dispatch]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleAddManual = (e) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (val) {
      // Support comma-separated input
      const items = val.split(',').map(i => i.trim().toLowerCase()).filter(i => i);
      items.forEach(item => {
        dispatch({ type: 'ADD_INGREDIENT', payload: item });
      });
      setManualInput('');
    }
  };

  const handleFindRecipes = async () => {
    if (ingredients.length === 0) return;

    // If cuisine or diet filters are set, navigate to the full search page
    if (selectedCuisine !== 'All' || isVegetarian) {
      const params = new URLSearchParams();
      params.set('ingredients', ingredients.join(','));
      if (isVegetarian) params.set('diet', 'vegetarian');
      if (selectedCuisine !== 'All') params.set('cuisine', selectedCuisine);
      navigate(`/search?${params.toString()}`);
      return;
    }

    // Otherwise, use the direct find endpoint and show results inline
    setSearching(true);
    setSearchError('');
    setSearched(true);
    setRecipes([]);

    try {
      const res = await recipesAPI.find(ingredients);
      if (res.data.success) {
        setRecipes(res.data.recipes || []);
      } else {
        setSearchError(res.data.message || 'No recipes found.');
      }

      // Load saved recipe IDs
      if (user) {
        try {
          const savedRes = await recipesAPI.getSaved();
          const ids = new Set((savedRes.data.savedRecipes || []).map(r => r.spoonacularId));
          setSavedIds(ids);
        } catch {}
      }
    } catch (err) {
      console.error('Find recipes error:', err);
      setSearchError(
        err.response?.data?.message || 'Failed to find recipes. Please check your connection and try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (recipe) => {
    if (!user) return navigate('/login');
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

  const handleViewAll = () => {
    const params = new URLSearchParams();
    params.set('ingredients', ingredients.join(','));
    if (isVegetarian) params.set('diet', 'vegetarian');
    if (selectedCuisine !== 'All') params.set('cuisine', selectedCuisine);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="scan-page page-enter" id="scan-page">
      <div className="scan-header">
        <h1>
          <Sparkles size={28} className="header-sparkle" />
          What's in your fridge?
        </h1>
        <p>Upload a photo or type your ingredients — we'll find the best recipes for you.</p>
      </div>

      {/* Upload Area */}
      <div className="scan-card glass-card">
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${preview ? 'has-preview' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !scanning && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            hidden
            id="scan-file-input"
          />

          {scanning ? (
            <LoadingSpinner text="AI is scanning your ingredients..." size="small" />
          ) : preview ? (
            <div className="preview-wrap">
              <img src={preview} alt="Scanned fridge" className="preview-img" />
              <div className="preview-overlay">
                <Camera size={24} />
                <span>Tap to scan another photo</span>
              </div>
            </div>
          ) : (
            <div className="upload-content">
              <div className="upload-icon-wrap">
                <Camera size={36} />
              </div>
              <h3>Drop a fridge photo here</h3>
              <p>or click to browse / take a photo</p>
              <span className="upload-hint">JPG, PNG, WebP supported</span>
            </div>
          )}
        </div>

        {scanError && (
          <div className="scan-error">
            <X size={16} />
            <span>{scanError}</span>
          </div>
        )}

        {/* Manual Input */}
        <div className="manual-section">
          <label className="manual-label">Or type ingredients manually</label>
          <form onSubmit={handleAddManual} className="manual-form">
            <input
              type="text"
              placeholder="e.g. tomatoes, chicken, rice, garlic..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              id="manual-ingredient-input"
            />
            <button type="submit" className="btn-icon" disabled={!manualInput.trim()}>
              <Plus size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* Detected Ingredients */}
      {ingredients.length > 0 && (
        <div className="detected-section glass-card">
          <div className="detected-header">
            <h3>
              <Image size={20} />
              Your Ingredients ({ingredients.length})
            </h3>
            <button
              className="clear-link"
              onClick={() => {
                dispatch({ type: 'CLEAR_INGREDIENTS' });
                setRecipes([]);
                setSearched(false);
                setSearchError('');
              }}
            >
              Clear all
            </button>
          </div>
          <div className="chips-wrap">
            {ingredients.map((ing, i) => (
              <IngredientChip
                key={`${ing}-${i}`}
                name={ing}
                delay={i}
                onRemove={() => dispatch({ type: 'REMOVE_INGREDIENT', payload: i })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filters Section */}
      {ingredients.length > 0 && (
        <div className="filters-section glass-card">
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
              id="veg-toggle"
            >
              <div className="toggle-knob" />
            </button>
          </div>

          {/* Cuisine Filter Pills */}
          <div className="cuisine-section">
            <label className="cuisine-label">Cuisine preference</label>
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

          {/* Find Recipes CTA */}
          <button
            className="btn-primary btn-lg find-recipes-btn"
            onClick={handleFindRecipes}
            disabled={searching}
          >
            {searching ? (
              <>
                <span className="btn-spinner" />
                Finding Recipes...
              </>
            ) : (
              <>
                Find Recipes
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}

      {/* Inline Recipe Results */}
      {searching && (
        <div className="inline-results-section">
          <LoadingSpinner text="Finding the best recipes for your ingredients..." />
        </div>
      )}

      {searchError && (
        <div className="search-error-banner glass-card">
          <AlertCircle size={20} />
          <div>
            <strong>Couldn't find recipes</strong>
            <p>{searchError}</p>
          </div>
        </div>
      )}

      {!searching && searched && recipes.length > 0 && (
        <div className="inline-results-section">
          <div className="results-header">
            <h2>
              <Sparkles size={22} />
              Recipes Found ({recipes.length})
            </h2>
            <button className="btn-outline btn-sm" onClick={handleViewAll}>
              View All
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="inline-results-grid">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isSaved={savedIds.has(recipe.id)}
                onSave={handleSave}
                onUnsave={handleUnsave}
                userIngredients={ingredients.join(',')}
              />
            ))}
          </div>
        </div>
      )}

      {!searching && searched && recipes.length === 0 && !searchError && (
        <div className="no-results-card glass-card">
          <AlertCircle size={40} strokeWidth={1.5} />
          <h3>No recipes found</h3>
          <p>Try adding different ingredients or adjust your filters.</p>
        </div>
      )}
    </div>
  );
}
