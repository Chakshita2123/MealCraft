import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesAPI, shoppingAPI } from '../api';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  Camera, Search, ShoppingCart, BookOpen, ArrowRight,
  ChefHat, UtensilsCrossed, Sparkles, Star, Clock, Flame
} from 'lucide-react';
import RecipeCard from '../components/RecipeCard';
import './Dashboard.css';

const cookingQuotes = [
  { text: 'Cooking is like love — it should be entered into with abandon or not at all.', author: 'Harriet Van Horne' },
  { text: 'The secret ingredient is always love.', author: 'Julia Child' },
  { text: 'Good food is the foundation of genuine happiness.', author: 'Auguste Escoffier' },
  { text: 'One cannot think well, love well, sleep well, if one has not dined well.', author: 'Virginia Woolf' },
  { text: 'Cooking is an art, but all art requires knowing something about the techniques.', author: 'Nathan Myhrvold' },
];

const FEATURED_MEALS = ['52772', '53049', '52819', '52818', '52813', '52807', '52804', '52803'];
const FLOATERS = ['🍅', '🥕', '🧅', '🌶️', '🥦', '🧄', '🍋', '🫑', '🥑', '🌿', '🍄', '🫚'];

function useCountUp(target, duration = 1400) {
  const [count, setCount] = useState(0);
  const startTime = useRef(null);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startTime.current = null;
    const animate = (ts) => {
      if (!startTime.current) startTime.current = ts;
      const progress = Math.min((ts - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return count;
}

function TiltCard({ children, className, style }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.03, z: 30 }}
      transition={{ scale: { duration: 0.2 } }}
    >
      <div className="tilt-glare" />
      {children}
    </motion.div>
  );
}

