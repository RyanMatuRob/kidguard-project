// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/db'); // Initialize DB pool
const path = require('path');
const multer = require('multer');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import Routes
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes'); // Master API router

// -----------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------

// CORS Configuration: Allows frontend origin to access the API
const corsOptions = {
    // In production, replace '*' with your actual frontend domain/IP
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Static file serving (for uploaded photos)
// Note: In a real production environment, you would use a dedicated cloud storage (Azure Blob)
// or Nginx to serve these, but for simplicity on a single VPS, we serve them via Express.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -----------------------------------------------------------------
// Routes
// -----------------------------------------------------------------

// Public Auth routes (e.g., registration, login)
app.use('/api/auth', authRoutes);

// Protected API routes (all main features)
app.use('/api', apiRoutes); 

// Default route for health check
app.get('/', (req, res) => {
    res.json({ message: 'KidGuard API is running!' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke on the server!', error: err.message });
});


// -----------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access endpoint: http://localhost:${PORT}`);
});