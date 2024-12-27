const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('./blacklist');

exports.authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (isTokenBlacklisted(token)) {
        return res.status(403).json({ message: 'Token has been blacklisted' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};
