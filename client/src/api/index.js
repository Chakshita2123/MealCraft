import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mealcraft_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Recipes API
export const recipesAPI = {
  // POST /api/recipes/find — primary ingredient-based search
  find: (ingredients, vegetarian = false) =>
    api.post('/recipes/find', { ingredients, vegetarian }), // ← vegetarian added

  // GET /api/recipes/search — filtered search with cuisine/diet
  search: (params) => api.get('/recipes/search', { params }),

  // GET /api/recipes/search-by-name — search by recipe name
  searchByName: (params) => api.get('/recipes/search-by-name', { params }),

  // GET /api/recipes/:id — recipe detail
  getById: (id, userIngredients) =>
    api.get(`/recipes/${id}`, { params: { userIngredients } }),

  // POST /api/recipes/save — bookmark a recipe
  save: (recipe) => api.post('/recipes/save', { recipe }),

  // DELETE /api/recipes/unsave/:id — remove bookmark
  unsave: (id) => api.delete(`/recipes/unsave/${id}`),

  // GET /api/recipes/saved/all — get all saved recipes
  getSaved: () => api.get('/recipes/saved/all'),
};

// Ingredients API
export const ingredientsAPI = {
  detect: (image, mimeType) =>
    api.post('/ingredients/detect', { image, mimeType }),
};

// Shopping API
export const shoppingAPI = {
  getList: () => api.get('/shopping'),
  addItems: (items) => api.post('/shopping/add', { items }),
  toggleItem: (itemId) => api.put(`/shopping/toggle/${itemId}`),
  removeItem: (itemId) => api.delete(`/shopping/remove/${itemId}`),
  clearPurchased: () => api.delete('/shopping/clear-purchased'),
};

// Meal Plan API
export const mealplanAPI = {
  get: () => api.get('/mealplan'),
  add: (day, slot, recipe) => api.post('/mealplan/add', { day, slot, recipe }),
  remove: (day, slot) => api.delete('/mealplan/remove', { data: { day, slot } }),
  getSuggestions: (slot) => api.get('/mealplan/suggestions', { params: { slot } }),
  generateShopping: () => api.post('/mealplan/generate-shopping'),
};

// Nutrition API
export const nutritionAPI = {
  getToday: () => api.get('/nutrition/today'),
  log: (data) => api.post('/nutrition/log', data),
  remove: (mealId) => api.delete('/nutrition/remove', { data: { mealId } }),
  getWeekly: () => api.get('/nutrition/weekly'),
  search: (q) => api.get('/nutrition/search', { params: { q } }),
};

export default api;