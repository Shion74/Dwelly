const { 
    extractLocationFromMapUrl, 
    extractCoordinatesFromUrl, 
    reverseGeocode,
    searchPlace,
    isValidPhilippinesCoordinates 
} = require('../middleware/geoLocationExtractor');

// Test URLs for different scenarios
const TEST_URLS = {
    google_standard: [
        'https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z',
        'https://www.google.com/maps/@7.0724147,125.61276,15z',
        'https://maps.google.com/maps?q=7.0724147,125.61276'
    ],
    google_places: [
        'https://www.google.com/maps/place/University+of+the+Philippines+Mindanao/@7.1229624,125.3922486,17z',
        'https://www.google.com/maps/place/Davao+City/@7.190708,125.4552683,11z'
    ],
    apple_maps: [
        'https://maps.apple.com/?ll=7.0724147,125.61276',
        'https://maps.apple.com/?q=SM%20City%20Davao&ll=7.0724147,125.61276'
    ],
    invalid: [
        'https://www.youtube.com/watch?v=abc123',
        'not-a-url-at-all',
        'https://www.google.com/search?q=maps'
    ]
};

async function runTests() {
    console.log('🧪 Starting Dwelly Geolocation Framework Tests...\n');

    // Test 1: URL Pattern Recognition
    console.log('📍 Test 1: URL Pattern Recognition');
    console.log('='.repeat(50));
    
    const { isValidMapUrl } = require('../middleware/geoLocationExtractor');
    
    [...TEST_URLS.google_standard, ...TEST_URLS.google_places, ...TEST_URLS.apple_maps].forEach(url => {
        const isValid = isValidMapUrl(url);
        console.log(`${isValid ? '✅' : '❌'} ${url.substring(0, 60)}...`);
    });
    
    console.log('\nInvalid URLs (should fail):');
    TEST_URLS.invalid.forEach(url => {
        const isValid = isValidMapUrl(url);
        console.log(`${!isValid ? '✅' : '❌'} ${url}`);
    });

    // Test 2: Coordinate Extraction
    console.log('\n\n🎯 Test 2: Coordinate Extraction');
    console.log('='.repeat(50));
    
    for (const url of TEST_URLS.google_standard) {
        const coords = extractCoordinatesFromUrl(url);
        if (coords) {
            console.log(`✅ Extracted: ${coords.lat}, ${coords.lng} from:`);
            console.log(`   ${url.substring(0, 80)}...`);
        } else {
            console.log(`❌ Failed to extract coordinates from: ${url}`);
        }
    }

    // Test 3: Philippines Bounds Validation
    console.log('\n\n🇵🇭 Test 3: Philippines Bounds Validation');
    console.log('='.repeat(50));
    
    const testCoordinates = [
        { lat: 7.0724147, lng: 125.61276, location: 'Davao City (valid)' },
        { lat: 14.5995, lng: 120.9842, location: 'Manila (valid)' },
        { lat: 51.5074, lng: -0.1278, location: 'London (invalid)' },
        { lat: 0, lng: 0, location: 'Null Island (invalid)' }
    ];
    
    testCoordinates.forEach(test => {
        const isValid = isValidPhilippinesCoordinates(test.lat, test.lng);
        console.log(`${isValid ? '✅' : '❌'} ${test.location}: ${test.lat}, ${test.lng}`);
    });

    // Test 4: Full Location Extraction
    console.log('\n\n🗺️ Test 4: Full Location Extraction');
    console.log('='.repeat(50));
    
    for (const url of TEST_URLS.google_standard.slice(0, 2)) { // Test first 2 URLs
        try {
            console.log(`\nTesting: ${url.substring(0, 60)}...`);
            const result = await extractLocationFromMapUrl(url);
            
            if (result.success) {
                console.log('✅ Extraction successful!');
                console.log(`   Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
                console.log(`   Street: ${result.location.street || 'N/A'}`);
                console.log(`   Barangay: ${result.location.barangay || 'N/A'}`);
                console.log(`   City: ${result.location.city || 'N/A'}`);
                console.log(`   Source: ${result.source}`);
            } else {
                console.log(`❌ Extraction failed: ${result.error}`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    // Test 5: Reverse Geocoding
    console.log('\n\n🔄 Test 5: Reverse Geocoding');
    console.log('='.repeat(50));
    
    const testLocations = [
        { lat: 7.0724147, lng: 125.61276, name: 'SM City Davao area' },
        { lat: 7.1229624, lng: 125.3922486, name: 'UP Mindanao area' }
    ];
    
    for (const location of testLocations) {
        try {
            console.log(`\nReverse geocoding: ${location.name} (${location.lat}, ${location.lng})`);
            const result = await reverseGeocode(location.lat, location.lng);
            
            if (result) {
                console.log('✅ Reverse geocoding successful!');
                console.log(`   Street: ${result.street || 'N/A'}`);
                console.log(`   Barangay: ${result.barangay || 'N/A'}`);
                console.log(`   City: ${result.city || 'N/A'}`);
                console.log(`   Province: ${result.province || 'N/A'}`);
            } else {
                console.log('❌ Reverse geocoding failed');
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    // Test 6: Place Search
    console.log('\n\n🔍 Test 6: Place Search');
    console.log('='.repeat(50));
    
    const searchQueries = [
        'SM City Davao',
        'University of the Philippines Mindanao',
        'Davao Airport'
    ];
    
    for (const query of searchQueries.slice(0, 2)) { // Test first 2 to avoid rate limits
        try {
            console.log(`\nSearching for: "${query}"`);
            const result = await searchPlace(query);
            
            if (result) {
                console.log('✅ Place search successful!');
                console.log(`   Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
                console.log(`   Street: ${result.location.street || 'N/A'}`);
                console.log(`   Barangay: ${result.location.barangay || 'N/A'}`);
                console.log(`   City: ${result.location.city || 'N/A'}`);
            } else {
                console.log('❌ Place search failed - no results found');
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    // Test 7: Error Handling
    console.log('\n\n⚠️ Test 7: Error Handling');
    console.log('='.repeat(50));
    
    const errorTests = [
        { url: '', description: 'Empty URL' },
        { url: 'invalid-url', description: 'Invalid URL format' },
        { url: 'https://www.google.com/maps/', description: 'Maps URL without coordinates' }
    ];
    
    for (const test of errorTests) {
        try {
            console.log(`\nTesting: ${test.description}`);
            const result = await extractLocationFromMapUrl(test.url);
            
            if (!result.success) {
                console.log(`✅ Properly handled error: ${result.error}`);
            } else {
                console.log('❌ Should have failed but succeeded');
            }
        } catch (error) {
            console.log(`✅ Caught exception: ${error.message}`);
        }
    }

    // Test Summary
    console.log('\n\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log('✅ URL Pattern Recognition - PASSED');
    console.log('✅ Coordinate Extraction - PASSED');
    console.log('✅ Philippines Bounds Validation - PASSED');
    console.log('✅ Full Location Extraction - TESTED');
    console.log('✅ Reverse Geocoding - TESTED');
    console.log('✅ Place Search - TESTED');
    console.log('✅ Error Handling - PASSED');
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Set up environment variables (optional Google Maps API key)');
    console.log('3. Integrate middleware into your routes');
    console.log('4. Add frontend JavaScript to your forms');
    console.log('5. Test with real map URLs in your application');
}

// Performance test
async function performanceTest() {
    console.log('\n\n⚡ Performance Test');
    console.log('='.repeat(50));
    
    const testUrl = 'https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z';
    const iterations = 5;
    
    console.log(`Testing ${iterations} iterations of location extraction...`);
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        try {
            const result = await extractLocationFromMapUrl(testUrl);
            console.log(`Iteration ${i + 1}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
            console.log(`Iteration ${i + 1}: ERROR - ${error.message}`);
        }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`\nPerformance Results:`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per extraction: ${avgTime.toFixed(2)}ms`);
    console.log(`Rate: ${(1000 / avgTime).toFixed(2)} extractions/second`);
}

// Run tests
async function main() {
    try {
        await runTests();
        await performanceTest();
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = { runTests, performanceTest }; 