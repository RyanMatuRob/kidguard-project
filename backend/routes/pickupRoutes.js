// backend/routes/pickupRoutes.js
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { generatePickupQr, verifyPickupQr, getPickupHistory } = require('../controllers/pickupController');

// ----------------------------------------------------
// GUARDIAN/PRIMARY: Generate QR Code for Pickup
// ----------------------------------------------------
router.post('/generate-qr', authorize(['PRIMARY', 'GUARDIAN']), generatePickupQr);

// ----------------------------------------------------
// SECURITY: Scan and Verify QR Code
// ----------------------------------------------------
router.post('/verify-qr', authorize('SECURITY'), verifyPickupQr);

// ----------------------------------------------------
// ADMIN/SECURITY: View History
// ----------------------------------------------------
router.get('/history', authorize(['ADMIN', 'SECURITY']), getPickupHistory);

module.exports = router;