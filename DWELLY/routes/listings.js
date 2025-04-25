const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = 'public/uploads/listings';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Get all listings
router.get('/', async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT p.*, u.full_name as poster_name,
                   GROUP_CONCAT(ph.file_path) as photos,
                   COUNT(DISTINCT f.user_id) as favorite_count,
                   AVG(r.stars) as average_rating,
                   COUNT(DISTINCT r.rating_id) as rating_count
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.user_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN ratings r ON p.post_id = r.post_id
            WHERE p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `);

        res.render('listings/index', {
            title: 'All Listings - Dwelly',
            listings: listings.map(listing => ({
                ...listing,
                photos: listing.photos ? listing.photos.split(',') : []
            })),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

// Get create listing page
router.get('/create', isAuthenticated, (req, res) => {
    res.render('listings/create', {
        title: 'Create Listing - Dwelly',
        user: req.session.user,
        errors: [],
        formData: {}
    });
});

// Create a new listing
router.post('/create', isAuthenticated, upload.array('photos', 6), async (req, res) => {
    try {
        const { 
            type, 
            street, 
            barangay, 
            city, 
            landlord_name, 
            contact_number, 
            social_media_link, 
            google_maps_link,
            description,
            price
        } = req.body;

        console.log('Received form data:', req.body);
        console.log('Received files:', req.files);

        // Validate required fields
        const errors = [];
        if (!type) errors.push('Type of rental is required');
        if (!street) errors.push('Street address is required');
        if (!barangay) errors.push('Barangay is required');
        if (!city) errors.push('City is required');
        if (!landlord_name) errors.push('Landlord name is required');
        if (!contact_number) errors.push('Contact number is required');
        if (!req.files || req.files.length < 2) errors.push('At least 2 photos are required');
        if (req.files && req.files.length > 6) errors.push('Maximum 6 photos allowed');

        // Validate Google Maps link if provided
        if (google_maps_link && google_maps_link.trim() !== '') {
            // Remove @ symbol if present at the start
            const cleanGoogleMapsLink = google_maps_link.startsWith('@') ? google_maps_link.substring(1) : google_maps_link;
            
            // Check if it's a valid Google Maps URL - accept any URL that looks like a Google Maps link
            if (!cleanGoogleMapsLink.includes('maps') || !cleanGoogleMapsLink.includes('goo.gl')) {
                errors.push('Please provide a valid Google Maps link');
            }
            // Update the cleaned link
            req.body.google_maps_link = cleanGoogleMapsLink;
        }

        // Clean up empty social media link
        if (social_media_link && social_media_link.trim() === '') {
            req.body.social_media_link = null;
        }

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            return res.render('listings/create', {
                title: 'Create Listing - Dwelly',
                user: req.session.user,
                errors,
                formData: req.body // Preserve form data
            });
        }

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert listing into database
            const [result] = await connection.query(
                `INSERT INTO posts (
                    user_id, type, street, barangay, city, 
                    landlord_name, contact_number, social_link, 
                    maps_link, description, price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    req.session.user.id, type, street, barangay, city,
                    landlord_name, contact_number, social_media_link || null,
                    req.body.google_maps_link || null, description || null, price || null
                ]
            );

            const postId = result.insertId;

            // Insert photos
            for (const file of req.files) {
                await connection.query(
                    'INSERT INTO photos (post_id, file_path, created_at) VALUES (?, ?, NOW())',
                    [postId, `/uploads/listings/${file.filename}`]
                );
            }

            // Commit transaction
            await connection.commit();
            connection.release();

            req.flash('success', 'Listing created successfully');
            res.redirect(`/listings/${postId}`);
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            connection.release();
            console.error('Database error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error creating listing:', error);
        res.render('listings/create', {
            title: 'Create Listing - Dwelly',
            user: req.session.user,
            errors: [`An error occurred while creating the listing: ${error.message}`],
            formData: req.body // Preserve form data
        });
    }
});

// Get listing details
router.get('/:id', async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT p.*, u.full_name as owner_name,
                   (SELECT COUNT(*) FROM favorites WHERE post_id = p.post_id) as favorite_count,
                   (SELECT AVG(stars) FROM ratings WHERE post_id = p.post_id) as average_rating
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            WHERE p.post_id = ? AND p.is_flagged = false
        `, [req.params.id]);

        if (listings.length === 0) {
            return res.status(404).render('error', {
                title: '404 - Listing Not Found',
                message: 'The listing you are looking for does not exist or has been removed.'
            });
        }

        const listing = listings[0];

        // Get photos
        const [photos] = await pool.query(
            'SELECT * FROM photos WHERE post_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );

        // Check if user has favorited this listing
        let isFavorited = false;
        if (req.session.user) {
            const [favorites] = await pool.query(
                'SELECT * FROM favorites WHERE user_id = ? AND post_id = ?',
                [req.session.user.id, req.params.id]
            );
            isFavorited = favorites.length > 0;
        }

        res.render('listings/details', {
            title: `${listing.type} - Dwelly`,
            user: req.session.user,
            listing,
            photos,
            isFavorited
        });
    } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading listing'
        });
    }
});

// Toggle favorite
router.post('/:id/favorite', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.user.id;

        // Check if already favorited
        const [existing] = await pool.query(
            'SELECT * FROM favorites WHERE user_id = ? AND post_id = ?',
            [userId, postId]
        );

        if (existing.length > 0) {
            // Remove from favorites
            await pool.query(
                'DELETE FROM favorites WHERE user_id = ? AND post_id = ?',
                [userId, postId]
            );
            res.json({ success: true, action: 'removed' });
        } else {
            // Add to favorites
            await pool.query(
                'INSERT INTO favorites (user_id, post_id, created_at) VALUES (?, ?, NOW())',
                [userId, postId]
            );
            res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ success: false, error: 'Failed to update favorite status' });
    }
});

// Rate a listing
router.post('/:id/rate', isAuthenticated, async (req, res) => {
    try {
        const { stars, comment } = req.body;

        // Check if user is rating their own post
        const [posts] = await pool.query(
            'SELECT user_id FROM posts WHERE post_id = ?',
            [req.params.id]
        );

        if (posts[0].user_id === req.session.user.id) {
            return res.status(400).json({ error: 'Cannot rate your own listing' });
        }

        // Insert or update rating
        await pool.query(
            `INSERT INTO ratings (user_id, post_id, stars, comment)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stars = ?, comment = ?`,
            [req.session.user.id, req.params.id, stars, comment, stars, comment]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error rating listing:', error);
        res.status(500).json({ error: 'Failed to rate listing' });
    }
});

// Report a listing
router.post('/:id/report', isAuthenticated, async (req, res) => {
    try {
        const { reason } = req.body;

        // Check if user has already reported this post
        const [existingReports] = await pool.query(
            'SELECT * FROM reports WHERE reporter_id = ? AND post_id = ?',
            [req.session.user.id, req.params.id]
        );

        if (existingReports.length > 0) {
            return res.status(400).json({ error: 'You have already reported this listing' });
        }

        await pool.query(
            'INSERT INTO reports (post_id, reporter_id, reason) VALUES (?, ?, ?)',
            [req.params.id, req.session.user.id, reason]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error reporting listing:', error);
        res.status(500).json({ error: 'Failed to report listing' });
    }
});

module.exports = router; 