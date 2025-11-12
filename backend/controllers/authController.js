// backend/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Helper function to generate JWT
const generateToken = (user) => {
    return jwt.sign(
        { 
            user_id: user.user_id, 
            email: user.email, 
            role: user.role, 
            is_approved: user.is_approved 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Token expires in 30 days
    );
};

// ------------------------------------------------
// 1. ADMIN SEEDING: Run once to create the initial admin account
// ------------------------------------------------
const seedAdmin = async (req, res) => {
    try {
        const [existingAdmins] = await pool.query("SELECT COUNT(*) as count FROM Users WHERE role = 'ADMIN'");
        if (existingAdmins[0].count > 0) {
            return res.status(400).json({ message: 'Admin user already exists. Cannot seed again.' });
        }

        const adminEmail = 'admin@kidguard.com';
        const adminPassword = 'AdminSecurePassword123'; // CHANGE THIS IMMEDIATELY AFTER CREATION
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const [result] = await pool.query(
            `INSERT INTO Users (email, password_hash, role, first_name, last_name, is_approved)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminEmail, hashedPassword, 'ADMIN', 'System', 'Admin', 1]
        );

        res.status(201).json({ 
            message: 'Initial ADMIN user created successfully.',
            email: adminEmail,
            tempPassword: adminPassword,
            warning: '!!! CHANGE THIS PASSWORD IMMEDIATELY !!!'
        });
    } catch (error) {
        console.error('Error seeding admin:', error);
        res.status(500).json({ message: 'Server error during admin seeding.' });
    }
};


// ------------------------------------------------
// 2. REGISTER USER (Primary Guardian, Guardian, Security)
// ------------------------------------------------
const registerUser = async (req, res) => {
    const { email, password, role, firstName, lastName, phone } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
        return res.status(400).json({ message: 'Please enter all required fields.' });
    }

    if (!['PRIMARY', 'GUARDIAN', 'SECURITY'].includes(role.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    try {
        // Check if user already exists
        const [existingUser] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Security personnel are auto-approved for simplicity, others need admin approval
        const isApproved = role === 'SECURITY' ? 1 : 0; 
        
        const [result] = await pool.query(
            `INSERT INTO Users (email, password_hash, role, first_name, last_name, phone, is_approved)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, role.toUpperCase(), firstName, lastName, phone || null, isApproved]
        );

        // Get the newly created user for token generation
        const [newUser] = await pool.query('SELECT user_id, email, role, is_approved FROM Users WHERE user_id = ?', [result.insertId]);
        
        const token = generateToken(newUser[0]);

        res.status(201).json({
            user: newUser[0],
            token: token,
            message: isApproved ? 'Registration successful. Welcome!' : 'Registration successful. Awaiting Admin approval.'
        });

    } catch (error) {
        console.error('Error registering user:', error);
        // Catch duplicate entry error for phone number
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Phone number is already registered.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// ------------------------------------------------
// 3. LOGIN USER
// ------------------------------------------------
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter email and password.' });
    }

    try {
        const [userRows] = await pool.query('SELECT user_id, email, password_hash, role, is_approved FROM Users WHERE email = ?', [email]);
        const user = userRows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Compare submitted password with stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            // Check if user is approved (Admin and Security are auto-approved)
            if (user.role !== 'ADMIN' && user.role !== 'SECURITY' && !user.is_approved) {
                return res.status(403).json({ message: 'Account is awaiting Admin approval.' });
            }

            const token = generateToken(user);
            
            res.status(200).json({
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    role: user.role,
                    is_approved: user.is_approved
                },
                token: token,
                message: `Login successful. Welcome ${user.role}!`
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

module.exports = {
    seedAdmin,
    registerUser,
    loginUser,
};