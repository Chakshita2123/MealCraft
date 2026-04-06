import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, Search, ShoppingCart, Heart, LogOut, Menu, X, ChefHat, Calendar } from 'lucide-react';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: <ChefHat size={18} /> },
    { to: '/scan', label: 'Scan', icon: <Camera size={18} /> },
    { to: '/search?mode=name', label: 'Recipes', icon: <Search size={18} /> },
    { to: '/saved', label: 'Saved', icon: <Heart size={18} /> },
    { to: '/planner', label: 'Planner', icon: <Calendar size={18} /> },
    { to: '/shopping', label: 'Shopping', icon: <ShoppingCart size={18} /> },
  ];

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo" onClick={() => setMobileOpen(false)}>
          <ChefHat size={28} className="logo-icon" />
          <span className="logo-text">Meal<span className="logo-accent">Craft</span></span>
        </Link>

        {user && (
          <>
            <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
              <button className="nav-link logout-btn" onClick={handleLogout}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>

            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </>
        )}

        {!user && (
          <div className="navbar-auth">
            <Link to="/login" className="nav-auth-link">Log In</Link>
            <Link to="/register" className="nav-auth-btn">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
