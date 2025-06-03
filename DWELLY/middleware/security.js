const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const Filter = require('bad-words');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Initialize content filter
const filter = new Filter();

// Custom word filter for housing-specific inappropriate content
const housingBlacklist = [
    'scam', 'fake', 'fraud', 'steal', 'cheat', 'lie', 'illegal',
    'drug', 'alcohol', 'party', 'noise', 'dirty', 'unsafe'
];
filter.addWords(...housingBlacklist);

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
});

// Different rate limits for different endpoints
const rateLimiters = {
    general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests, please try again later'),
    auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many login attempts, please try again later'),
    posting: createRateLimiter(60 * 60 * 1000, 10, 'Too many posts created, please wait before posting again'),
    search: createRateLimiter(1 * 60 * 1000, 30, 'Too many search requests, please slow down'),
    upload: createRateLimiter(10 * 60 * 1000, 20, 'Too many file uploads, please wait')
};

// Input validation schemas
const validationSchemas = {
    email: (email) => validator.isEmail(email),
    phone: (phone) => validator.isMobilePhone(phone, 'any'),
    url: (url) => validator.isURL(url, { protocols: ['http', 'https'] }),
    price: (price) => validator.isFloat(price, { min: 0, max: 100000 }),
    coordinates: (lat, lng) => {
        return validator.isFloat(lat, { min: -90, max: 90 }) && 
               validator.isFloat(lng, { min: -180, max: 180 });
    },
    idNumber: (id) => validator.isAlphanumeric(id) && validator.isLength(id, { min: 8, max: 12 }),
    password: (password) => {
        return validator.isLength(password, { min: 8 }) &&
               /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
    }
};

// Text sanitization and validation
const sanitizeText = (text, options = {}) => {
    if (!text) return '';
    
    // Remove HTML tags and sanitize
    let sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Check for profanity if enabled
    if (options.filterProfanity) {
        if (filter.isProfane(sanitized)) {
            throw new Error('Content contains inappropriate language');
        }
    }
    
    // Check length limits
    if (options.maxLength && sanitized.length > options.maxLength) {
        throw new Error(`Content exceeds maximum length of ${options.maxLength} characters`);
    }
    
    return sanitized;
};

