import { useEffect, useState } from 'react';
import { shoppingAPI } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ShoppingCart, Check, Trash2, X, ChefHat, Package
} from 'lucide-react';
import './ShoppingList.css';

const CATEGORY_EMOJIS = {
  'Produce': '🥬',
  'Dairy': '🧀',
  'Meat & Seafood': '🥩',
  'Pantry': '🥫',
  'Frozen': '🧊',
  'Bakery': '🍞',
  'Beverages': '🥤',
  'Spices': '🧂',
  'Other': '📦',
};

export default function ShoppingList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      const res = await shoppingAPI.getList();
      setList(res.data.shoppingList || []);
    } catch (err) {
      console.error('Failed to load shopping list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (itemId) => {
    // Optimistic update
    setList(prev => prev.map(item =>
      item._id === itemId ? { ...item, purchased: !item.purchased } : item
    ));
    try {
      const res = await shoppingAPI.toggleItem(itemId);
      setList(res.data.shoppingList);
    } catch (err) {
      console.error('Toggle error:', err);
      loadList(); // Revert
    }
  };

  const handleRemove = async (itemId) => {
    setList(prev => prev.filter(item => item._id !== itemId));
    try {
      const res = await shoppingAPI.removeItem(itemId);
      setList(res.data.shoppingList);
    } catch (err) {
      console.error('Remove error:', err);
      loadList();
    }
  };

  const handleClearPurchased = async () => {
    try {
      const res = await shoppingAPI.clearPurchased();
      setList(res.data.shoppingList);
    } catch (err) {
      console.error('Clear error:', err);
    }
  };

  // Group by category
  const grouped = list.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const purchasedCount = list.filter(i => i.purchased).length;
  const totalCount = list.length;

  if (loading) {
    return (
      <div className="shopping-page">
        <LoadingSpinner text="Loading shopping list..." />
      </div>
    );
  }

  return (
    <div className="shopping-page page-enter" id="shopping-page">
      <div className="shopping-header">
        <div>
          <h1>
            <ShoppingCart size={28} />
            Shopping List
          </h1>
          {totalCount > 0 && (
            <p className="shopping-subtitle">
              {purchasedCount} of {totalCount} items checked off
            </p>
          )}
        </div>
        {purchasedCount > 0 && (
          <button className="clear-btn" onClick={handleClearPurchased}>
            <Trash2 size={15} />
            Clear completed
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="progress-wrap">
          <div
            className="progress-fill"
            style={{ width: `${(purchasedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Stats Row */}
      {totalCount > 0 && (
        <div className="shopping-stats">
          <div className="stat-mini">
            <div className="stat-num">{totalCount}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-mini">
            <div className="stat-num">{purchasedCount}</div>
            <div className="stat-label">Done</div>
          </div>
          <div className="stat-mini">
            <div className="stat-num">{totalCount - purchasedCount}</div>
            <div className="stat-label">Remaining</div>
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="shopping-empty">
          <Package size={60} strokeWidth={1} />
          <h3>Your shopping list is empty</h3>
          <p>Browse a recipe and add missing ingredients to start building your list.</p>
        </div>
      ) : (
        <div className="category-groups">
          {Object.entries(grouped).map(([category, items]) => (
            <div className="category-group glass-card" key={category}>
              <h3 className="category-heading">
                <span className="cat-emoji">{CATEGORY_EMOJIS[category] || '📦'}</span>
                {category}
                <span className="cat-count">{items.length}</span>
              </h3>
              <div className="category-items">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className={`shop-item ${item.purchased ? 'checked' : ''}`}
                  >
                    <button
                      className={`checkbox ${item.purchased ? 'checked' : ''}`}
                      onClick={() => handleToggle(item._id)}
                      aria-label={item.purchased ? 'Uncheck' : 'Check'}
                    >
                      {item.purchased && <Check size={13} strokeWidth={3} />}
                    </button>
                    <div className="item-content">
                      <span className="item-name">{item.name}</span>
                      {item.recipeTitle && (
                        <span className="item-source">
                          <ChefHat size={11} /> {item.recipeTitle}
                        </span>
                      )}
                    </div>
                    <button
                      className="item-remove"
                      onClick={() => handleRemove(item._id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}