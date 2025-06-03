# Dwelly Geolocation Extraction Framework

## Overview

This framework automatically extracts latitude, longitude, and location details (street, barangay, city) from Google Maps and Apple Maps URLs. It provides both backend processing and frontend user interface enhancements.

## Features

### 🗺️ **Supported Map URLs**
- **Google Maps**: Standard URLs, shortened URLs (maps.app.goo.gl), place URLs
- **Apple Maps**: Standard URLs with coordinates and place links
- **Automatic Expansion**: Resolves shortened URLs to extract coordinates
- **Philippines Focus**: Validates coordinates are within Philippines bounds

### 🎯 **Auto-Extraction Capabilities**
- **Coordinates**: Latitude and longitude from URL patterns
- **Reverse Geocoding**: Convert coordinates to address details
- **Place Search**: Find coordinates from place names
- **Location Details**: Street, barangay, city, province extraction

### 🔄 **Integration Options**
- **Automatic**: Process map URLs during form submission
- **Manual**: User-triggered extraction via frontend button
- **API**: Real-time extraction via AJAX calls

## Installation & Setup

### 1. Install Dependencies

The framework requires `axios` for HTTP requests:

```bash
npm install axios
```

### 2. Environment Configuration

Add these optional environment variables to your `.env` file:

```bash
# Google Maps API Key (optional, improves accuracy)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# If you don't have a Google Maps API key, the system will use free OpenStreetMap services
```

### 3. Update Routes

#### Add API Routes to app.js

```javascript
// Add this to your app.js after other route definitions
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);
```

#### Update Listing Routes

Add the geolocation middleware to your listing creation/editing routes:

```javascript
// In routes/listings.js
const { extractLocationMiddleware } = require('../middleware/geoLocationExtractor');

// Add to create listing route
router.post('/create', 
    isAuthenticated, 
    extractLocationMiddleware,  // Add this line
    moderatePostCreation, 
    upload.array('photos', 6), 
    validateUploadedImages, 
    auditLogger('post_create'), 
    async (req, res) => {
        // Your existing create logic
        // The middleware will auto-populate req.body with extracted location data
    }
);

// Add to edit listing route
router.post('/:id/edit', 
    isAuthenticated, 
    extractLocationMiddleware,  // Add this line
    moderateContent,
    upload.array('new_photos', 6), 
    validateUploadedImages,
    auditLogger('post_edit'), 
    async (req, res) => {
        // Your existing edit logic
    }
);
```

### 4. Frontend Integration

#### Include the Location Extractor Script

Add this to your create/edit listing templates (e.g., `views/listings/create.ejs`):

```html
<!-- Add before closing </body> tag -->
<script src="/js/locationExtractor.js"></script>
```

#### Update Your Forms

Make sure your forms include the required input fields:

```html
<form action="/listings/create" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
    
    <!-- Map Link Input -->
    <div class="form-group">
        <label for="maps_link">Map Link (Optional)</label>
        <input type="url" 
               class="form-control" 
               id="maps_link" 
               name="maps_link"
               placeholder="Paste Google Maps or Apple Maps link here...">
        <!-- The JavaScript will add status messages and extract button here -->
    </div>
    
    <!-- Location Fields (will be auto-populated) -->
    <div class="form-group">
        <label for="street">Street Address</label>
        <input type="text" class="form-control" id="street" name="street" required>
    </div>
    
    <div class="form-group">
        <label for="barangay">Barangay</label>
        <input type="text" class="form-control" id="barangay" name="barangay" required>
    </div>
    
    <div class="form-group">
        <label for="city">City</label>
        <input type="text" class="form-control" id="city" name="city" value="Davao City" required>
    </div>
    
    <!-- Coordinate Fields (will be auto-populated) -->
    <div class="row">
        <div class="col-md-6">
            <div class="form-group">
                <label for="latitude">Latitude</label>
                <input type="number" 
                       class="form-control" 
                       id="latitude" 
                       name="latitude" 
                       step="any" 
                       min="4" 
                       max="21">
            </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
                <label for="longitude">Longitude</label>
                <input type="number" 
                       class="form-control" 
                       id="longitude" 
                       name="longitude" 
                       step="any" 
                       min="116" 
                       max="127">
            </div>
        </div>
    </div>
    
    <!-- Other form fields -->
    
    <button type="submit" class="btn btn-primary">Create Listing</button>
</form>
```

## How It Works

### 1. Automatic Processing (Backend)

When a form is submitted with a `maps_link` field, the `extractLocationMiddleware` automatically:

```javascript
// Example: User submits form with this map link
maps_link: "https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z"

// Middleware extracts and populates:
req.body.latitude = 7.0724147
req.body.longitude = 125.61276
req.body.street = "J.P. Laurel Avenue"
req.body.barangay = "Bajada"
req.body.city = "Davao City"
```

### 2. Manual Extraction (Frontend)

Users can extract location manually by:
1. Pasting a map URL
2. Clicking the "📍 Extract Location from Map Link" button
3. Watching fields auto-populate with extracted data

### 3. Real-time Validation

The frontend provides immediate feedback:
- ✅ "Valid map URL detected" for supported URLs
- ⚠️ "Please enter a valid Google Maps or Apple Maps URL" for invalid URLs
- 🔍 "Extracting location data..." during processing
- ✅ "Auto-filled: coordinates, street, barangay, city" on success

## Supported URL Formats

### Google Maps URLs

```javascript
// Standard Google Maps URLs
"https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z"
"https://www.google.com/maps/@7.0724147,125.61276,15z"
"https://maps.google.com/maps?q=7.0724147,125.61276"

// Shortened Google Maps URLs
"https://maps.app.goo.gl/ABC123xyz"

// Google Maps with place_id
"https://www.google.com/maps/place/place_id:ChIJN5X_gWdMQTIRcOBiOgHGowA"
```

