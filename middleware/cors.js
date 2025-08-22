const cors = require('cors');

// CORS configuration for different environments
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Add your frontend domains here
        const allowedOrigins = [
            'http://localhost:3000',        // React dev server
            'http://localhost:3001',        // Alternative dev port
            'http://localhost:5173',        // Vite default
            'https://ummaticommunity.com',  // Your actual frontend domain
            'https://www.ummaticommunity.com' // With www if you use it
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'Cache-Control'
    ],
    exposedHeaders: [
        'Content-Length', 
        'X-Requested-With',
        'X-Total-Count',
        'X-Page-Count'
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Middleware to ensure CORS headers are set on all responses
const ensureCorsHeaders = (req, res, next) => {
    // Set CORS headers on all responses
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    next();
};

// CORS middleware for specific routes
const corsMiddleware = cors(corsOptions);

// Preflight handler for specific routes
const handlePreflight = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control');
        res.status(204).end();
        return;
    }
    next();
};

module.exports = {
    corsOptions,
    corsMiddleware,
    ensureCorsHeaders,
    handlePreflight
};
