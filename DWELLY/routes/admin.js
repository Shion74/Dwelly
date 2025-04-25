const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        const [admins] = await pool.query(
            'SELECT * FROM admins WHERE email = ?',
            [req.session.user.email]
        );

        if (admins.length === 0) {
            return res.status(403).render('error', {
                message: 'Access denied',
                error: {}
            });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Failed to verify admin status' });
    }
};

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
    try {
        // Get reported listings
        const [reportedListings] = await pool.query(`
            SELECT p.*, u.full_name as poster_name,
                   COUNT(DISTINCT r.report_id) as report_count,
                   GROUP_CONCAT(DISTINCT r.reason) as report_reasons
            FROM posts p
            JOIN reports r ON p.post_id = r.post_id
            JOIN users u ON p.user_id = u.user_id
            WHERE p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY report_count DESC
        `);

        // Get blocked users
        const [blockedUsers] = await pool.query(`
            SELECT u.*, d.name as department_name, c.name as course_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            WHERE u.is_blocked = true
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Dwelly',
            reportedListings,
            blockedUsers,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching admin data:', error);
        res.status(500).json({ error: 'Failed to fetch admin data' });
    }
});

// Flag a listing as scam
router.post('/listings/:id/flag', isAdmin, async (req, res) => {
    try {
        await pool.query(
            'UPDATE posts SET is_flagged = true WHERE post_id = ?',
            [req.params.id]
        );

        // Get the user who posted this listing
        const [posts] = await pool.query(
            'SELECT user_id FROM posts WHERE post_id = ?',
            [req.params.id]
        );

        if (posts.length > 0) {
            // Block the user
            await pool.query(
                'UPDATE users SET is_blocked = true WHERE user_id = ?',
                [posts[0].user_id]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error flagging listing:', error);
        res.status(500).json({ error: 'Failed to flag listing' });
    }
});

// Unblock a user
router.post('/users/:id/unblock', isAdmin, async (req, res) => {
    try {
        await pool.query(
            'UPDATE users SET is_blocked = false WHERE user_id = ?',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
});

// Get detailed report information
router.get('/reports/:id', isAdmin, async (req, res) => {
    try {
        const [reports] = await pool.query(`
            SELECT r.*, u.full_name as reporter_name,
                   p.*, pu.full_name as poster_name
            FROM reports r
            JOIN users u ON r.reporter_id = u.user_id
            JOIN posts p ON r.post_id = p.post_id
            JOIN users pu ON p.user_id = pu.user_id
            WHERE r.report_id = ?
        `, [req.params.id]);

        if (reports.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json(reports[0]);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

module.exports = router; 