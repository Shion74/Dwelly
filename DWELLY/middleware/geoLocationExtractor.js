const axios = require('axios');

// Google Maps and Apple Maps URL patterns
const MAP_URL_PATTERNS = {
    googleMaps: [
        // Standard Google Maps URLs
        /https?:\/\/(?:www\.)?google\.com\/maps\/.*[@,](-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /https?:\/\/(?:www\.)?google\.com\/maps\/place\/.*@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /https?:\/\/maps\.google\.com\/.*[@,](-?\d+\.?\d*),(-?\d+\.?\d*)/,
        
        // Google Maps search format (from expanded shortened URLs)
        /https?:\/\/(?:www\.)?google\.com\/maps\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/,
        
        // Google Maps shortened URLs (maps.app.goo.gl)
        /https?:\/\/maps\.app\.goo\.gl\/\w+/,
        
        // Google Plus codes
        /https?:\/\/(?:www\.)?google\.com\/maps\/.*\/([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,6})/,
        
        // Google Maps with place_id
        /https?:\/\/(?:www\.)?google\.com\/maps\/.*place_id:([A-Za-z0-9_-]+)/
    ],
    appleMaps: [
        // Apple Maps URLs
        /https?:\/\/maps\.apple\.com\/.*ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /https?:\/\/maps\.apple\.com\/.*[@,](-?\d+\.?\d*),(-?\d+\.?\d*)/
    ]
};

// Geocoding service configuration (you'll need API keys)
const GEOCODING_CONFIG = {
    google: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        baseUrl: 'https://maps.googleapis.com/maps/api/geocode/json'
    },
    nominatim: {
        baseUrl: 'https://nominatim.openstreetmap.org/reverse',
        userAgent: 'Dwelly-Housing-App/1.0'
    }
};

/**
 * Extract coordinates and location from various map URLs
 */
const extractLocationFromMapUrl = async (mapUrl) => {
    try {
        console.log('🗺️ Extracting location from URL:', mapUrl);

        // First, try to extract coordinates directly from URL
        let coordinates = extractCoordinatesFromUrl(mapUrl);
        
        // If no direct coordinates, try to resolve shortened URLs
        if (!coordinates && isGoogleShortenedUrl(mapUrl)) {
            console.log('📱 Detected shortened Google Maps URL, trying to expand...');
            const expandedUrl = await expandShortenedUrl(mapUrl);
            if (expandedUrl) {
                console.log('✅ URL expanded successfully, extracting coordinates...');
                coordinates = extractCoordinatesFromUrl(expandedUrl);
            } else {
                console.log('⚠️ Could not expand URL, trying alternative methods...');
                
                // Alternative: Try to get location from the shortened URL directly
                // Some shortened URLs might work with our existing patterns
                const alternativeCoords = await tryAlternativeExtraction(mapUrl);
                if (alternativeCoords) {
                    coordinates = alternativeCoords;
                }
            }
        }

        // If we have coordinates, get detailed location info
        if (coordinates) {
            console.log('📍 Found coordinates:', coordinates);
            const locationDetails = await reverseGeocode(coordinates.lat, coordinates.lng);
            return {
                success: true,
                coordinates: coordinates,
                location: locationDetails,
                source: 'url_extraction'
            };
        }

        // If no coordinates found, try place search
        console.log('🔍 No coordinates found, trying place search...');
        const placeInfo = extractPlaceFromUrl(mapUrl);
        if (placeInfo) {
            console.log('🏪 Found place name:', placeInfo);
            const searchResult = await searchPlace(placeInfo);
            if (searchResult) {
                return {
                    success: true,
                    coordinates: searchResult.coordinates,
                    location: searchResult.location,
                    source: 'place_search'
                };
            }
        }

        // Final fallback: For shortened URLs, try a different approach
        if (isGoogleShortenedUrl(mapUrl)) {
            console.log('🔄 Trying final fallback for shortened URL...');
            const fallbackResult = await tryShortUrlFallback(mapUrl);
            if (fallbackResult) {
                return fallbackResult;
            }
        }

        console.log('❌ All extraction methods failed');
        return {
            success: false,
            error: 'Could not extract location from URL',
            coordinates: null,
            location: null
        };

    } catch (error) {
        console.error('💥 Error extracting location from map URL:', error);
        return {
            success: false,
            error: error.message,
            coordinates: null,
            location: null
        };
    }
};

