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
const apiRoutes = require('./routes/api');

app.use('/', require('./routes/index'));
app.use('/auth', authRoutes);
app.use('/listings', listingRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/favorites', favoritesRouter);
app.use('/api', apiRoutes);

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
        
        // Get search and filter parameters
        const search = req.query.search || '';
        const barangay = req.query.barangay || '';
        const city = req.query.city || '';
        const type = req.query.type || '';
        const minPrice = req.query.min_price || '';
        const maxPrice = req.query.max_price || '';
        const rooms = req.query.rooms || '';
        const bathroom = req.query.bathroom || '';
        const sortBy = req.query.sort || 'newest';
        
        // Build WHERE clause
        let whereClause = 'WHERE p.is_flagged = false AND p.status != \'archived\'';
        let queryParams = [];
        
        if (search) {
            // Enhanced search to include rental type, price, and amenities
            const searchTerm = `%${search}%`;
            
            // Check if search contains price-related terms
            const priceMatch = search.match(/(\d+)/);
            let priceConditions = '';
            let priceParams = [];
            
            if (priceMatch) {
                const priceValue = parseInt(priceMatch[1]);
                // Allow for price range searches (±20% of searched price)
                const priceMin = priceValue * 0.8;
                const priceMax = priceValue * 1.2;
                priceConditions = ` OR (p.price >= ? AND p.price <= ?)`;
                priceParams = [priceMin, priceMax];
            }
            
            whereClause += ` AND (
                p.street LIKE ? OR 
                p.barangay LIKE ? OR 
                p.city LIKE ? OR 
                p.description LIKE ? OR
                rt.type_name LIKE ? OR
                rt.display_name LIKE ? OR
                CAST(p.price AS CHAR) LIKE ? OR
                rm.room_type LIKE ? OR
                rm.bathroom_type LIKE ? OR
                EXISTS (
                    SELECT 1 FROM post_amenities pa 
                    WHERE pa.post_id = p.post_id 
                    AND pa.amenity_name LIKE ?
                )${priceConditions}
            )`;
            
            queryParams.push(
                searchTerm, searchTerm, searchTerm, searchTerm, // location and description
                searchTerm, searchTerm, // rental types
                searchTerm, // price as string
                searchTerm, searchTerm, // room details
                searchTerm, // amenities
                ...priceParams // price range if applicable
            );
        }
        
        if (barangay) {
            whereClause += ' AND p.barangay = ?';
            queryParams.push(barangay);
        }
        
        if (city) {
            whereClause += ' AND p.city = ?';
            queryParams.push(city);
        }
        
        if (type) {
            whereClause += ' AND rt.type_name = ?';
            queryParams.push(type);
        }
        
        if (minPrice) {
            whereClause += ' AND p.price >= ?';
            queryParams.push(parseFloat(minPrice));
        }
        
        if (maxPrice) {
            whereClause += ' AND p.price <= ?';
            queryParams.push(parseFloat(maxPrice));
        }
        
        if (rooms) {
            whereClause += ' AND rm.number_of_rooms = ?';
            queryParams.push(parseInt(rooms));
        }
        
        if (bathroom) {
            whereClause += ' AND rm.bathroom_type = ?';
            queryParams.push(bathroom);
        }
        
        // Build ORDER BY clause
        let orderClause = 'ORDER BY ';
        switch (sortBy) {
            case 'price_low':
                orderClause += 'p.price ASC';
                break;
            case 'price_high':
                orderClause += 'p.price DESC';
                break;
            case 'rating':
                orderClause += 'average_rating DESC';
                break;
            case 'oldest':
                orderClause += 'p.created_at ASC';
                break;
            default: // newest
                orderClause += 'p.created_at DESC';
        }
        
        const [listings] = await pool.query(`
            SELECT p.*, u.full_name as poster_name,
                   rt.type_name, rt.type_name as type,
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
            ${whereClause}
            GROUP BY p.post_id
            ${orderClause}
        `, queryParams);

        console.log('Raw listings data:', listings);

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

            const processed = {
                ...listing,
                photos,
                price: listing.price ? parseFloat(listing.price) : null,
                average_rating: listing.average_rating ? parseFloat(listing.average_rating) : null,
                favorite_count: parseInt(listing.favorite_count) || 0,
                rating_count: parseInt(listing.rating_count) || 0,
                type: listing.type_name || 'Unknown Type',
                latitude: listing.latitude ? parseFloat(listing.latitude) : null,
                longitude: listing.longitude ? parseFloat(listing.longitude) : null,
                allAmenities: amenitiesMap[listing.post_id] || []
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

        // Get filter options for dropdowns
        const [barangays] = await pool.query(`
            SELECT DISTINCT barangay FROM posts 
            WHERE is_flagged = false AND status != 'archived' AND barangay IS NOT NULL 
            ORDER BY barangay
        `);
        
        const [cities] = await pool.query(`
            SELECT DISTINCT city FROM posts 
            WHERE is_flagged = false AND status != 'archived' AND city IS NOT NULL 
            ORDER BY city
        `);
        
        const [roomTypes] = await pool.query(`
            SELECT DISTINCT rt.type_name, rt.display_name FROM room_types rt
            JOIN posts p ON rt.type_id = p.type_id
            WHERE p.is_flagged = false AND p.status != 'archived'
            ORDER BY rt.display_name
        `);

        res.render('index', { 
            title: 'Dwelly - Find Your Perfect Student Housing',
            user: req.session.user,
            listings: processedListings,
            filters: {
                search,
                barangay,
                city,
                type,
                min_price: minPrice,
                max_price: maxPrice,
                rooms,
                bathroom,
                sort: sortBy
            },
            filterOptions: {
                barangays: barangays.map(b => b.barangay),
                cities: cities.map(c => c.city),
                roomTypes: roomTypes
            }
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