const jwt = require('jsonwebtoken');
const User = require('../models/Users');
const { isTokenBlacklisted } = require('./blacklist');

const authenticateJWT = async (req, res, next) => {
    console.log('Processing authentication request:', {
        method: req.method,
        path: req.path,
        url: req.originalUrl
    });

    try {
        const token = req.header('Authorization')?.split(' ')[1];
        console.log('Token extracted:', token ? 'Token present' : 'No token found');
        
        if (!token) {
            console.log('No token found in Authorization header');
            return res.status(401).json({ 
                success: false,
                message: 'No token provided',
                error: 'Authentication required'
            });
        }

        console.log('Checking if token is blacklisted...');
        const isBlacklisted = await isTokenBlacklisted(token);
        if (isBlacklisted) {
            console.log('Token is blacklisted');
            return res.status(401).json({ 
                success: false,
                message: 'Token has been invalidated',
                error: 'Please login again'
            });
        }

        console.log('Verifying JWT token...');
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired',
                    error: 'Please login again to continue'
                });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token',
                    error: 'Authentication failed'
                });
            }
            throw error;
        }

        console.log('Fetching user from database...');
        const user = await User.findById(decoded?.id);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found in database');
            return res.status(401).json({ 
                success: false,
                message: 'User not found',
                error: 'Account may have been deleted'
            });
        }

        // Check if user account is active
        if (user.status === 'inactive' || user.isDeleted) {
            return res.status(401).json({
                success: false,
                message: 'Account is inactive',
                error: 'Please contact support'
            });
        }

        console.log('Attaching user to request:', {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        });
        
        req.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture,
            role: user.role
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token',
                error: 'Authentication failed'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expired',
                error: 'Please login again to continue'
            });
        }
        
        // Handle database errors
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            return res.status(500).json({ 
                success: false,
                message: 'Database error',
                error: 'Internal server error'
            });
        }
        
        // Generic error
        return res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: 'Internal server error'
        });
    }
};

module.exports = { authenticateJWT };
