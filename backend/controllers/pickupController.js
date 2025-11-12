// backend/controllers/pickupController.js
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const QR_EXPIRATION_MINUTES = 5;

// ------------------------------------------------
// GUARDIAN/PRIMARY: Generate Pickup QR Token
// ------------------------------------------------
const generatePickupQr = async (req, res) => {
    const guardianId = req.user.user_id;
    const { studentId } = req.body;

    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required to generate a pickup code.' });
    }

    try {
        // 1. Verify the current user is an approved guardian for this student
        const [guardianship] = await pool.query(
            'SELECT * FROM Guardianship WHERE user_id = ? AND student_id = ?',
            [guardianId, studentId]
        );

        if (guardianship.length === 0) {
            return res.status(403).json({ message: 'You are not authorized to pick up this student.' });
        }

        // 2. Check if there is an active (GENERATED) session for this guardian/student pair
        const [activeSessions] = await pool.query(
            'SELECT * FROM PickupSessions WHERE guardian_id = ? AND student_id = ? AND status = ?',
            [guardianId, studentId, 'GENERATED']
        );

        // If an active session exists and is not expired, return it instead of creating a new one
        if (activeSessions.length > 0) {
            const activeSession = activeSessions[0];
            const now = new Date();
            if (activeSession.expires_at > now) {
                return res.status(200).json({
                    message: 'Active pickup session found. Reusing token.',
                    qr_token: activeSession.qr_token,
                    expires_at: activeSession.expires_at,
                });
            }
        }

        // 3. Generate new QR Token and set expiration
        const qrToken = uuidv4();
        const expirationTime = new Date(Date.now() + QR_EXPIRATION_MINUTES * 60 * 1000); // 5 minutes from now

        const [result] = await pool.query(
            `INSERT INTO PickupSessions (guardian_id, student_id, qr_token, expires_at, status)
             VALUES (?, ?, ?, ?, ?)`,
            [guardianId, studentId, qrToken, expirationTime, 'GENERATED']
        );

        res.status(201).json({
            message: 'New pickup session generated.',
            session_id: result.insertId,
            qr_token: qrToken,
            expires_at: expirationTime,
            validity_minutes: QR_EXPIRATION_MINUTES
        });

    } catch (error) {
        console.error('Error generating QR token:', error);
        res.status(500).json({ message: 'Server error during QR generation.' });
    }
};

// ------------------------------------------------
// SECURITY: Verify Pickup QR Token
// ------------------------------------------------
const verifyPickupQr = async (req, res) => {
    const securityUserId = req.user.user_id;
    const { qrToken, pickupNotes } = req.body;

    if (!qrToken) {
        return res.status(400).json({ message: 'QR token is required for verification.' });
    }

    try {
        // 1. Find the session linked to the token
        const [sessions] = await pool.query(
            `SELECT PS.*, U.first_name AS guardian_first, U.last_name AS guardian_last, U.phone AS guardian_phone,
                    S.first_name AS student_first, S.last_name AS student_last, S.grade
             FROM PickupSessions AS PS
             JOIN Users AS U ON PS.guardian_id = U.user_id
             JOIN Students AS S ON PS.student_id = S.student_id
             WHERE PS.qr_token = ?`,
            [qrToken]
        );
        const session = sessions[0];

        if (!session) {
            return res.status(404).json({ message: 'Invalid QR token provided.' });
        }
        
        // 2. Check token status and expiration
        const now = new Date();
        const expirationDate = new Date(session.expires_at);

        if (session.status === 'VERIFIED') {
            return res.status(400).json({ message: 'QR token already verified for this pickup session.', log: session.log });
        }
        if (session.status === 'EXPIRED' || expirationDate < now) {
            // Update status to EXPIRED if past expiration but not marked
            if (session.status === 'GENERATED') {
                await pool.query('UPDATE PickupSessions SET status = ? WHERE session_id = ?', ['EXPIRED', session.session_id]);
            }
            return res.status(400).json({ message: 'QR token has expired or is invalid.' });
        }

        // 3. Verification Successful: Log the pickup and update session status
        const [logResult] = await pool.query(
            `INSERT INTO PickupLogs (session_id, security_user_id, verified_at, pickup_notes)
             VALUES (?, ?, ?, ?)`,
            [session.session_id, securityUserId, now, pickupNotes || null]
        );
        
        await pool.query(
            'UPDATE PickupSessions SET status = ? WHERE session_id = ?',
            ['VERIFIED', session.session_id]
        );

        res.status(200).json({
            message: 'Pickup authorized and logged successfully.',
            log_id: logResult.insertId,
            student: { name: `${session.student_first} ${session.student_last}`, grade: session.grade },
            guardian: { name: `${session.guardian_first} ${session.guardian_last}`, phone: session.guardian_phone },
            verified_by: req.user.email
        });

    } catch (error) {
        console.error('Error verifying QR token:', error);
        res.status(500).json({ message: 'Server error during verification.' });
    }
};

// ------------------------------------------------
// LOGGING: Get Pickup History (Admin/Security)
// ------------------------------------------------
const getPickupHistory = async (req, res) => {
    const { role } = req.user;
    
    // Simple logic to fetch all logs, but you could add filters (date, studentId) here
    try {
        const [logs] = await pool.query(
            `SELECT
                PL.verified_at, PL.pickup_notes, 
                S.first_name AS student_first, S.last_name AS student_last, S.grade,
                U_guardian.first_name AS guardian_first, U_guardian.last_name AS guardian_last, 
                U_security.first_name AS security_first, U_security.last_name AS security_last, U_security.email AS security_email
             FROM PickupLogs AS PL
             JOIN PickupSessions AS PS ON PL.session_id = PS.session_id
             JOIN Students AS S ON PS.student_id = S.student_id
             JOIN Users AS U_guardian ON PS.guardian_id = U_guardian.user_id
             JOIN Users AS U_security ON PL.security_user_id = U_security.user_id
             ORDER BY PL.verified_at DESC`
        );
        res.status(200).json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching pickup history.' });
    }
};

module.exports = {
    generatePickupQr,
    verifyPickupQr,
    getPickupHistory,
};