const express = require('express');
const router = express.Router();
const { extractLocationFromMapUrl } = require('../middleware/geoLocationExtractor');
const { auditLogger } = require('../middleware/security');

// Basic rate limiting for public endpoints
const rateLimit = require('express-rate-limit');

// Rate limiter for location extraction (more generous since it's a utility)
const locationExtractionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        success: false,
        error: 'Too many location extraction requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware for API routes that require authentication
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

/**
 * Extract location from map URL
 * POST /api/extract-location
 * Note: This endpoint allows unauthenticated access for utility purposes
 */
router.post('/extract-location', locationExtractionLimiter, auditLogger('location_extraction'), async (req, res) => {
    try {
        console.log('📍 Location extraction API called');
        console.log('User:', req.session.user ? `${req.session.user.id} (${req.session.user.full_name})` : 'Anonymous');
        console.log('Request body:', req.body);
        console.log('Headers:', {
            'content-type': req.headers['content-type'],
            'x-csrf-token': req.headers['x-csrf-token'] ? 'Present' : 'Missing'
        });

        const { maps_link } = req.body;

        if (!maps_link || !maps_link.trim()) {
            console.log('❌ No map URL provided');
            return res.status(400).json({
                success: false,
                error: 'Map URL is required'
            });
        }

        console.log('🔍 Extracting location from URL:', maps_link.trim());

        // Extract location from the provided URL
        const result = await extractLocationFromMapUrl(maps_link.trim());

        console.log('📊 Extraction result:', result);

        if (result.success) {
            console.log('✅ Location extraction successful');
            res.json({
                success: true,
                coordinates: result.coordinates,
                location: result.location,
                source: result.source
            });
        } else {
            console.log('❌ Location extraction failed:', result.error);
            res.status(400).json({
                success: false,
                error: result.error || 'Could not extract location from URL'
            });
        }

    } catch (error) {
        console.error('💥 API location extraction error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during location extraction'
        });
    }
});

/**
 * Reverse geocode coordinates to get address
 * POST /api/reverse-geocode
 */
router.post('/reverse-geocode', isAuthenticated, auditLogger('reverse_geocode'), async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Validate coordinate format
        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinate format'
            });
        }

        // Validate coordinates are within reasonable bounds
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                error: 'Coordinates out of valid range'
            });
        }

        const { reverseGeocode } = require('../middleware/geoLocationExtractor');
        const locationDetails = await reverseGeocode(lat, lng);

        res.json({
            success: true,
            location: locationDetails,
            coordinates: { lat, lng }
        });

    } catch (error) {
        console.error('API reverse geocoding error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during reverse geocoding'
        });
    }
});

/**
 * Search for places
 * GET /api/search-places?q=place+name
 */
router.get('/search-places', isAuthenticated, auditLogger('place_search'), async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || !q.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        const { searchPlace } = require('../middleware/geoLocationExtractor');
        const result = await searchPlace(q.trim());

        if (result) {
            res.json({
                success: true,
                coordinates: result.coordinates,
                location: result.location
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No results found for the search query'
            });
        }

    } catch (error) {
        console.error('API place search error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during place search'
        });
    }
});

/**
 * Validate map URL format
 * POST /api/validate-map-url
 */
router.post('/validate-map-url', isAuthenticated, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !url.trim()) {
            return res.json({
                valid: false,
                error: 'URL is required'
            });
        }

        const { isValidMapUrl } = require('../middleware/geoLocationExtractor');
        const isValid = isValidMapUrl(url.trim());

        res.json({
            valid: isValid,
            url: url.trim(),
            message: isValid ? 'Valid map URL' : 'Invalid map URL format'
        });

    } catch (error) {
        console.error('API URL validation error:', error);
        res.status(500).json({
            valid: false,
            error: 'Error validating URL'
        });
    }
});

/**
 * Get location extraction statistics
 * GET /api/location-stats
 */
router.get('/location-stats', isAuthenticated, async (req, res) => {
    try {
        const pool = require('../config/database');
        
        // Get statistics about location extractions
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_extractions,
                COUNT(CASE WHEN details->>'$.response_status' = '200' THEN 1 END) as successful_extractions,
                COUNT(CASE WHEN action_type = 'location_extraction' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as extractions_today,
                COUNT(CASE WHEN action_type = 'location_extraction' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as extractions_week
            FROM security_audit_logs 
            WHERE action_type = 'location_extraction'
        `);

        const [recentExtractions] = await pool.query(`
            SELECT 
                user_id,
                resource,
                status,
                created_at
            FROM security_audit_logs 
            WHERE action_type = 'location_extraction'
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: stats[0] || {
                total_extractions: 0,
                successful_extractions: 0,
                extractions_today: 0,
                extractions_week: 0
            },
            recentExtractions
        });

    } catch (error) {
        console.error('Error fetching location stats:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching statistics'
        });
    }
});

module.exports = router; 