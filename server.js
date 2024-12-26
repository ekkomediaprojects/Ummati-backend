require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

// Initialize Express
const app = express();

// Middleware
app.use(helmet()); // Adds security headers
app.use(cors()); // Enables CORS
app.use(express.json()); // Parses JSON requests


// Import Routes
const userRoutes = require('./routes/users.js');
const authRoutes = require('./routes/auth.js');

// Use Routes
app.use('/users', userRoutes);
app.use('/auth', authRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((error) => console.error('Database connection error:', error));

// Default Route
app.get('/', (req, res) => {
    res.send('Welcome to the Ummatti Backend!');
});

// Catch-All Route
app.all('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