### Apple Maps URLs

```javascript
// Apple Maps with coordinates
"https://maps.apple.com/?ll=7.0724147,125.61276"
"https://maps.apple.com/?q=SM%20City%20Davao&ll=7.0724147,125.61276"

// Apple Maps with address
"https://maps.apple.com/?address=SM%20City%20Davao,%20Davao%20City"
```

## API Endpoints

The framework provides several API endpoints for advanced usage:

### Extract Location from URL
```javascript
POST /api/extract-location
Content-Type: application/json

{
    "maps_link": "https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z"
}

// Response:
{
    "success": true,
    "coordinates": {
        "lat": 7.0724147,
        "lng": 125.61276
    },
    "location": {
        "street": "J.P. Laurel Avenue",
        "barangay": "Bajada",
        "city": "Davao City",
        "province": "Davao del Sur",
        "country": "Philippines"
    },
    "source": "url_extraction"
}
```

### Reverse Geocode Coordinates
```javascript
POST /api/reverse-geocode
Content-Type: application/json

{
    "latitude": 7.0724147,
    "longitude": 125.61276
}

// Response:
{
    "success": true,
    "location": {
        "street": "J.P. Laurel Avenue",
        "barangay": "Bajada",
        "city": "Davao City",
        "province": "Davao del Sur",
        "country": "Philippines"
    },
    "coordinates": {
        "lat": 7.0724147,
        "lng": 125.61276
    }
}
```

### Search Places
```javascript
GET /api/search-places?q=SM+City+Davao

// Response:
{
    "success": true,
    "coordinates": {
        "lat": 7.0724147,
        "lng": 125.61276
    },
    "location": {
        "street": "J.P. Laurel Avenue",
        "barangay": "Bajada",
        "city": "Davao City",
        "province": "Davao del Sur",
        "country": "Philippines"
    }
}
```

## Error Handling

The framework gracefully handles various error scenarios:

### Common Errors
- **Invalid URL Format**: "Please enter a valid Google Maps or Apple Maps URL"
- **Coordinates Out of Bounds**: "Coordinates out of valid range"
- **Network Issues**: "Error extracting location. Please try again."
- **No Results Found**: "Could not extract location from URL"

### Fallback Behavior
- If Google Maps API key is not provided, falls back to free OpenStreetMap services
- If location extraction fails, form submission continues normally
- Users can always manually enter location details

## Testing

### Test Map URLs

Use these URLs to test the extraction functionality:

```javascript
// Test URLs for different scenarios
const testUrls = [
    // Davao City locations
    "https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z",
    "https://www.google.com/maps/place/University+of+the+Philippines+Mindanao/@7.1229624,125.3922486,17z",
    "https://www.google.com/maps/place/Davao+City/@7.190708,125.4552683,11z",
    
    // Apple Maps
    "https://maps.apple.com/?ll=7.0724147,125.61276",
    
    // Shortened URL (will need actual shortened URL)
    "https://maps.app.goo.gl/example123"
];
```

### Manual Testing Steps

1. **Create a New Listing**
2. **Paste a map URL** into the "Map Link" field
3. **Verify** you see "✅ Valid map URL detected"
4. **Click** "📍 Extract Location from Map Link"
5. **Check** that coordinates and location fields are auto-populated
6. **Submit** the form and verify data is saved correctly

## Performance Considerations

### Optimization Features
- **Debounced Validation**: Real-time URL validation with 500ms delay
- **Coordinate Validation**: Filters coordinates to Philippines bounds
- **Caching**: Consider implementing Redis cache for frequently requested locations
- **Rate Limiting**: API endpoints include rate limiting via security middleware

### API Limits
- **Google Maps API**: Requires API key for production use (paid service)
- **OpenStreetMap Nominatim**: Free but rate-limited (1 request/second)
- **Shortened URL Expansion**: No API limits

## Troubleshooting

### Common Issues

1. **"Could not extract location from URL"**
   - Check if URL is properly formatted
   - Verify URL contains actual coordinates or place information
   - Try a different map URL format

2. **Coordinates not within Philippines**
   - System filters coordinates to Philippines bounds (4°-21°N, 116°-127°E)
   - Use a map URL pointing to a Philippines location

3. **Frontend button not appearing**
   - Ensure `locationExtractor.js` is loaded
   - Check browser console for JavaScript errors
   - Verify input field names match expected values

4. **API endpoints returning 401**
   - Ensure user is logged in
   - Check CSRF token is included in requests

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will show detailed extraction logs in the console.

## Security Features

The geolocation framework includes several security measures:

- **Input Validation**: All URLs and coordinates are validated
- **Rate Limiting**: API endpoints are rate-limited
- **Audit Logging**: All extraction attempts are logged
- **CSRF Protection**: API endpoints require valid CSRF tokens
- **Authentication**: All API endpoints require user authentication

## Future Enhancements

Potential improvements to consider:

1. **Batch Processing**: Extract locations from multiple URLs at once
2. **Location History**: Save frequently used locations
3. **Offline Support**: Cache common Philippine locations
4. **Map Integration**: Show extracted location on interactive map
5. **Auto-correction**: Suggest corrections for invalid coordinates
6. **Mobile Optimization**: Enhanced mobile URL detection

## Conclusion

This geolocation extraction framework provides a seamless way for users to quickly and accurately populate location data by simply pasting map URLs. It reduces data entry errors and improves the overall user experience while maintaining strong security and performance standards.

For support or feature requests, refer to the middleware files or create an issue in your project repository. 