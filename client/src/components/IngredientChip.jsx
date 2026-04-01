import { X } from 'lucide-react';
import './IngredientChip.css';

export default function IngredientChip({ name, onRemove, delay = 0 }) {
  return (
    <span className="ingredient-chip" style={{ animationDelay: `${delay * 0.08}s` }}>
      <span className="chip-text">{name}</span>
      {onRemove && (
        <button className="chip-remove" onClick={onRemove} aria-label={`Remove ${name}`}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}