function StatCard({ icon, value, label, color, delay }) {
  const count = useCountUp(value);

  // Circle ring: circumference of r=26 is ~163
  const CIRCUMFERENCE = 163;
  const fillOffset = value > 0 ? 0 : CIRCUMFERENCE;

  const hints = {
    'Recipes Saved': 'Save recipes to see them here',
    'Ingredients Scanned': 'Scan your fridge to track',
    'Shopping Items': 'Add missing ingredients',
  };

  return (
    <motion.div
      className={`stat-card ${value > 0 ? 'has-value' : ''}`}
      style={{ '--stat-color': color }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, boxShadow: `0 24px 60px ${color}30` }}
    >
      {/* Icon */}
      <div className="stat-icon-wrap">{icon}</div>

      {/* Big animated number */}
      <div className="stat-number">{count}</div>

      {/* Label */}
      <div className="stat-label">{label}</div>

      {/* Empty hint when value is 0 */}
      {value === 0 && (
        <div className="stat-empty-hint">{hints[label]}</div>
      )}

      {/* Circular SVG ring */}
      <div className="stat-ring-wrap">
        <svg className="stat-ring" viewBox="0 0 64 64">
          <circle className="stat-ring-track" cx="32" cy="32" r="26" />
          <motion.circle
            className="stat-ring-fill"
            cx="32"
            cy="32"
            r="26"
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: fillOffset }}
            transition={{ delay: delay + 0.4, duration: 1.2, ease: 'easeOut' }}
            style={{
              fill: 'none',
              stroke: color,
              strokeWidth: 4,
              strokeLinecap: 'round',
              strokeDasharray: CIRCUMFERENCE,
            }}
          />
        </svg>
      </div>

      {/* Bottom shimmer bar */}
      <div className="stat-bar">
        <motion.div
          className="stat-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: value > 0 ? '100%' : '15%' }}
          transition={{ delay: delay + 0.3, duration: 1, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

function FeaturedRecipeCard({ meal }) {
  if (!meal) return (
    <div className="featured-skeleton">
      <div className="skeleton-shimmer" />
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard className="featured-recipe-card-wrap">
        <Link to={`/recipe/${meal.idMeal}`} className="featured-recipe-card">
          <div className="featured-badge">
            <Star size={11} fill="currentColor" /> Today's Pick
          </div>
          <img src={meal.strMealThumb} alt={meal.strMeal} className="featured-img" />
          <div className="featured-overlay">
            <div className="featured-meta">
              <span className="featured-category">{meal.strCategory}</span>
              <span className="featured-dot">·</span>
              <span className="featured-area">{meal.strArea} Cuisine</span>
            </div>
            <h3 className="featured-title">{meal.strMeal}</h3>
            <div className="featured-footer">
              <span className="feat-tag"><Clock size={11} /> 30 min</span>
              <div className="featured-cta">Cook Now <ArrowRight size={14} /></div>
            </div>
          </div>
        </Link>
      </TiltCard>
    </motion.div>
  );
}

function ActionCard({ to, emoji, label, desc, bg, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard className="action-card" style={{ '--action-bg': bg }}>
        <Link to={to} className="action-card-inner">
          <div className="action-emoji">{emoji}</div>
          <div className="action-text">
            <h3>{label}</h3>
            <p>{desc}</p>
          </div>
          <div className="action-arrow-wrap">
            <ArrowRight size={18} />
          </div>
        </Link>
      </TiltCard>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [stats, setStats] = useState({ recipes: 0, shopping: 0, ingredients: 0 });
  const [loading, setLoading] = useState(true);
  const [featuredMeal, setFeaturedMeal] = useState(null);
  const [quote] = useState(() => cookingQuotes[Math.floor(Math.random() * cookingQuotes.length)]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good morning', emoji: '☀️' };
    if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    return { text: 'Good evening', emoji: '🌙' };
  };
  const greeting = getGreeting();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipesRes, shoppingRes] = await Promise.allSettled([
          recipesAPI.getSaved(),
          shoppingAPI.getList(),
        ]);
        const savedList = recipesRes.status === 'fulfilled' ? (recipesRes.value.data.savedRecipes || []) : [];
        const shoppingItems = shoppingRes.status === 'fulfilled' ? (shoppingRes.value.data.items || []) : [];
        setSavedRecipes(savedList);
        setStats({
          recipes: savedList.length,
          shopping: shoppingItems.filter(i => !i.purchased).length,
          ingredients: 0,
        });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    const loadFeatured = async () => {
      try {
        const randomId = FEATURED_MEALS[Math.floor(Math.random() * FEATURED_MEALS.length)];
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${randomId}`);
        const data = await res.json();
        setFeaturedMeal(data.meals?.[0] || null);
      } catch (e) { }
    };

    loadData();
    loadFeatured();
  }, []);

  const handleUnsave = async (id) => {
    try {
      await recipesAPI.unsave(id);
      setSavedRecipes(prev => prev.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, recipes: prev.recipes - 1 }));
    } catch (err) {
      console.error('Unsave error:', err);
    }
  };

  const quickActions = [
    { to: '/scan', emoji: '📸', label: 'Scan Fridge', desc: 'Identify ingredients with AI', bg: 'linear-gradient(135deg, #C4622D, #E8956D)', delay: 0.15 },
    { to: '/search', emoji: '🍳', label: 'Find Recipes', desc: 'Search by ingredients', bg: 'linear-gradient(135deg, #5C7A3E, #7A9E5F)', delay: 0.25 },
    { to: '/shopping', emoji: '🛒', label: 'Shopping List', desc: 'Manage your groceries', bg: 'linear-gradient(135deg, #C4882D, #E8B84B)', delay: 0.35 },
  ];

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } }
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
  };

  return (
    <div className="dashboard" id="dashboard-page">

      {/* ── DECORATIVE ORBS ── */}
      <div className="dash-bg" aria-hidden="true">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />
        <div className="dash-orb dash-orb-3" />
        <svg className="dash-pattern" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1.5" fill="#C4622D" opacity="0.12" />
              <circle cx="25" cy="20" r="1" fill="#C4622D" opacity="0.08" />
              <circle cx="15" cy="35" r="1.5" fill="#C4622D" opacity="0.10" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotPattern)" />
        </svg>
      </div>

      {/* ── FLOATING INGREDIENTS ── */}
      <div className="floaters-container" aria-hidden="true">
        {FLOATERS.map((emoji, i) => (
          <span
            key={i}
            className="floater"
            style={{
              left: `${(i * 8.3) % 100}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${14 + (i % 5) * 3}s`,
              fontSize: `${1.1 + (i % 3) * 0.4}rem`,
              opacity: 0.18 + (i % 4) * 0.05,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="dash-content">

        {/* HERO */}
        <div className="dash-hero">
          <motion.div
            className="dash-hero-left"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dash-time-greeting">
              <span className="dash-time-emoji">{greeting.emoji}</span>
              <span>{greeting.text}</span>
            </div>
            <h1 className="dash-greeting">
              Welcome back,<br />
              <span className="dash-name">{user?.name?.split(' ')[0] || 'Chef'}</span>
            </h1>
            <p className="dash-subtitle">What are we cooking today?</p>
            <blockquote className="dash-quote">
              <span className="quote-mark">"</span>
              {quote.text}
              <footer className="quote-author">— {quote.author}</footer>
            </blockquote>
          </motion.div>

          <div className="dash-hero-right">
            <FeaturedRecipeCard meal={featuredMeal} />
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="quick-actions-section">
          <motion.div
            className="section-label"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Flame size={14} /> Quick Actions
          </motion.div>
          <div className="quick-actions">
            {quickActions.map((a, i) => <ActionCard key={i} {...a} />)}
          </div>
        </div>

        {/* STATS */}
        <div className="dash-stats-section">
          <motion.div
            className="section-label"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Sparkles size={14} /> Your Activity
          </motion.div>
          <div className="dash-stats">
            <StatCard icon={<BookOpen size={26} />} value={stats.recipes} label="Recipes Saved" color="#C4622D" delay={0.25} />
            <StatCard icon={<UtensilsCrossed size={26} />} value={stats.ingredients} label="Ingredients Scanned" color="#5C7A3E" delay={0.35} />
            <StatCard icon={<ShoppingCart size={26} />} value={stats.shopping} label="Shopping Items" color="#C4882D" delay={0.45} />
          </div>
        </div>

        {/* SAVED RECIPES */}
        <div className="dash-section">
          <div className="dash-section-header">
            <div>
              <div className="section-label">
                <ChefHat size={14} /> Your Collection
              </div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Saved Recipes
              </motion.h2>
            </div>
            {savedRecipes.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Link to="/saved" className="see-all-link">
                  See all <ArrowRight size={14} />
                </Link>
              </motion.div>
            )}
          </div>

          {loading ? (
            <div className="dash-loading">
              <div className="dash-loading-spinner" />
              <p>Loading your recipes...</p>
            </div>
          ) : savedRecipes.length === 0 ? (
            <motion.div
              className="dash-empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="empty-illustration">
                <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="empty-svg">
                  <circle cx="60" cy="60" r="50" fill="rgba(196,98,45,0.06)" />
                  <circle cx="60" cy="60" r="35" fill="rgba(196,98,45,0.08)" />
                  <text x="60" y="72" textAnchor="middle" fontSize="36">🍽️</text>
                </svg>
              </div>
              <h3>No saved recipes yet</h3>
              <p>Scan your fridge or search for recipes to get started!</p>
              <Link to="/scan" className="btn-primary">
                <Camera size={16} /> Scan Your Fridge
              </Link>
            </motion.div>
          ) : (
            <motion.div
              className="saved-recipes-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {savedRecipes.slice(0, 6).map((recipe) => (
                <motion.div key={recipe.id} variants={cardVariants}>
                  <TiltCard className="recipe-tilt-wrap">
                    <RecipeCard
                      recipe={{
                        id: recipe.id,
                        title: recipe.title,
                        image: recipe.image,
                        readyInMinutes: recipe.readyInMinutes,
                        servings: recipe.servings,
                        vegetarian: recipe.vegetarian,
                        matchPercentage: recipe.matchPercentage || 0,
                      }}
                      isSaved={true}
                      onUnsave={() => handleUnsave(recipe.id)}
                    />
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}