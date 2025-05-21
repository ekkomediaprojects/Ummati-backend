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
            return res.status(401).json({ message: 'No token provided' });
        }

        console.log('Checking if token is blacklisted...');
        const isBlacklisted = await isTokenBlacklisted(token);
        if (isBlacklisted) {
            console.log('Token is blacklisted');
            return res.status(401).json({ message: 'Token has been invalidated' });
        }

        console.log('Verifying JWT token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', {
            id: decoded.id,
            iat: decoded.iat,
            exp: decoded.exp
        });

        console.log('Fetching user from database...');
        const user = await User.findById(decoded.id);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found in database');
            return res.status(401).json({ message: 'User not found' });
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { authenticateJWT };
