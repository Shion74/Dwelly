const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Get user profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        // Fetch user data with additional information
        const [userData] = await pool.query(`
            SELECT u.*, 
                   d.name as department_name,
                   c.name as course_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            WHERE u.user_id = ?
        `, [req.session.user.id]);

        if (userData.length === 0) {
            return res.status(404).render('error', {
                title: '404 - User Not Found',
                message: 'User profile not found'
            });
        }

        const user = userData[0];

        // Fetch user's listings count
        const [listingsCount] = await pool.query(
            'SELECT COUNT(*) as count FROM posts WHERE user_id = ?',
            [req.session.user.id]
        );

        // Fetch user's favorites count
        const [favoritesCount] = await pool.query(
            'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
            [req.session.user.id]
        );

        // Get success message from session and clear it
        const success = req.query.success;
        delete req.query.success;

        res.render('users/profile', {
            title: 'My Profile - Dwelly',
            user: req.session.user,
            profileData: user,
            listingsCount: listingsCount[0].count,
            favoritesCount: favoritesCount[0].count,
            success
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading profile'
        });
    }
});

// Get edit profile page
router.get('/edit-profile', isAuthenticated, async (req, res) => {
    try {
        // Fetch user data
        const [userData] = await pool.query(`
            SELECT u.*, 
                   d.name as department_name,
                   c.name as course_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            WHERE u.user_id = ?
        `, [req.session.user.id]);

        if (userData.length === 0) {
            return res.status(404).render('error', {
                title: '404 - User Not Found',
                message: 'User profile not found'
            });
        }

        const user = userData[0];

        // Fetch departments and courses for student users
        let departments = [];
        let courses = [];
        if (user.role === 'student') {
            [departments] = await pool.query('SELECT * FROM departments ORDER BY name');
            [courses] = await pool.query('SELECT course_id, name, department_id FROM courses ORDER BY name');
        }

        res.render('users/edit-profile', {
            title: 'Edit Profile - Dwelly',
            user: req.session.user,
            profileData: user,
            departments,
            courses,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error fetching edit profile page:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading edit profile page'
        });
    }
});

// Update user profile
router.post('/profile', isAuthenticated, async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone_number,
            id_number,
            year_level,
            department_id,
            course_id
        } = req.body;

        // Validate required fields
        if (!full_name || !email) {
            return res.redirect('/users/edit-profile?error=Full name and email are required');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.redirect('/users/edit-profile?error=Invalid email format');
        }

        // Check if email is already taken by another user
        const [existingUser] = await pool.query(
            'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
            [email, req.session.user.id]
        );

        if (existingUser.length > 0) {
            return res.redirect('/users/edit-profile?error=Email is already taken');
        }

        // Update user profile
        await pool.query(
            `UPDATE users 
             SET full_name = ?,
                 email = ?,
                 phone_number = ?,
                 id_number = ?,
                 year_level = ?,
                 department_id = ?,
                 course_id = ?
             WHERE user_id = ?`,
            [
                full_name,
                email,
                phone_number || null,
                id_number || null,
                year_level || null,
                department_id || null,
                course_id || null,
                req.session.user.id
            ]
        );

        // Update session user data
        req.session.user = {
            ...req.session.user,
            full_name,
            email
        };

        // Redirect with success message
        res.redirect('/users/profile?success=Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/users/edit-profile?error=Failed to update profile. Please try again.');
    }
});

// Get user's listings
router.get('/listings', isAuthenticated, async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT p.*, 
                   GROUP_CONCAT(ph.file_path) as photos,
                   COUNT(DISTINCT f.user_id) as favorite_count,
                   AVG(r.stars) as average_rating,
                   COUNT(DISTINCT r.rating_id) as rating_count
            FROM posts p
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN ratings r ON p.post_id = r.post_id
            WHERE p.user_id = ?
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `, [req.session.user.id]);

        res.render('users/listings', {
            title: 'My Listings - Dwelly',
            listings: listings.map(listing => ({
                ...listing,
                photos: listing.photos ? listing.photos.split(',').map(photo => `/uploads/listings/${photo}`) : []
            })),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching user listings:', error);
        res.status(500).json({ error: 'Failed to fetch user listings' });
    }
});

// Get user's favorites
router.get('/favorites', isAuthenticated, async (req, res) => {
    try {
        const [favorites] = await pool.query(`
            SELECT p.*, u.full_name as poster_name,
                   GROUP_CONCAT(ph.file_path) as photos,
                   COUNT(DISTINCT f2.user_id) as favorite_count,
                   AVG(r.stars) as average_rating,
                   COUNT(DISTINCT r.rating_id) as rating_count
            FROM favorites f
            JOIN posts p ON f.post_id = p.post_id
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f2 ON p.post_id = f2.post_id
            LEFT JOIN ratings r ON p.post_id = r.post_id
            WHERE f.user_id = ? AND p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY f.created_at DESC
        `, [req.session.user.id]);

        res.render('users/favorites', {
            title: 'My Favorites - Dwelly',
            favorites: favorites.map(favorite => ({
                ...favorite,
                photos: favorite.photos ? favorite.photos.split(',') : []
            })),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// Get user's ratings
router.get('/ratings', isAuthenticated, async (req, res) => {
    try {
        const [ratings] = await pool.query(`
            SELECT r.*, p.*, u.full_name as poster_name,
                   GROUP_CONCAT(ph.file_path) as photos
            FROM ratings r
            JOIN posts p ON r.post_id = p.post_id
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            WHERE r.user_id = ? AND p.is_flagged = false
            GROUP BY r.rating_id
            ORDER BY r.created_at DESC
        `, [req.session.user.id]);

        res.render('users/ratings', {
            title: 'My Ratings - Dwelly',
            ratings: ratings.map(rating => ({
                ...rating,
                photos: rating.photos ? rating.photos.split(',') : []
            })),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

module.exports = router; 