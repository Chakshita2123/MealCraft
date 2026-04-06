const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// CORS
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:3000', 'https://meal-craft-nu.vercel.app'],
  credentials: true
}));

// Body parser — 50MB limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/shopping', require('./routes/shopping'));
app.use('/api/mealplan', require('./routes/mealplan'));
app.use('/api/nutrition', require('./routes/nutrition'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 MealCraft server running on port ${PORT}`);
});
