import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesAPI, shoppingAPI } from '../api';
import { Camera, Search, ShoppingCart, BookOpen, ArrowRight, ChefHat, Sparkles, UtensilsCrossed } from 'lucide-react';
import RecipeCard from '../components/RecipeCard';
import './Dashboard.css';

const cookingQuotes = [
  '"Cooking is like love — it should be entered into with abandon or not at all." — Harriet Van Horne',
  '"The secret ingredient is always love." — Julia Child',
  '"Good food is the foundation of genuine happiness." — Auguste Escoffier',
  '"One cannot think well, love well, sleep well, if one has not dined well." — Virginia Woolf',
  '"Cooking is an art, but all art requires knowing something about the techniques." — Nathan Myhrvold',
];

export default function Dashboard() {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [stats, setStats] = useState({ recipes: 0, shopping: 0, ingredients: 0 });
  const [loading, setLoading] = useState(true);
  const [quote] = useState(() => cookingQuotes[Math.floor(Math.random() * cookingQuotes.length)]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipesRes, shoppingRes] = await Promise.allSettled([
          recipesAPI.getSaved(),
          shoppingAPI.getList(),
        ]);

        const savedRecipesList = recipesRes.status === 'fulfilled'
          ? (recipesRes.value.data.savedRecipes || [])
          : [];

        const shoppingItems = shoppingRes.status === 'fulfilled'
          ? (shoppingRes.value.data.items || [])
          : [];

        setSavedRecipes(savedRecipesList);
        setStats({
          recipes: savedRecipesList.length,
          shopping: shoppingItems.filter(i => !i.purchased).length,
          ingredients: 0,
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleUnsave = async (id) => {
    try {
      await recipesAPI.unsave(id);
      setSavedRecipes(prev => prev.filter(r => r.spoonacularId !== id));
      setStats(prev => ({ ...prev, recipes: prev.recipes - 1 }));
    } catch (err) {
      console.error('Unsave error:', err);
    }
  };

  const quickActions = [
    { to: '/scan', icon: <Camera size={28} />, label: 'Scan Fridge', desc: 'Identify ingredients with AI', color: '#00C896' },
    { to: '/search', icon: <Search size={28} />, label: 'Find Recipes', desc: 'Search by ingredients', color: '#7C3AED' },
    { to: '/shopping', icon: <ShoppingCart size={28} />, label: 'Shopping List', desc: 'Manage your list', color: '#C4622D' },
  ];

  return (
    <div className="dashboard" id="dashboard-page">
      {/* Animated background orbs — matches Landing */}
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1"></div>
        <div className="dash-orb dash-orb-2"></div>
        <div className="dash-orb dash-orb-3"></div>
      </div>

      {/* Welcome Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-greeting">
            Welcome back, <span className="dash-name">{user?.name?.split(' ')[0] || 'Chef'}</span> 👋
          </h1>
          <p className="dash-subtitle">What are we cooking today?</p>
          <p className="dash-quote">
            <span>✦</span> {quote}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        {quickActions.map((action, i) => (
          <Link to={action.to} className="action-card" key={i} style={{ '--action-color': action.color }}>
            <div className="action-icon">{action.icon}</div>
            <div className="action-text">
              <h3>{action.label}</h3>
              <p>{action.desc}</p>
            </div>
            <ArrowRight size={18} className="action-arrow" />
          </Link>
        ))}
      </div>

      {/* Stats — real data */}
      <div className="dash-stats">
        <div className="stat-card">
          <BookOpen size={24} className="stat-icon" />
          <div className="stat-number">{stats.recipes}</div>
          <div className="stat-label">Recipes Saved</div>
        </div>
        <div className="stat-card">
          <UtensilsCrossed size={24} className="stat-icon" />
          <div className="stat-number">{stats.ingredients}</div>
          <div className="stat-label">Ingredients Scanned</div>
        </div>
        <div className="stat-card">
          <ShoppingCart size={24} className="stat-icon" />
          <div className="stat-number">{stats.shopping}</div>
          <div className="stat-label">Shopping Items</div>
        </div>
      </div>

      {/* Saved Recipes */}
      <div className="dash-section">
        <div className="dash-section-header">
          <h2>Your Saved Recipes</h2>
          {savedRecipes.length > 0 && (
            <Link to="/search" className="see-all-link">Browse more <ArrowRight size={14} /></Link>
          )}
        </div>

        {loading ? (
          <div className="dash-loading">
            <div className="dash-loading-spinner"></div>
            <p>Loading your recipes...</p>
          </div>
        ) : savedRecipes.length === 0 ? (
          <div className="dash-empty">
            <ChefHat size={52} className="empty-icon" />
            <h3>No saved recipes yet</h3>
            <p>Scan your fridge or search for recipes to get started!</p>
            <Link to="/scan" className="btn-primary">
              <Camera size={18} />
              Scan Your Fridge
            </Link>
          </div>
        ) : (
          <div className="saved-recipes-grid">
            {savedRecipes.slice(0, 6).map((recipe) => (
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
    </div>
  );
}
