import { Link } from 'react-router-dom';
import { Camera, Search, ChefHat, ShoppingCart, Sparkles, ArrowRight } from 'lucide-react';
import './Landing.css';

const features = [
  {
    icon: <Camera size={32} />,
    title: 'Scan Your Fridge',
    desc: 'Take a photo and let AI identify every ingredient instantly.',
    color: '#C4622D',
  },
  {
    icon: <Search size={32} />,
    title: 'Smart Recipe Match',
    desc: 'Find recipes ranked by how many ingredients you already have.',
    color: '#8B7355',
  },
  {
    icon: <ChefHat size={32} />,
    title: 'Step-by-Step Cooking',
    desc: 'Follow detailed instructions with nutrition breakdowns.',
    color: '#D4956A',
  },
  {
    icon: <ShoppingCart size={32} />,
    title: 'Auto Shopping Lists',
    desc: 'Missing ingredients? Add them to your list in one click.',
    color: '#C4622D',
  },
];

export default function Landing() {
  return (
    <div className="landing" id="landing-page">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
      </div>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            <span>AI-Powered Meal Planning</span>
          </div>
          <h1 className="hero-title">
            Snap your fridge.<br />
            <span className="hero-gradient">Get recipes.</span><br />
            Cook smarter.
          </h1>
          <p className="hero-subtitle">
            MealCraft uses AI vision to identify your ingredients and finds the perfect recipes —
            so nothing goes to waste.
          </p>
          <div className="hero-ctas">
            <Link to="/register" className="btn-primary btn-lg">
              Get Started Free
              <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-outline btn-lg">
              Log In
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-card hero-card-1">
            <div className="mini-badge" style={{ background: 'rgba(196, 98, 45, 0.12)', color: '#C4622D' }}>92% match</div>
            <div className="mini-title">Tomato Basil Pasta</div>
            <div className="mini-meta">25 min · 4 servings</div>
          </div>
          <div className="hero-card hero-card-2">
            <div className="mini-badge" style={{ background: 'rgba(212, 149, 106, 0.15)', color: '#8B7355' }}>76% match</div>
            <div className="mini-title">Chicken Stir Fry</div>
            <div className="mini-meta">30 min · 2 servings</div>
          </div>
          <div className="hero-card hero-card-3">
            <div className="mini-badge" style={{ background: 'rgba(160, 128, 96, 0.12)', color: '#A08060' }}>88% match</div>
            <div className="mini-title">Greek Salad Bowl</div>
            <div className="mini-meta">15 min · 2 servings</div>
          </div>
          <div className="hero-phone-outline"></div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <h2 className="section-title">How it works</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i} style={{ '--accent-color': f.color }}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-glass">
          <h2>Ready to cook smarter?</h2>
          <p>Join MealCraft and turn what you already have into amazing meals.</p>
          <Link to="/register" className="btn-primary btn-lg">
            Start Cooking
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 MealCraft. Built with ❤️ and AI.</p>
      </footer>
    </div>
  );
}
