// backend/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration for your local MySQL server on the VPS
const pool = mysql.createPool({
    host: process.env.DB_HOST,       // localhost since it's on the VPS
    user: process.env.DB_USER,       // kidguard_user
    password: process.env.DB_PASSWORD, // SecurePasswordForApp
    database: process.env.DB_NAME,   // kidguard
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log(`[DB] Connecting to MySQL at ${process.env.DB_HOST}...`);

// Test connection and exit process if failed
pool.getConnection()
    .then(connection => {
        console.log("[DB] Connection pool established successfully.");
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error("[DB ERROR] Could not connect to MySQL! Exiting process.");
        console.error(err);
        process.exit(1);
    });

module.exports = pool;