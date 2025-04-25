const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Home page route - show listings
router.get('/', async (req, res) => {
    try {
        // Fetch all listings with user information
        const [listings] = await pool.query(`
            SELECT p.*, u.full_name as owner_name, 
                   (SELECT COUNT(*) FROM favorites WHERE post_id = p.post_id) as favorite_count,
                   (SELECT AVG(stars) FROM ratings WHERE post_id = p.post_id) as average_rating
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            WHERE p.is_flagged = false
            ORDER BY p.created_at DESC
        `);

        // Get user's favorites if logged in
        let userFavorites = [];
        if (req.session.user) {
            const [favorites] = await pool.query(
                'SELECT post_id FROM favorites WHERE user_id = ?',
                [req.session.user.id]
            );
            userFavorites = favorites.map(f => f.post_id);
        }

        res.render('index', { 
            title: 'Dwelly - Student Housing Listings',
            user: req.session.user,
            listings,
            userFavorites
        });
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading listings'
        });
    }
});

// About page route - require authentication
router.get('/about', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('about', { 
        title: 'About Dwelly',
        user: req.session.user 
    });
});

// Contact page route - require authentication
router.get('/contact', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('contact', { 
        title: 'Contact Us',
        user: req.session.user 
    });
});

module.exports = router; 