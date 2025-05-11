require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const pool = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/listings', express.static(path.join(__dirname, 'public/uploads/listings')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/listings';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Make upload middleware available globally
app.locals.upload = upload;

// Routes
const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const favoritesRouter = require('./routes/favorites');

app.use('/', require('./routes/index'));
app.use('/auth', authRoutes);
app.use('/listings', listingRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/favorites', favoritesRouter);

// Test route for listings with coordinates
app.get('/test-coordinates', async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT p.post_id, rt.type_name as type, p.latitude, p.longitude, p.city, p.barangay
            FROM posts p
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        `);
        
        res.json({
            totalListings: listings.length,
            listings: listings.map(l => ({
                id: l.post_id,
                type: l.type,
                lat: l.latitude,
                lng: l.longitude,
                location: `${l.barangay}, ${l.city}`
            }))
        });
    } catch (error) {
        console.error('Error fetching listings with coordinates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Home route
app.get('/', async (req, res) => {
    try {
        console.log('Fetching listings for home page...');
        const [listings] = await pool.query(`
            SELECT p.*, u.full_name as poster_name,
                   rt.type_name, rt.type_name as type,
                   GROUP_CONCAT(ph.file_path) as photos,
                   COUNT(DISTINCT f.user_id) as favorite_count,
                   AVG(rat.stars) as average_rating,
                   COUNT(DISTINCT rat.rating_id) as rating_count,
                   rm.number_of_rooms, rm.bathroom_type, rm.room_type,
                   rm.has_wifi, rm.has_cctv, rm.is_airconditioned,
                   rm.has_parking, rm.has_own_electricity, rm.has_own_water,
                   p.latitude, p.longitude
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.user_id
            LEFT JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN photos ph ON p.post_id = ph.post_id
            LEFT JOIN favorites f ON p.post_id = f.post_id
            LEFT JOIN ratings rat ON p.post_id = rat.post_id
            LEFT JOIN rooms rm ON p.post_id = rm.post_id
            WHERE p.is_flagged = false
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `);

        console.log('Raw listings data:', listings);

        // Process photos for each listing
        const processedListings = listings.map(listing => {
            // Process photos
            let photos = [];
            if (listing.photos) {
                photos = listing.photos.split(',').map(photo => `/uploads/listings/${photo}`);
            }

            const processed = {
                ...listing,
                photos,
                price: listing.price ? parseFloat(listing.price) : null,
                average_rating: listing.average_rating ? parseFloat(listing.average_rating) : null,
                favorite_count: parseInt(listing.favorite_count) || 0,
                rating_count: parseInt(listing.rating_count) || 0,
                type: listing.type_name || 'Unknown Type',
                latitude: listing.latitude ? parseFloat(listing.latitude) : null,
                longitude: listing.longitude ? parseFloat(listing.longitude) : null
            };

            console.log('Processed listing:', {
                id: processed.post_id,
                type: processed.type,
                latitude: processed.latitude,
                longitude: processed.longitude
            });

            return processed;
        });

        console.log('Total processed listings:', processedListings.length);
        console.log('Listings with coordinates:', processedListings.filter(l => l.latitude && l.longitude).length);

        res.render('index', { 
            title: 'Dwelly - Find Your Perfect Student Housing',
            user: req.session.user,
            listings: processedListings
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: '500 - Server Error',
        message: 'Something went wrong on our end. Please try again later.'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        title: '404 - Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Start server
const PORT = 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop the other process using this port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
}); 