/**
 * Extract coordinates directly from URL patterns
 */
const extractCoordinatesFromUrl = (url) => {
    // Try Google Maps patterns
    for (const pattern of MAP_URL_PATTERNS.googleMaps) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            // Validate coordinates are reasonable for Philippines
            if (isValidPhilippinesCoordinates(lat, lng)) {
                return { lat, lng };
            }
        }
    }

    // Try Apple Maps patterns
    for (const pattern of MAP_URL_PATTERNS.appleMaps) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            if (isValidPhilippinesCoordinates(lat, lng)) {
                return { lat, lng };
            }
        }
    }

    return null;
};

/**
 * Check if coordinates are within Philippines bounds
 */
const isValidPhilippinesCoordinates = (lat, lng) => {
    // Philippines approximate bounds
    const bounds = {
        north: 21.0,
        south: 4.0,
        east: 127.0,
        west: 116.0
    };

    return lat >= bounds.south && lat <= bounds.north && 
           lng >= bounds.west && lng <= bounds.east;
};

/**
 * Check if URL is a Google shortened URL
 */
const isGoogleShortenedUrl = (url) => {
    return /https?:\/\/maps\.app\.goo\.gl\//.test(url);
};

/**
 * Expand shortened Google Maps URLs
 */
const expandShortenedUrl = async (shortUrl) => {
    try {
        console.log('🔗 Expanding shortened URL:', shortUrl);
        
        // Try multiple approaches to expand the URL
        
        // Method 1: Follow redirects naturally
        try {
            const response = await axios.get(shortUrl, {
                maxRedirects: 5,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (response.request.res.responseUrl) {
                console.log('✅ Expanded URL (method 1):', response.request.res.responseUrl);
                return response.request.res.responseUrl;
            }
        } catch (error) {
            console.log('⚠️ Method 1 failed:', error.message);
        }

        // Method 2: Use HEAD request to get redirect location
        try {
            const headResponse = await axios.head(shortUrl, {
                maxRedirects: 0,
                timeout: 5000,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (headResponse.headers.location) {
                console.log('✅ Expanded URL (method 2):', headResponse.headers.location);
                return headResponse.headers.location;
            }
        } catch (error) {
            if (error.response && error.response.headers.location) {
                console.log('✅ Expanded URL (method 2 redirect):', error.response.headers.location);
                return error.response.headers.location;
            }
            console.log('⚠️ Method 2 failed:', error.message);
        }

        // Method 3: Try to construct the URL manually if it's a goo.gl format
        if (shortUrl.includes('maps.app.goo.gl')) {
            // Sometimes we can try extracting from the final redirect manually
            try {
                const response = await axios.get(shortUrl, {
                    maxRedirects: 0,
                    timeout: 5000,
                    validateStatus: () => true
                });
                
                if (response.headers.location) {
                    console.log('✅ Expanded URL (method 3):', response.headers.location);
                    return response.headers.location;
                }
            } catch (error) {
                console.log('⚠️ Method 3 failed:', error.message);
            }
        }

        console.log('❌ All URL expansion methods failed');
        return null;
        
    } catch (error) {
        console.error('💥 Error expanding shortened URL:', error.message);
        return null;
    }
};

/**
 * Extract place name from URL for searching
 */
const extractPlaceFromUrl = (url) => {
    // Extract place names from Google Maps URLs
    const placePatterns = [
        /https?:\/\/(?:www\.)?google\.com\/maps\/place\/([^\/]+)/,
        /https?:\/\/maps\.google\.com\/.*\/([^\/]+)@/
    ];

    for (const pattern of placePatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return decodeURIComponent(match[1].replace(/\+/g, ' '));
        }
    }

    return null;
};

/**
 * Search for a place using geocoding services
 */
const searchPlace = async (placeName) => {
    try {
        // Try Google Geocoding API first (if API key available)
        if (GEOCODING_CONFIG.google.apiKey) {
            const googleResult = await searchPlaceGoogle(placeName);
            if (googleResult) return googleResult;
        }

        // Fallback to Nominatim (OpenStreetMap)
        return await searchPlaceNominatim(placeName);

    } catch (error) {
        console.error('Error searching place:', error);
        return null;
    }
};

/**
 * Search place using Google Geocoding API
 */
const searchPlaceGoogle = async (placeName) => {
    try {
        const response = await axios.get(GEOCODING_CONFIG.google.baseUrl, {
            params: {
                address: `${placeName}, Philippines`,
                key: GEOCODING_CONFIG.google.apiKey,
                region: 'ph'
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            const location = result.geometry.location;
            
            return {
                coordinates: { lat: location.lat, lng: location.lng },
                location: parseGoogleGeocodingResult(result)
            };
        }

        return null;
    } catch (error) {
        console.error('Google Geocoding error:', error);
        return null;
    }
};

/**
 * Search place using Nominatim (OpenStreetMap)
 */
const searchPlaceNominatim = async (placeName) => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: `${placeName}, Philippines`,
                format: 'json',
                limit: 1,
                countrycodes: 'ph'
            },
            headers: {
                'User-Agent': GEOCODING_CONFIG.nominatim.userAgent
            }
        });

        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            
            return {
                coordinates: { 
                    lat: parseFloat(result.lat), 
                    lng: parseFloat(result.lon) 
                },
                location: parseNominatimResult(result)
            };
        }

        return null;
    } catch (error) {
        console.error('Nominatim search error:', error);
        return null;
    }
};

