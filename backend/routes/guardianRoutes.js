// backend/routes/guardianRoutes.js
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { linkGuardianToStudent, getMyStudents } = require('../controllers/adminController'); // Reusing controller functions

// Routes that require either ADMIN or PRIMARY role for management
router.post('/link-guardian', authorize(['PRIMARY', 'ADMIN']), linkGuardianToStudent);

// Routes for all Guardians (including PRIMARY)
router.get('/my-students', authorize(['PRIMARY', 'GUARDIAN', 'ADMIN']), getMyStudents);

module.exports = router;