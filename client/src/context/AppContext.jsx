import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext(null);

const initialState = {
  ingredients: [],
  searchResults: [],
  searchTotal: 0,
  searchLoading: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_INGREDIENTS':
      return { ...state, ingredients: action.payload };
    case 'ADD_INGREDIENT':
      if (state.ingredients.find(i => i.toLowerCase() === action.payload.toLowerCase())) return state;
      return { ...state, ingredients: [...state.ingredients, action.payload] };
    case 'REMOVE_INGREDIENT':
      return { ...state, ingredients: state.ingredients.filter((_, i) => i !== action.payload) };
    case 'CLEAR_INGREDIENTS':
      return { ...state, ingredients: [] };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload.recipes, searchTotal: action.payload.total, searchLoading: false };
    case 'SET_SEARCH_LOADING':
      return { ...state, searchLoading: true };
    case 'CLEAR_SEARCH':
      return { ...state, searchResults: [], searchTotal: 0 };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
