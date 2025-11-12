// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token and attach user data to req.user
 */
const protect = (req, res, next) => {
    let token;

    // Check for token in the 'Authorization' header (Bearer Token format)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from 'Bearer <token>' string
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach decoded user payload to request object
            req.user = decoded; // { user_id, email, role, is_approved }

            next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed or expired.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

/**
 * Middleware to check if the authenticated user has one of the required roles.
 * @param {string[]} roles - Array of roles allowed (e.g., ['ADMIN', 'SECURITY'])
 */
const authorize = (roles = []) => {
    // If a single string is passed, convert it to an array
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) {
            // Should be caught by 'protect' middleware, but useful for safety
            return res.status(403).json({ message: 'Access denied. User data missing.' });
        }

        // 1. Check if user is approved (only applicable to Guardians and Primary)
        if (['PRIMARY', 'GUARDIAN'].includes(req.user.role) && !req.user.is_approved) {
             return res.status(403).json({ message: 'Access denied. Account is awaiting Admin approval.' });
        }

        // 2. Check if user role is in the allowed list
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Access denied. Requires role: ${roles.join(' or ')}.` });
        }

        next();
    };
};

module.exports = { protect, authorize };