// Content moderation middleware
const moderateContent = async (req, res, next) => {
    try {
        const contentFields = ['description', 'landlord_name', 'street', 'barangay', 'building_name'];
        
        for (const field of contentFields) {
            if (req.body[field]) {
                req.body[field] = sanitizeText(req.body[field], {
                    filterProfanity: true,
                    maxLength: field === 'description' ? 1000 : 200
                });
            }
        }
        
        // Validate contact information
        if (req.body.contact_number && !validationSchemas.phone(req.body.contact_number)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        
        if (req.body.social_media_link && req.body.social_media_link.trim() !== '') {
            if (!validationSchemas.url(req.body.social_media_link)) {
                return res.status(400).json({ error: 'Invalid social media link format' });
            }
        }
        
        // Validate price
        if (req.body.price && !validationSchemas.price(req.body.price)) {
            return res.status(400).json({ error: 'Invalid price format' });
        }
        
        // Validate coordinates
        if (req.body.latitude && req.body.longitude) {
            if (!validationSchemas.coordinates(req.body.latitude, req.body.longitude)) {
                return res.status(400).json({ error: 'Invalid location coordinates' });
            }
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};

// User registration validation
const validateUserRegistration = (req, res, next) => {
    try {
        const { full_name, id_number, email, password, phone_number } = req.body;
        
        // Validate required fields
        if (!full_name || !id_number || !email || !password) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }
        
        // Sanitize name
        req.body.full_name = sanitizeText(full_name, { maxLength: 100 });
        
        // Validate ID number
        if (!validationSchemas.idNumber(id_number)) {
            return res.status(400).json({ error: 'Invalid ID number format' });
        }
        
        // Validate email
        if (!validationSchemas.email(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // Validate password strength
        if (!validationSchemas.password(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
            });
        }
        
        // Validate phone number
        if (phone_number && !validationSchemas.phone(phone_number)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};

// Image security validation
const validateUploadedImages = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next();
    }
    
    try {
        for (const file of req.files) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                await fs.unlink(file.path); // Remove uploaded file
                return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
            }
            
            // Validate image using sharp (more secure than just checking extension)
            try {
                const metadata = await sharp(file.path).metadata();
                
                // Check if it's actually an image
                if (!metadata.format || !['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format)) {
                    await fs.unlink(file.path);
                    return res.status(400).json({ error: 'Invalid image format' });
                }
                
                // Check image dimensions (reasonable limits)
                if (metadata.width > 4000 || metadata.height > 4000) {
                    await fs.unlink(file.path);
                    return res.status(400).json({ error: 'Image dimensions too large' });
                }
                
            } catch (sharpError) {
                await fs.unlink(file.path);
                return res.status(400).json({ error: 'Invalid or corrupted image file' });
            }
        }
        next();
    } catch (error) {
        return res.status(500).json({ error: 'File validation failed' });
    }
};

// Audit logging middleware
const auditLogger = (action) => {
    return (req, res, next) => {
        // Store audit information in request for later logging
        req.auditLog = {
            action,
            user_id: req.session.user?.id,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            timestamp: new Date(),
            resource: req.originalUrl
        };
        next();
    };
};

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            frameSrc: ["https://www.google.com"],
        },
    },
    crossOriginEmbedderPolicy: false
});

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
    // Skip CSRF for API endpoints or if disabled
    if (req.path.startsWith('/api/') || process.env.DISABLE_CSRF === 'true') {
        return next();
    }
    
    // Generate CSRF token if not exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        console.log('🔐 Generated new CSRF token:', req.session.csrfToken.substring(0, 8) + '...');
    }
    
    // Make token available to views
    res.locals.csrfToken = req.session.csrfToken;
    
    // Validate CSRF token on POST requests
    if (req.method === 'POST') {
        const token = req.body._csrf || req.headers['x-csrf-token'];
        
        console.log('🔍 CSRF Validation:', {
            hasSessionToken: !!req.session.csrfToken,
            sessionTokenPreview: req.session.csrfToken ? req.session.csrfToken.substring(0, 8) + '...' : 'none',
            hasSubmittedToken: !!token,
            submittedTokenPreview: token ? token.substring(0, 8) + '...' : 'none',
            tokensMatch: token === req.session.csrfToken,
            method: req.method,
            path: req.path
        });
        
        if (!token) {
            console.log('❌ CSRF Error: No token provided');
            return res.status(403).json({ error: 'CSRF token missing' });
        }
        
        if (!req.session.csrfToken) {
            console.log('❌ CSRF Error: No session token');
            return res.status(403).json({ error: 'Session expired. Please refresh the page.' });
        }
        
        if (token !== req.session.csrfToken) {
            console.log('❌ CSRF Error: Token mismatch');
            return res.status(403).json({ error: 'Invalid CSRF token. Please refresh the page and try again.' });
        }
        
        console.log('✅ CSRF validation passed');
    }
    
    next();
};

// Suspicious activity detection
const detectSuspiciousActivity = (req, res, next) => {
    const suspiciousPatterns = [
        /script|javascript|onclick|onload|onerror/i,
        /<iframe|<object|<embed|<link/i,
        /union.*select|insert.*into|drop.*table/i,
        /\.\.\//g // Path traversal
    ];
    
    // Check all request body values
    const checkValue = (value) => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        return false;
    };
    
    // Recursively check object properties
    const checkObject = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                if (checkObject(obj[key])) return true;
            } else if (checkValue(obj[key])) {
                return true;
            }
        }
        return false;
    };
    
    if (checkObject(req.body) || checkObject(req.query)) {
        console.warn('Suspicious activity detected:', {
            ip: req.ip,
            user: req.session.user?.id,
            url: req.originalUrl,
            body: req.body
        });
        return res.status(400).json({ error: 'Suspicious content detected' });
    }
    
    next();
};

module.exports = {
    rateLimiters,
    moderateContent,
    validateUserRegistration,
    validateUploadedImages,
    auditLogger,
    securityHeaders,
    csrfProtection,
    detectSuspiciousActivity,
    sanitizeText,
    validationSchemas
}; 