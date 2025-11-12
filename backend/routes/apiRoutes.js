// backend/routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Import feature-specific routers
const adminRoutes = require('./adminRoutes');
const guardianRoutes = require('./guardianRoutes');
const pickupRoutes = require('./pickupRoutes');

// All routes defined here are protected by the JWT check
router.use(protect);

// Admin Management Routes (Requires ADMIN role)
router.use('/admin', adminRoutes);

// Guardian/Student Management Routes (Requires PRIMARY or ADMIN role)
router.use('/guardian', guardianRoutes);

// Pickup & Security Routes (Requires GUARDIAN or SECURITY role)
router.use('/pickup', pickupRoutes);

// Simple test route to verify token validation
router.get('/profile', (req, res) => {
    // req.user is attached by the 'protect' middleware
    res.json({
        message: `Welcome, ${req.user.role}! Your ID is ${req.user.user_id}.`,
        user: req.user
    });
});

module.exports = router;