// backend/controllers/adminController.js
const pool = require('../config/db');
const { authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- File Upload Setup for Profile Photos ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the 'uploads' directory exists
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use user ID or a UUID and maintain original extension
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage }).single('photo');


// ------------------------------------------------
// ADMIN: Manage Users
// ------------------------------------------------

/**
 * Get all users for Admin dashboard
 */
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT user_id, email, role, first_name, last_name, phone, photo_url, is_approved, created_at 
             FROM Users 
             ORDER BY created_at DESC`
        );
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving users.' });
    }
};

/**
 * Admin approves a Primary Guardian or Guardian
 */
const approveUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const [result] = await pool.query(
            'UPDATE Users SET is_approved = 1 WHERE user_id = ? AND role IN (?, ?)',
            [userId, 'PRIMARY', 'GUARDIAN']
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or role cannot be approved.' });
        }
        res.status(200).json({ message: `User ID ${userId} approved successfully.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error approving user.' });
    }
};

// ------------------------------------------------
// ADMIN: Manage Students (CRUD)
// ------------------------------------------------

/**
 * Admin creates a new student profile
 */
const createStudent = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Upload Error:', err);
            return res.status(500).json({ message: 'File upload failed.' });
        }

        const { schoolIdTag, firstName, lastName, grade } = req.body;
        const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

        if (!schoolIdTag || !firstName || !lastName || !grade) {
            // Clean up file if validation fails
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Missing required student fields.' });
        }

        try {
            const [result] = await pool.query(
                `INSERT INTO Students (school_id_tag, first_name, last_name, grade, photo_url)
                 VALUES (?, ?, ?, ?, ?)`,
                [schoolIdTag, firstName, lastName, grade, photo_url]
            );
            res.status(201).json({ 
                message: 'Student created successfully.', 
                studentId: result.insertId,
                photo_url: photo_url 
            });
        } catch (error) {
            console.error(error);
            // Catch duplicate school ID error
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Student ID tag already exists.' });
            }
            // Clean up file on database error
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: 'Error creating student.' });
        }
    });
};

/**
 * Get all students for Admin/Primary Guardian view
 */
const getAllStudents = async (req, res) => {
    try {
        const [students] = await pool.query('SELECT * FROM Students ORDER BY last_name');
        res.status(200).json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving students.' });
    }
};


// ------------------------------------------------
// PRIMARY GUARDIAN: Link/Unlink Guardianship
// ------------------------------------------------

/**
 * Primary Guardian links another user (Primary/Guardian) to a student
 * Note: Only Primary Guardians can add/link other guardians.
 */
const linkGuardianToStudent = async (req, res) => {
    const primaryUserId = req.user.user_id; // Current authenticated user (must be PRIMARY)
    const { studentId, guardianEmail, isPrimary = false } = req.body;

    if (!studentId || !guardianEmail) {
        return res.status(400).json({ message: 'Missing student ID or guardian email.' });
    }

    try {
        // 1. Verify target user exists and is a Guardian/Primary/Admin
        const [targetUserRows] = await pool.query(
            'SELECT user_id, role, is_approved FROM Users WHERE email = ?',
            [guardianEmail]
        );
        const targetUser = targetUserRows[0];

        if (!targetUser || !['PRIMARY', 'GUARDIAN', 'ADMIN'].includes(targetUser.role)) {
            return res.status(404).json({ message: 'Target user not found or has an incompatible role.' });
        }
        
        // 2. Check if the current user (Primary Guardian) is authorized to manage this student
        const [authCheck] = await pool.query(
            'SELECT * FROM Guardianship WHERE user_id = ? AND student_id = ? AND is_primary = 1',
            [primaryUserId, studentId]
        );

        if (authCheck.length === 0) {
            return res.status(403).json({ message: 'Access denied. You are not the primary guardian for this student.' });
        }

        // 3. Perform the linking (ON DUPLICATE KEY UPDATE handles existing links)
        const [result] = await pool.query(
            `INSERT INTO Guardianship (user_id, student_id, is_primary, linked_by_user_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)`,
            [targetUser.user_id, studentId, isPrimary ? 1 : 0, primaryUserId]
        );

        res.status(200).json({ 
            message: `Guardian ${targetUser.user_id} successfully linked to student ${studentId}.`,
            isPrimary: isPrimary 
        });

    } catch (error) {
        console.error('Error linking guardian:', error);
        res.status(500).json({ message: 'Server error during linking.' });
    }
};

/**
 * Guardian or Primary Guardian retrieves their linked students
 */
const getMyStudents = async (req, res) => {
    const userId = req.user.user_id;
    try {
        const [students] = await pool.query(
            `SELECT 
                S.student_id, S.school_id_tag, S.first_name, S.last_name, S.grade, S.photo_url,
                G.is_primary, U_linker.first_name AS linker_first_name, U_linker.last_name AS linker_last_name
             FROM Guardianship AS G
             JOIN Students AS S ON G.student_id = S.student_id
             JOIN Users AS U_linker ON G.linked_by_user_id = U_linker.user_id
             WHERE G.user_id = ?
             ORDER BY S.last_name`,
            [userId]
        );
        res.status(200).json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching linked students.' });
    }
};


module.exports = {
    // Admin Routes
    getAllUsers,
    approveUser,
    createStudent,
    getAllStudents,
    // Guardian/Primary Routes
    linkGuardianToStudent,
    getMyStudents,
    upload
};