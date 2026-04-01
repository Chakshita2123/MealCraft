import { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: localStorage.getItem('mealcraft_token'),
  loading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, loading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, user: action.payload.user, token: action.payload.token, loading: false, error: null };
    case 'AUTH_ERROR':
      return { ...state, user: null, token: null, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, user: null, token: null, loading: false, error: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (!state.token) {
        dispatch({ type: 'AUTH_ERROR', payload: null });
        return;
      }
      try {
        const res = await authAPI.getMe();
        dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data.user, token: state.token } });
      } catch {
        localStorage.removeItem('mealcraft_token');
        dispatch({ type: 'AUTH_ERROR', payload: null });
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const res = await authAPI.login({ email, password });
      localStorage.setItem('mealcraft_token', res.data.token);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data.user, token: res.data.token } });
      return true;
    } catch (err) {
      dispatch({ type: 'AUTH_ERROR', payload: err.response?.data?.message || 'Login failed' });
      return false;
    }
  };

  const register = async (name, email, password) => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const res = await authAPI.register({ name, email, password });
      localStorage.setItem('mealcraft_token', res.data.token);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data.user, token: res.data.token } });
      return true;
    } catch (err) {
      dispatch({ type: 'AUTH_ERROR', payload: err.response?.data?.message || 'Registration failed' });
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('mealcraft_token');
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
