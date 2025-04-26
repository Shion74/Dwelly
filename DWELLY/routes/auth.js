const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

// Register page
router.get('/register', async (req, res) => {
    try {
        // Fetch departments and courses
        const [departments] = await pool.query('SELECT * FROM departments ORDER BY name');
        const [courses] = await pool.query('SELECT * FROM courses ORDER BY name');

        res.render('auth/register', { 
            title: 'Register - Dwelly',
            user: req.session.user,
            departments,
            courses
        });
    } catch (error) {
        console.error('Error fetching registration data:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading registration page'
        });
    }
});

// Register handler
router.post('/register', async (req, res) => {
    try {
        const { full_name, id_number, role, year_level, department_id, course_id, email, password, phone_number } = req.body;

        // Check if user already exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR id_number = ?',
            [email, id_number]
        );

        if (existingUsers.length > 0) {
            req.flash('error', 'User already exists');
            return res.redirect('/auth/register');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await pool.query(
            `INSERT INTO users (full_name, id_number, role, year_level, department_id, course_id, email, password, phone_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [full_name, id_number, role, year_level || null, department_id || null, course_id || null, email, hashedPassword, phone_number]
        );

        req.flash('success', 'Registration successful! Please login.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/register');
    }
});

// Login page
router.get('/login', (req, res) => {
    // If user is already logged in, redirect to home
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { 
        title: 'Login - Dwelly',
        user: req.session.user 
    });
});

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            req.flash('error', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        const user = users[0];

        // Check if user is blocked
        if (user.is_blocked) {
            req.flash('error', 'Account has been blocked');
            return res.redirect('/auth/login');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            req.flash('error', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        // Set session
        req.session.user = {
            id: user.user_id,
            full_name: user.full_name,
            role: user.role,
            email: user.email
        };

        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/login');
    }
});

// Logout handler
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router; 