/**
 * Reverse geocode coordinates to get location details
 */
const reverseGeocode = async (lat, lng) => {
    try {
        // Try Google Reverse Geocoding first (if API key available)
        if (GEOCODING_CONFIG.google.apiKey) {
            const googleResult = await reverseGeocodeGoogle(lat, lng);
            if (googleResult) return googleResult;
        }

        // Fallback to Nominatim
        return await reverseGeocodeNominatim(lat, lng);

    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return {
            street: '',
            barangay: '',
            city: 'Davao City',
            province: 'Davao del Sur',
            country: 'Philippines'
        };
    }
};

/**
 * Reverse geocode using Google API
 */
const reverseGeocodeGoogle = async (lat, lng) => {
    try {
        const response = await axios.get(GEOCODING_CONFIG.google.baseUrl, {
            params: {
                latlng: `${lat},${lng}`,
                key: GEOCODING_CONFIG.google.apiKey,
                result_type: 'street_address|sublocality|locality'
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            return parseGoogleGeocodingResult(response.data.results[0]);
        }

        return null;
    } catch (error) {
        console.error('Google reverse geocoding error:', error);
        return null;
    }
};

/**
 * Reverse geocode using Nominatim
 */
const reverseGeocodeNominatim = async (lat, lng) => {
    try {
        const response = await axios.get(GEOCODING_CONFIG.nominatim.baseUrl, {
            params: {
                lat: lat,
                lon: lng,
                format: 'json',
                addressdetails: 1,
                zoom: 18
            },
            headers: {
                'User-Agent': GEOCODING_CONFIG.nominatim.userAgent
            }
        });

        if (response.data) {
            return parseNominatimResult(response.data);
        }

        return null;
    } catch (error) {
        console.error('Nominatim reverse geocoding error:', error);
        return null;
    }
};

/**
 * Parse Google Geocoding API result
 */
const parseGoogleGeocodingResult = (result) => {
    const components = result.address_components || [];
    const location = {
        street: '',
        barangay: '',
        city: 'Davao City',
        province: 'Davao del Sur',
        country: 'Philippines'
    };

    components.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number') || types.includes('route')) {
            location.street = location.street ? 
                `${component.long_name} ${location.street}`.trim() : 
                component.long_name;
        }
        
        if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
            location.barangay = component.long_name;
        }
        
        if (types.includes('locality') || types.includes('administrative_area_level_2')) {
            location.city = component.long_name;
        }
        
        if (types.includes('administrative_area_level_1')) {
            location.province = component.long_name;
        }
        
        if (types.includes('country')) {
            location.country = component.long_name;
        }
    });

    return location;
};

