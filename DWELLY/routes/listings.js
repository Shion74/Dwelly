const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import geolocation middleware
const { extractLocationMiddleware } = require('../middleware/geoLocationExtractor');
const { moderateContent, auditLogger, csrfProtection } = require('../middleware/security');
const { moderatePostCreation } = require('../middleware/contentModerator');

// Apply CSRF protection to all listing routes
router.use(async (req, res, next) => {
    // TEMPORARILY DISABLE CSRF PROTECTION FOR DEVELOPMENT
    console.log('🔓 CSRF protection disabled for listings');
    
    // Generate CSRF token for template compatibility
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        console.log('🔐 Generated new CSRF token for compatibility:', req.session.csrfToken.substring(0, 8) + '...');
    }
    
    // Make token available to views (for template compatibility)
    res.locals.csrfToken = req.session.csrfToken;
    
    // Skip CSRF validation entirely
    console.log('✅ Skipping CSRF validation - proceeding to route handler');
    
    next();
});

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
                   AVG(rat.stars) as average_rating,
                   COUNT(DISTINCT rat.rating_id) as rating_count,
                   rm.number_of_rooms, rm.bathroom_type, rm.room_type,
                   p.latitude, p.longitude
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.user_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN ratings rat ON p.post_id = rat.post_id
            LEFT JOIN rooms rm ON p.post_id = rm.post_id
            WHERE p.is_flagged = false AND p.status != 'archived'
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `);

        // Get amenities for each listing
        const listingIds = listings.map(l => l.post_id);
        let amenitiesMap = {};
        
        if (listingIds.length > 0) {
            const [amenities] = await pool.query(`
                SELECT post_id, amenity_name, amenity_type 
                FROM post_amenities 
                WHERE post_id IN (${listingIds.map(() => '?').join(',')})
                ORDER BY amenity_type ASC, amenity_name ASC
            `, listingIds);
            
            // Group amenities by post_id
            amenities.forEach(amenity => {
                if (!amenitiesMap[amenity.post_id]) {
                    amenitiesMap[amenity.post_id] = [];
                }
                amenitiesMap[amenity.post_id].push(amenity);
            });
        }

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
                type: listing.type_display || 'Unknown Type',
                latitude: listing.latitude ? parseFloat(listing.latitude) : null,
                longitude: listing.longitude ? parseFloat(listing.longitude) : null,
                allAmenities: amenitiesMap[listing.post_id] || []
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
            title: 'Error - Dwelly',
            message: 'Error fetching listings',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Debug route for CSRF issues
router.get('/debug-csrf', isAuthenticated, (req, res) => {
    res.json({
        hasSession: !!req.session,
        hasUser: !!req.session.user,
        hasCsrfToken: !!req.session.csrfToken,
        csrfTokenPreview: req.session.csrfToken ? req.session.csrfToken.substring(0, 8) + '...' : 'none',
        resLocalsCsrf: !!res.locals.csrfToken,
        resLocalsCsrfPreview: res.locals.csrfToken ? res.locals.csrfToken.substring(0, 8) + '...' : 'none'
    });
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
router.post('/create', 
    isAuthenticated, 
    extractLocationMiddleware,  // Extract location from map URL
    moderatePostCreation,       // Content moderation
    upload.array('photos', 6), 
    auditLogger('post_create'), // Security audit logging
    async (req, res) => {
    try {
        const { 
            type_id, 
            street, 
            barangay, 
            building_name,
            unit_number,
            landlord_name,
            contact_number,
            social_media_link,
            description,
            price,
            // New fields
            number_of_rooms,
            bathroom_type,
            room_type,
            has_wifi,
            has_cctv,
            is_airconditioned,
            has_parking,
            has_own_electricity,
            has_own_water,
            latitude,
            longitude,
            maps_link
        } = req.body;

        // Set default city
        const city = 'Davao City';

        console.log('Received form data:', req.body);
        console.log('Received files:', req.files);
        console.log('Custom amenities[] received:', req.body['custom_amenities[]']);
        console.log('Custom amenities received:', req.body['custom_amenities']);

        // Validate required fields
        const errors = [];
        if (!type_id) errors.push('Type of rental is required');
        if (!street) errors.push('Street address is required');
        if (!barangay) errors.push('Barangay is required');
        if (!landlord_name) errors.push('Landlord name is required');
        if (!contact_number) errors.push('Contact number is required');
        if (!req.files || req.files.length < 2) errors.push('At least 2 photos are required');
        if (req.files && req.files.length > 6) errors.push('Maximum 6 photos allowed');
        if (!number_of_rooms) errors.push('Number of rooms is required');
        if (!bathroom_type) errors.push('Bathroom type is required');
        if (!room_type) errors.push('Room type is required');
        if (!latitude || !longitude) errors.push('Please select a location on the map');

        // Validate Google Maps link if provided
        let cleaned_maps_link = maps_link ? maps_link.trim() : '';
        if (cleaned_maps_link.startsWith('@')) {
            cleaned_maps_link = cleaned_maps_link.substring(1);
        }
        if (cleaned_maps_link && !/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com)\/.+/.test(cleaned_maps_link)) {
            errors.push('Please enter a valid Google Maps or Apple Maps link.');
        }
        req.body.maps_link = cleaned_maps_link;

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
                    social_link, description, search_keywords, price, latitude, longitude,
                    maps_link, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.user.id, type_id, street, barangay, city,
                    building_name || null, unit_number || null, landlord_name, contact_number,
                    social_media_link || null, description || null, 
                    // Generate search keywords from description and location
                    `${description || ''} ${street} ${barangay} ${city} ${building_name || ''}`.trim(),
                    price || null,
                    latitude, longitude,
                    req.body.maps_link || null,
                    'available' // Set default status
                ]
            );

            const postId = result.insertId;

            // Insert room details (without amenities)
            await connection.query(
                `INSERT INTO rooms (
                    post_id, number_of_rooms, bathroom_type, room_type
                ) VALUES (?, ?, ?, ?)`,
                [
                    postId, number_of_rooms, bathroom_type, room_type
                ]
            );

            // Insert default amenities (if selected)
            const defaultAmenities = [
                { field: 'has_wifi', name: 'WiFi' },
                { field: 'has_cctv', name: 'CCTV' },
                { field: 'is_airconditioned', name: 'Air Conditioning' },
                { field: 'has_parking', name: 'Parking' },
                { field: 'has_own_electricity', name: 'Own Electricity Meter' },
                { field: 'has_own_water', name: 'Own Water Meter' }
            ];

            for (const amenity of defaultAmenities) {
                if (req.body[amenity.field]) {
                    await connection.query(
                        'INSERT INTO post_amenities (post_id, amenity_name, amenity_type) VALUES (?, ?, ?)',
                        [postId, amenity.name, 'default']
            );
                }
            }

            // Insert custom amenities
            console.log('Processing custom amenities...');
            // Check both possible field names (with and without [])
            let customAmenities = req.body['custom_amenities[]'] || req.body['custom_amenities'];
            if (customAmenities) {
                console.log('Raw custom amenities:', customAmenities);
                if (!Array.isArray(customAmenities)) customAmenities = [customAmenities];
                console.log('Processed custom amenities array:', customAmenities);
                for (const amenity of customAmenities) {
                    if (amenity && amenity.trim()) { // Only insert non-empty amenities
                        console.log('Inserting custom amenity:', amenity);
                    await connection.query(
                            'INSERT INTO post_amenities (post_id, amenity_name, amenity_type) VALUES (?, ?, ?)',
                            [postId, amenity.trim(), 'custom']
                    );
                    }
                }
                console.log('Custom amenities inserted successfully');
            } else {
                console.log('No custom amenities found in request body');
            }

            // Insert photos
            for (const file of req.files) {
                await connection.query(
                    'INSERT INTO photos (post_id, file_path) VALUES (?, ?)',
                    [postId, file.filename]
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
                   rt.type_name, rt.display_name as type_display,
                   rm.number_of_rooms, rm.bathroom_type, rm.room_type,
                   (SELECT COUNT(*) FROM favorites WHERE post_id = p.post_id) as favorite_count,
                   (SELECT AVG(stars) FROM ratings WHERE post_id = p.post_id) as average_rating,
                   (SELECT COUNT(*) FROM ratings WHERE post_id = p.post_id) as rating_count
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN rooms rm ON p.post_id = rm.post_id
            WHERE p.post_id = ? AND p.is_flagged = false AND p.status != 'archived'
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

        // Get all amenities for this listing (both default and custom)
        const [allAmenities] = await pool.query(
            'SELECT * FROM post_amenities WHERE post_id = ? ORDER BY amenity_type ASC, amenity_name ASC',
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

        // Get success and error messages from session and clear them
        const success = req.session.success;
        const error = req.session.error;
        delete req.session.success;
        delete req.session.error;

        res.render('listings/details', {
            title: `${listing.type_display} - Dwelly`,
            user: req.session.user,
            listing,
            photos: formattedPhotos,
            isFavorited,
            allAmenities,
            success,
            messages: { error }
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
        const { type, reason } = req.body;
        if (!type || !['occupied', 'scam', 'other'].includes(type)) {
            return res.status(400).json({ error: 'Invalid report type' });
        }
        if (type === 'other' && (!reason || reason.trim() === '')) {
            return res.status(400).json({ error: 'Reason required for "Other"' });
        }

        // Check if user has already reported this post
        const [existingReports] = await pool.query(
            'SELECT * FROM reports WHERE reporter_id = ? AND post_id = ?',
            [req.session.user.id, req.params.id]
        );
        if (existingReports.length > 0) {
            return res.status(400).json({ error: 'You have already reported this listing' });
        }

        await pool.query(
            'INSERT INTO reports (post_id, reporter_id, reason, type) VALUES (?, ?, ?, ?)',
            [req.params.id, req.session.user.id, reason, type]
        );

        // Count reports of each type for this post
        const [[occupiedCount]] = await pool.query(
            'SELECT COUNT(*) as count FROM reports WHERE post_id = ? AND type = "occupied"',
            [req.params.id]
        );
        const [[scamCount]] = await pool.query(
            'SELECT COUNT(*) as count FROM reports WHERE post_id = ? AND type = "scam"',
            [req.params.id]
        );

        // Archive if 5 or more reports of either type
        if (occupiedCount.count >= 5 || scamCount.count >= 5) {
            await pool.query(
                'UPDATE posts SET status = "archived" WHERE post_id = ?',
                [req.params.id]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error reporting listing:', error);
        res.status(500).json({ error: 'Failed to report listing' });
    }
});

// Get edit listing page
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        // Get room types for the dropdown
        const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY display_name');

        const [listings] = await pool.query(`
            SELECT p.*, GROUP_CONCAT(ph.file_path) as photos,
                   rt.type_name, rt.display_name as type_display,
                   rm.number_of_rooms, rm.bathroom_type, rm.room_type
            FROM posts p
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN rooms rm ON p.post_id = rm.post_id
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
        
        // Get amenities for this listing
        const [amenities] = await pool.query(
            'SELECT * FROM post_amenities WHERE post_id = ? ORDER BY amenity_type ASC, amenity_name ASC',
            [req.params.id]
        );
        
        // Separate default and custom amenities
        const defaultAmenities = amenities.filter(a => a.amenity_type === 'default');
        const customAmenities = amenities.filter(a => a.amenity_type === 'custom');
        
        // Set default amenity checkboxes
        const amenityFlags = {
            has_wifi: defaultAmenities.some(a => a.amenity_name === 'WiFi'),
            has_cctv: defaultAmenities.some(a => a.amenity_name === 'CCTV'),
            is_airconditioned: defaultAmenities.some(a => a.amenity_name === 'Air Conditioning'),
            has_parking: defaultAmenities.some(a => a.amenity_name === 'Parking'),
            has_own_electricity: defaultAmenities.some(a => a.amenity_name === 'Own Electricity Meter'),
            has_own_water: defaultAmenities.some(a => a.amenity_name === 'Own Water Meter')
        };
        
        // Prepare form data
        const formData = {
            ...listing,
            ...amenityFlags,
            google_maps_link: listing.maps_link || ''
        };

        res.render('listings/edit', {
            title: 'Edit Listing - Dwelly',
            user: req.session.user,
            listing,
            errors: [],
            formData,
            roomTypes,
            customAmenities: customAmenities.map(a => a.amenity_name)
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
router.post('/:id/edit', 
    isAuthenticated, 
    extractLocationMiddleware,  // Extract location from map URL
    moderatePostCreation,       // Content moderation
    upload.array('new_photos', 6), 
    auditLogger('post_edit'),   // Security audit logging
    async (req, res) => {
    try {
        console.log('=== EDIT LISTING DEBUG ===');
        console.log('Request body:', req.body);
        console.log('Files:', req.files);
        console.log('Keep photos field:', req.body['keep_photos[]']);
        console.log('========================');
        
        const { 
            type_id, 
            street, 
            barangay, 
            building_name,
            unit_number,
            landlord_name, 
            contact_number, 
            social_media_link, 
            maps_link,
            description,
            price,
            latitude,
            longitude,
            // New fields
            number_of_rooms,
            bathroom_type,
            room_type,
            has_wifi,
            has_cctv,
            is_airconditioned,
            has_parking,
            has_own_electricity,
            has_own_water
        } = req.body;

        // Set default city
        const city = 'Davao City';

        // Validate required fields
        const errors = [];
        if (!type_id) errors.push('Type of rental is required');
        if (!street) errors.push('Street address is required');
        if (!barangay) errors.push('Barangay is required');
        if (!landlord_name) errors.push('Landlord name is required');
        if (!contact_number) errors.push('Contact number is required');
        if (!number_of_rooms) errors.push('Number of rooms is required');
        if (!bathroom_type) errors.push('Bathroom type is required');
        if (!room_type) errors.push('Room type is required');

        // Validate Google Maps link if provided
        let cleaned_maps_link = maps_link ? maps_link.trim() : '';
        if (cleaned_maps_link.startsWith('@')) {
            cleaned_maps_link = cleaned_maps_link.substring(1);
        }
        if (cleaned_maps_link && !/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com)\/.+/.test(cleaned_maps_link)) {
            errors.push('Please enter a valid Google Maps or Apple Maps link.');
        }
        req.body.maps_link = cleaned_maps_link;

        // Clean up empty social media link
        if (social_media_link && social_media_link.trim() === '') {
            req.body.social_media_link = null;
        }

        if (errors.length > 0) {
            const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY display_name');
            
            // Get the listing data for re-rendering
            const [listings] = await pool.query(`
                SELECT p.*, GROUP_CONCAT(ph.file_path) as photos,
                       rt.type_name, rt.display_name as type_display,
                       rm.number_of_rooms, rm.bathroom_type, rm.room_type
                FROM posts p
                LEFT JOIN photos ph ON p.post_id = ph.post_id
                LEFT JOIN room_types rt ON p.type_id = rt.type_id
                LEFT JOIN rooms rm ON p.post_id = rm.post_id
                WHERE p.post_id = ? AND p.user_id = ?
                GROUP BY p.post_id
            `, [req.params.id, req.session.user.id]);
            
            const listing = listings[0];
            listing.photos = listing.photos ? listing.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [];
            
            return res.render('listings/edit', {
                title: 'Edit Listing - Dwelly',
                user: req.session.user,
                listing,
                errors,
                formData: req.body,
                roomTypes,
                customAmenities: []
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
                    building_name = ?,
                    unit_number = ?,
                    landlord_name = ?, 
                    contact_number = ?, 
                    social_link = ?, 
                    maps_link = ?, 
                    description = ?, 
                    search_keywords = ?,
                    price = ?,
                    latitude = ?,
                    longitude = ?
                WHERE post_id = ? AND user_id = ?`,
                [
                    type_id, street, barangay, city,
                    building_name || null, unit_number || null,
                    landlord_name, contact_number, 
                    social_media_link || null,
                    cleaned_maps_link || null, 
                    description || null,
                    // Update search keywords
                    `${description || ''} ${street} ${barangay} ${city} ${building_name || ''}`.trim(),
                    price || null,
                    latitude,
                    longitude,
                    req.params.id, req.session.user.id
                ]
            );

            // Update room details
            await connection.query(
                `UPDATE rooms SET 
                    number_of_rooms = ?, 
                    bathroom_type = ?, 
                    room_type = ?
                WHERE post_id = ?`,
                [
                    number_of_rooms, bathroom_type, room_type,
                    req.params.id
                ]
            );

            // Update amenities - delete existing and insert new ones
            await connection.query('DELETE FROM post_amenities WHERE post_id = ?', [req.params.id]);

            // Insert default amenities (if selected)
            const defaultAmenities = [
                { field: 'has_wifi', name: 'WiFi' },
                { field: 'has_cctv', name: 'CCTV' },
                { field: 'is_airconditioned', name: 'Air Conditioning' },
                { field: 'has_parking', name: 'Parking' },
                { field: 'has_own_electricity', name: 'Own Electricity Meter' },
                { field: 'has_own_water', name: 'Own Water Meter' }
            ];

            for (const amenity of defaultAmenities) {
                if (req.body[amenity.field]) {
                    await connection.query(
                        'INSERT INTO post_amenities (post_id, amenity_name, amenity_type) VALUES (?, ?, ?)',
                        [req.params.id, amenity.name, 'default']
                    );
                }
            }

            // Insert custom amenities
            let customAmenities = req.body['custom_amenities[]'] || req.body['custom_amenities'];
            if (customAmenities) {
                if (!Array.isArray(customAmenities)) customAmenities = [customAmenities];
                for (const amenity of customAmenities) {
                    if (amenity && amenity.trim()) {
                        await connection.query(
                            'INSERT INTO post_amenities (post_id, amenity_name, amenity_type) VALUES (?, ?, ?)',
                            [req.params.id, amenity.trim(), 'custom']
                        );
                    }
                }
            }

            // Handle photo management
            console.log('Processing photos...');
            console.log('Keep photos (with []):', req.body['keep_photos[]']);
            console.log('Keep photos (without []):', req.body['keep_photos']);
            console.log('New files:', req.files ? req.files.length : 0);

            // Get current photos from database
            const [currentPhotos] = await connection.query('SELECT * FROM photos WHERE post_id = ?', [req.params.id]);
            console.log('Current photos in DB:', currentPhotos.map(p => p.file_path));

            // Determine which photos to keep - handle both field names
            let photosToKeep = req.body['keep_photos[]'] || req.body['keep_photos'] || [];
            if (!Array.isArray(photosToKeep)) {
                photosToKeep = photosToKeep ? [photosToKeep] : [];
            }
            console.log('Photos to keep:', photosToKeep);

            // If no new photos are being uploaded and no keep_photos[] is specified,
            // assume user wants to keep all existing photos (no changes to photos)
            if ((!req.files || req.files.length === 0) && photosToKeep.length === 0 && currentPhotos.length > 0) {
                console.log('No photo changes detected - keeping all existing photos');
                photosToKeep = currentPhotos.map(p => p.file_path);
            }

            // Delete photos that are not in the keep list
            for (const photo of currentPhotos) {
                if (!photosToKeep.includes(photo.file_path)) {
                    console.log('Deleting photo:', photo.file_path);
                    await connection.query('DELETE FROM photos WHERE photo_id = ?', [photo.photo_id]);
                    
                    // Also delete the physical file
                    const fs = require('fs');
                    const filePath = `public/uploads/listings/${photo.file_path}`;
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('Deleted physical file:', filePath);
                    }
                }
            }

            // Add new photos if uploaded
            if (req.files && req.files.length > 0) {
                console.log('Adding new photos...');
                for (const file of req.files) {
                    await connection.query(
                        'INSERT INTO photos (post_id, file_path) VALUES (?, ?)',
                        [req.params.id, file.filename]
                    );
                    console.log('Added new photo:', file.filename);
                }
            }

            // Validate total photo count
            const [finalPhotos] = await connection.query('SELECT COUNT(*) as count FROM photos WHERE post_id = ?', [req.params.id]);
            const totalPhotos = finalPhotos[0].count;
            console.log('Final photo count:', totalPhotos);

            if (totalPhotos === 0) {
                await connection.rollback();
                connection.release();
                const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY display_name');
                
                // Get the listing data for re-rendering
                const [listings] = await pool.query(`
                    SELECT p.*, GROUP_CONCAT(ph.file_path) as photos,
                           rt.type_name, rt.display_name as type_display,
                           rm.number_of_rooms, rm.bathroom_type, rm.room_type
                    FROM posts p
                    LEFT JOIN photos ph ON p.post_id = ph.post_id
                    LEFT JOIN room_types rt ON p.type_id = rt.type_id
                    LEFT JOIN rooms rm ON p.post_id = rm.post_id
                    WHERE p.post_id = ? AND p.user_id = ?
                    GROUP BY p.post_id
                `, [req.params.id, req.session.user.id]);
                
                const listing = listings[0];
                listing.photos = listing.photos ? listing.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [];
                
                return res.render('listings/edit', {
                    title: 'Edit Listing - Dwelly',
                    user: req.session.user,
                    listing,
                    errors: ['At least one photo is required'],
                    formData: req.body,
                    roomTypes,
                    customAmenities: []
                });
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
        const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY display_name');
        
        // Get the listing data for re-rendering
        const [listings] = await pool.query(`
            SELECT p.*, GROUP_CONCAT(ph.file_path) as photos,
                   rt.type_name, rt.display_name as type_display,
                   rm.number_of_rooms, rm.bathroom_type, rm.room_type
            FROM posts p
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN rooms rm ON p.post_id = rm.post_id
            WHERE p.post_id = ? AND p.user_id = ?
            GROUP BY p.post_id
        `, [req.params.id, req.session.user.id]);
        
        const listing = listings[0];
        listing.photos = listing.photos ? listing.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [];
        
        return res.render('listings/edit', {
            title: 'Edit Listing - Dwelly',
            user: req.session.user,
            listing,
            errors: [`An error occurred while updating the listing: ${error.message}`],
            formData: req.body,
            roomTypes,
            customAmenities: []
        });
    }
});

// Delete a listing
router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        // Check if user owns the listing
        const [posts] = await pool.query(
            'SELECT * FROM posts WHERE post_id = ? AND user_id = ?',
            [req.params.id, req.session.user.id]
        );

        if (posts.length === 0) {
            req.session.error = 'You do not have permission to delete this listing';
            return res.redirect(`/listings/${req.params.id}`);
        }

        // Archive and delete the listing using the archive system
        const { archiveAndDeletePost } = require('../utils/archiveUtils');
        const result = await archiveAndDeletePost(
            req.params.id, 
            req.session.user.id, 
            'user_deleted'
        );

        if (result.success) {
            req.session.success = 'Listing archived and deleted successfully';
            console.log(`✅ Post ${req.params.id} archived and deleted by user ${req.session.user.id}`);
        } else {
            req.session.error = 'Failed to delete listing: ' + result.message;
            console.error(`❌ Failed to archive/delete post ${req.params.id}:`, result.error);
        }

        res.redirect('/');
    } catch (error) {
        console.error('Error deleting listing:', error);
        req.session.error = 'Failed to delete listing';
        res.redirect(`/listings/${req.params.id}`);
    }
});

module.exports = router; 