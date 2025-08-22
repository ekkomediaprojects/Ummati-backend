const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { corsMiddleware, ensureCorsHeaders } = require('./middleware/cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');
const paymentRoutes = require('./routes/payments');
const { authenticateJWT } = require('./middleware/auth');

// Load environment variables
dotenv.config();

const app = express();

// Apply CORS middleware
app.use(corsMiddleware);

// Handle preflight requests globally
app.options('*', corsMiddleware);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure CORS headers on all responses
app.use(ensureCorsHeaders);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/events', authenticateJWT, eventRoutes);
app.use('/api/admin', authenticateJWT, adminRoutes);
app.use('/api/stripe', authenticateJWT, stripeRoutes);
app.use('/api/payments', authenticateJWT, paymentRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl
    });
});

// Enhanced error handling middleware with CORS headers
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    
    // Set CORS headers on error responses
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control');
    
    // Handle CORS errors specifically
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS Error: Origin not allowed',
            error: 'CORS policy violation'
        });
    }
    
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: 'Authentication failed'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired',
            error: 'Please login again'
        });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            error: err.message,
            details: err.errors
        });
    }
    
    // Handle MongoDB errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        return res.status(500).json({
            success: false,
            message: 'Database Error',
            error: 'Internal server error'
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.stack : 'Internal server error'
    });
});

const PORT = process.env.PORT || 5002;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('CORS enabled with enhanced configuration');
    });
}

module.exports = app; 