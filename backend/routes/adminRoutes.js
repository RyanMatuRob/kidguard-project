// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { 
    getAllUsers, 
    approveUser, 
    createStudent, 
    getAllStudents 
} = require('../controllers/adminController');

// All routes in this file require ADMIN role
router.use(authorize('ADMIN'));

// User Management
router.get('/users', getAllUsers);
router.patch('/users/:userId/approve', approveUser);

// Student Management (CRUD)
router.post('/students', createStudent); // Includes photo upload middleware
router.get('/students', getAllStudents);

module.exports = router;