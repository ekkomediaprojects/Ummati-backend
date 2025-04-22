const jwt = require('jsonwebtoken');
const User = require('../models/Users');
const { isTokenBlacklisted } = require('./blacklist');

const authenticateJWT = async (req, res, next) => {
    console.log('\n=== AUTHENTICATION MIDDLEWARE START ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Full request URL:', req.originalUrl);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    try {
        console.log('\n1. Extracting token from Authorization header...');
        const authHeader = req.header('Authorization');
        console.log('Authorization header:', authHeader);
        
        if (!authHeader) {
            console.log('❌ No Authorization header found');
            return res.status(401).json({ message: 'No token provided' });
        }

        console.log('\n2. Checking token format...');
        const token = authHeader.split(' ')[1];
        console.log('Token extracted:', token ? 'Token present' : 'No token found');
        
        if (!token) {
            console.log('❌ Token not found in Authorization header');
            return res.status(401).json({ message: 'No token provided' });
        }

        console.log('\n3. Checking if token is blacklisted...');
        const isBlacklisted = await isTokenBlacklisted(token);
        console.log('Token blacklist status:', isBlacklisted ? 'Blacklisted' : 'Not blacklisted');
        
        if (isBlacklisted) {
            console.log('❌ Token is blacklisted');
            return res.status(401).json({ message: 'Token has been invalidated' });
        }

        console.log('\n4. Verifying JWT token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', {
            id: decoded.id,
            iat: decoded.iat,
            exp: decoded.exp
        });

        console.log('\n5. Fetching user from database...');
        const user = await User.findById(decoded.id);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('❌ User not found in database');
            return res.status(401).json({ message: 'User not found' });
        }

        console.log('\n6. Attaching user to request...');
        req.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture
        };
        console.log('User attached to request:', {
            id: req.user.id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email
        });

        console.log('\n=== AUTHENTICATION MIDDLEWARE END ===\n');
        next();
    } catch (error) {
        console.error('\n❌ Authentication error:', error);
        console.error('Error stack:', error.stack);
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
