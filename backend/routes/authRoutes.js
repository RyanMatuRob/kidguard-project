// backend/routes/authRoutes.js
const express = require('express');
const { seedAdmin, registerUser, loginUser } = require('../controllers/authController');
const router = express.Router();

// Public Routes
router.post('/seed-admin', seedAdmin);  // *** IMPORTANT: Run this once to create the initial admin ***
router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;