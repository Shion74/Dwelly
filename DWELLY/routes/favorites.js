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

// Get user's favorite listings
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Fetch user's favorite listings with additional information
        const [favorites] = await pool.query(`
            SELECT p.*, u.full_name as owner_name,
                   rt.type_name, rt.display_name as type_display,
                   GROUP_CONCAT(ph.file_path) as photos,
                   (SELECT COUNT(*) FROM favorites WHERE post_id = p.post_id) as favorite_count,
                   (SELECT AVG(stars) FROM ratings WHERE post_id = p.post_id) as average_rating,
                   (SELECT COUNT(*) FROM ratings WHERE post_id = p.post_id) as rating_count
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            JOIN room_types rt ON p.type_id = rt.type_id
            JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            WHERE f.user_id = ? AND p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY f.created_at DESC
        `, [req.session.user.id]);

        // Process the favorites data
        const processedFavorites = favorites.map(favorite => ({
            ...favorite,
            photos: favorite.photos ? favorite.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [],
            price: favorite.price ? parseFloat(favorite.price) : null,
            average_rating: favorite.average_rating ? parseFloat(favorite.average_rating) : null,
            favorite_count: parseInt(favorite.favorite_count) || 0,
            rating_count: parseInt(favorite.rating_count) || 0,
            type: favorite.type_display || 'Unknown Type'
        }));

        res.render('favorites', {
            title: 'My Favorites - Dwelly',
            user: req.session.user,
            listings: processedFavorites
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading favorites'
        });
    }
});

module.exports = router; 