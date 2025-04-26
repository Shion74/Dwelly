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
                   rt.type_name, rt.display_name as type_display,
                   GROUP_CONCAT(ph.file_path) as photos,
                   COUNT(DISTINCT f.user_id) as favorite_count,
                   AVG(r.stars) as average_rating,
                   COUNT(DISTINCT r.rating_id) as rating_count
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.user_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN ratings r ON p.post_id = r.post_id
            WHERE p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `);

        // Process photos for each listing
        const processedListings = listings.map(listing => {
            // Process photos
            let photos = [];
            if (listing.photos) {
                photos = listing.photos.split(',').map(photo => `/uploads/listings/${photo}`);
            }

            return {
                ...listing,
                photos,
                price: listing.price ? parseFloat(listing.price) : null,
                average_rating: listing.average_rating ? parseFloat(listing.average_rating) : null,
                favorite_count: parseInt(listing.favorite_count) || 0,
                rating_count: parseInt(listing.rating_count) || 0,
                type: listing.type_display || 'Unknown Type'
            };
        });

        res.render('listings/index', {
            title: 'All Listings - Dwelly',
            listings: processedListings,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading listings'
        });
    }
});

// Get create listing page
router.get('/create', isAuthenticated, async (req, res) => {
    try {
        const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY type_name');
        res.render('listings/create', {
            title: 'Create Listing - Dwelly',
            user: req.session.user,
            errors: [],
            formData: {},
            roomTypes
        });
    } catch (error) {
        console.error('Error fetching room types:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading room types'
        });
    }
});

// Create a new listing
router.post('/create', isAuthenticated, upload.array('photos', 6), async (req, res) => {
    try {
        const { 
            type_id, 
            street, 
            barangay, 
            city, 
            building_name,
            unit_number,
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
        if (!type_id) errors.push('Type of rental is required');
        if (!street) errors.push('Street address is required');
        if (!barangay) errors.push('Barangay is required');
        if (!city) errors.push('City is required');
        if (!landlord_name) errors.push('Landlord name is required');
        if (!contact_number) errors.push('Contact number is required');
        if (!req.files || req.files.length < 2) errors.push('At least 2 photos are required');
        if (req.files && req.files.length > 6) errors.push('Maximum 6 photos allowed');

        // Validate Google Maps link if provided
        if (google_maps_link && google_maps_link.trim() !== '') {
            const cleanGoogleMapsLink = google_maps_link.startsWith('@') ? google_maps_link.substring(1) : google_maps_link;
            if (!cleanGoogleMapsLink.includes('maps') || !cleanGoogleMapsLink.includes('goo.gl')) {
                errors.push('Please provide a valid Google Maps link');
            }
            req.body.google_maps_link = cleanGoogleMapsLink;
        }

        // Clean up empty social media link
        if (social_media_link && social_media_link.trim() === '') {
            req.body.social_media_link = null;
        }

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY type_name');
            return res.render('listings/create', {
                title: 'Create Listing - Dwelly',
                user: req.session.user,
                errors,
                formData: req.body,
                roomTypes
            });
        }

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert listing into database
            const [result] = await connection.query(
                `INSERT INTO posts (
                    user_id, type_id, street, barangay, city, 
                    building_name, unit_number, landlord_name, contact_number,
                    social_link, maps_link, description, price
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.user.id, type_id, street, barangay, city,
                    building_name || null, unit_number || null, landlord_name, contact_number,
                    social_media_link || null, req.body.google_maps_link || null, description || null, price || null
                ]
            );

            const postId = result.insertId;

            // Insert photos
            for (const file of req.files) {
                await connection.query(
                    'INSERT INTO photos (post_id, file_path) VALUES (?, ?)',
                    [postId, file.filename] // Store just the filename
                );
            }

            // Commit transaction
            await connection.commit();
            connection.release();

            // Set success message in session
            req.session.success = 'Listing created successfully';
            
            // Redirect to the new listing
            return res.redirect(`/listings/${postId}`);
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            connection.release();
            console.error('Database error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error creating listing:', error);
        // If we get here, the listing was not created successfully
        return res.render('listings/create', {
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
            SELECT p.*, u.full_name as poster_name,
                   (SELECT COUNT(*) FROM favorites WHERE post_id = p.post_id) as favorite_count,
                   (SELECT AVG(stars) FROM ratings WHERE post_id = p.post_id) as average_rating,
                   (SELECT COUNT(*) FROM ratings WHERE post_id = p.post_id) as rating_count
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

        // Convert average_rating to number and handle null case
        listing.average_rating = listing.average_rating ? parseFloat(listing.average_rating) : null;
        listing.rating_count = parseInt(listing.rating_count) || 0;

        // Get photos and format their paths
        const [photos] = await pool.query(
            'SELECT * FROM photos WHERE post_id = ? ORDER BY photo_id ASC',
            [req.params.id]
        );

        // Format photo paths
        const formattedPhotos = photos.map(photo => ({
            ...photo,
            file_path: `/uploads/listings/${photo.file_path}`
        }));

        // Check if user has favorited this listing
        let isFavorited = false;
        if (req.session.user) {
            const [favorites] = await pool.query(
                'SELECT * FROM favorites WHERE user_id = ? AND post_id = ?',
                [req.session.user.id, req.params.id]
            );
            isFavorited = favorites.length > 0;
        }

        // Get success message from session and clear it
        const success = req.session.success;
        delete req.session.success;

        res.render('listings/details', {
            title: `${listing.type_display} - Dwelly`,
            user: req.session.user,
            listing,
            photos: formattedPhotos,
            isFavorited,
            success
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
        const postId = req.params.id;
        const userId = req.session.user.id;

        // Check if user is rating their own post
        const [posts] = await pool.query(
            'SELECT user_id FROM posts WHERE post_id = ?',
            [postId]
        );

        if (posts.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (posts[0].user_id === userId) {
            return res.status(400).json({ error: 'Cannot rate your own listing' });
        }

        // Check if user has already rated this post
        const [existingRatings] = await pool.query(
            'SELECT * FROM ratings WHERE user_id = ? AND post_id = ?',
            [userId, postId]
        );

        if (existingRatings.length > 0) {
            // Update existing rating
            await pool.query(
                'UPDATE ratings SET stars = ?, comment = ? WHERE user_id = ? AND post_id = ?',
                [stars, comment, userId, postId]
            );
        } else {
            // Insert new rating
            await pool.query(
                'INSERT INTO ratings (user_id, post_id, stars, comment) VALUES (?, ?, ?, ?)',
                [userId, postId, stars, comment]
            );
        }

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

// Get edit listing page
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT p.*, GROUP_CONCAT(ph.file_path) as photos
            FROM posts p
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            WHERE p.post_id = ? AND p.user_id = ?
            GROUP BY p.post_id
        `, [req.params.id, req.session.user.id]);

        if (listings.length === 0) {
            return res.status(404).render('error', {
                title: '404 - Listing Not Found',
                message: 'The listing you are looking for does not exist or you do not have permission to edit it.'
            });
        }

        const listing = listings[0];
        listing.photos = listing.photos ? listing.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [];

        res.render('listings/edit', {
            title: 'Edit Listing - Dwelly',
            user: req.session.user,
            listing,
            errors: [],
            formData: listing
        });
    } catch (error) {
        console.error('Error fetching listing for edit:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Error loading listing for edit'
        });
    }
});

// Update a listing
router.post('/:id/edit', isAuthenticated, upload.array('photos', 6), async (req, res) => {
    try {
        const { 
            type_id, 
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

        // Validate required fields
        const errors = [];
        if (!type_id) errors.push('Type of rental is required');
        if (!street) errors.push('Street address is required');
        if (!barangay) errors.push('Barangay is required');
        if (!city) errors.push('City is required');
        if (!landlord_name) errors.push('Landlord name is required');
        if (!contact_number) errors.push('Contact number is required');

        // Validate Google Maps link if provided
        if (google_maps_link && google_maps_link.trim() !== '') {
            const cleanGoogleMapsLink = google_maps_link.startsWith('@') ? google_maps_link.substring(1) : google_maps_link;
            if (!cleanGoogleMapsLink.includes('maps') || !cleanGoogleMapsLink.includes('goo.gl')) {
                errors.push('Please provide a valid Google Maps link');
            }
            req.body.google_maps_link = cleanGoogleMapsLink;
        }

        // Clean up empty social media link
        if (social_media_link && social_media_link.trim() === '') {
            req.body.social_media_link = null;
        }

        if (errors.length > 0) {
            return res.render('listings/edit', {
                title: 'Edit Listing - Dwelly',
                user: req.session.user,
                listing: req.body,
                errors,
                formData: req.body
            });
        }

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update listing in database
            await connection.query(
                `UPDATE posts SET 
                    type_id = ?, 
                    street = ?, 
                    barangay = ?, 
                    city = ?, 
                    landlord_name = ?, 
                    contact_number = ?, 
                    social_link = ?, 
                    maps_link = ?, 
                    description = ?, 
                    price = ?
                WHERE post_id = ? AND user_id = ?`,
                [
                    type_id, street, barangay, city,
                    landlord_name, contact_number, social_media_link || null,
                    req.body.google_maps_link || null, description || null, price || null,
                    req.params.id, req.session.user.id
                ]
            );

            // Handle new photos if uploaded
            if (req.files && req.files.length > 0) {
                // Delete old photos
                await connection.query('DELETE FROM photos WHERE post_id = ?', [req.params.id]);
                
                // Insert new photos
                for (const file of req.files) {
                    await connection.query(
                        'INSERT INTO photos (post_id, file_path) VALUES (?, ?)',
                        [req.params.id, file.filename]
                    );
                }
            }

            // Commit transaction
            await connection.commit();
            connection.release();

            // Set success message in session
            req.session.success = 'Listing updated successfully';
            
            // Redirect to the listing
            return res.redirect(`/listings/${req.params.id}`);
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            connection.release();
            console.error('Database error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error updating listing:', error);
        return res.render('listings/edit', {
            title: 'Edit Listing - Dwelly',
            user: req.session.user,
            listing: req.body,
            errors: [`An error occurred while updating the listing: ${error.message}`],
            formData: req.body
        });
    }
});

// Delete a listing
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        // Check if user owns the listing
        const [posts] = await pool.query(
            'SELECT * FROM posts WHERE post_id = ? AND user_id = ?',
            [req.params.id, req.session.user.id]
        );

        if (posts.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to delete this listing' });
        }

        // Delete the listing (photos will be deleted automatically due to ON DELETE CASCADE)
        await pool.query('DELETE FROM posts WHERE post_id = ?', [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ error: 'Failed to delete listing' });
    }
});

module.exports = router; 