/**
 * Parse Nominatim result
 */
const parseNominatimResult = (result) => {
    const address = result.address || {};
    
    return {
        street: [
            address.house_number,
            address.road || address.street
        ].filter(Boolean).join(' '),
        
        barangay: address.suburb || address.village || address.neighbourhood || '',
        
        city: address.city || address.town || address.municipality || 'Davao City',
        
        province: address.state || address.province || 'Davao del Sur',
        
        country: address.country || 'Philippines'
    };
};

/**
 * Middleware to extract location from map URL in request
 */
const extractLocationMiddleware = async (req, res, next) => {
    try {
        const { maps_link } = req.body;
        
        if (maps_link && maps_link.trim()) {
            console.log('🗺️ Processing map link:', maps_link);
            
            const extractedLocation = await extractLocationFromMapUrl(maps_link.trim());
            
            if (extractedLocation.success) {
                // Auto-populate coordinates if not provided
                if (!req.body.latitude && extractedLocation.coordinates) {
                    req.body.latitude = extractedLocation.coordinates.lat;
                }
                if (!req.body.longitude && extractedLocation.coordinates) {
                    req.body.longitude = extractedLocation.coordinates.lng;
                }
                
                // Auto-populate location fields if not provided
                if (extractedLocation.location) {
                    if (!req.body.street && extractedLocation.location.street) {
                        req.body.street = extractedLocation.location.street;
                    }
                    if (!req.body.barangay && extractedLocation.location.barangay) {
                        req.body.barangay = extractedLocation.location.barangay;
                    }
                    if (!req.body.city && extractedLocation.location.city) {
                        req.body.city = extractedLocation.location.city;
                    }
                }
                
                // Store extraction info for logging
                req.locationExtraction = extractedLocation;
                
                console.log('✅ Location extracted successfully:', {
                    coordinates: extractedLocation.coordinates,
                    location: extractedLocation.location
                });
            } else {
                console.log('⚠️ Could not extract location from map URL:', extractedLocation.error);
                req.locationExtraction = extractedLocation;
            }
        }
        
        next();
    } catch (error) {
        console.error('Error in location extraction middleware:', error);
        // Continue with request even if extraction fails
        next();
    }
};

/**
 * Validate map URL format
 */
const isValidMapUrl = (url) => {
    const allPatterns = [
        ...MAP_URL_PATTERNS.googleMaps,
        ...MAP_URL_PATTERNS.appleMaps
    ];
    
    return allPatterns.some(pattern => pattern.test(url));
};

/**
 * Try alternative extraction methods when URL expansion fails
 */
const tryAlternativeExtraction = async (mapUrl) => {
    try {
        // Sometimes shortened URLs contain hints in their redirect chain
        // Try to make a simple request and see if we get any location data
        const response = await axios.get(mapUrl, {
            timeout: 5000,
            maxRedirects: 1,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LocationBot/1.0)'
            }
        });

        // Check if the response contains any coordinate patterns
        const coordinates = extractCoordinatesFromUrl(response.request.res.responseUrl || response.config.url);
        return coordinates;
        
    } catch (error) {
        console.log('⚠️ Alternative extraction failed:', error.message);
        return null;
    }
};

/**
 * Final fallback for shortened URLs - provide helpful guidance
 */
const tryShortUrlFallback = async (mapUrl) => {
    try {
        // For now, we'll return a helpful error message
        // In the future, this could try other services or approaches
        console.log('🔄 Fallback method: shortened URL cannot be processed automatically');
        
        return {
            success: false,
            error: 'Shortened URLs require manual expansion. Please use the full Google Maps URL instead.',
            coordinates: null,
            location: null,
            suggestion: 'Try opening the link in Google Maps and copying the full URL from the address bar'
        };
        
    } catch (error) {
        return null;
    }
};

module.exports = {
    extractLocationFromMapUrl,
    extractLocationMiddleware,
    isValidMapUrl,
    extractCoordinatesFromUrl,
    reverseGeocode,
    searchPlace,
    isValidPhilippinesCoordinates
}; 