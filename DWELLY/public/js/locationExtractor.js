/**
 * Frontend Location Extractor
 * Provides real-time feedback for map URL input and location extraction
 */

class LocationExtractor {
    constructor() {
        this.mapLinkInput = null;
        this.coordinateInputs = {};
        this.locationInputs = {};
        this.statusElement = null;
        this.extractButton = null;
        
        this.init();
    }

    init() {
        // Find relevant input elements
        this.mapLinkInput = document.querySelector('input[name="maps_link"]');
        
        this.coordinateInputs = {
            latitude: document.querySelector('input[name="latitude"]'),
            longitude: document.querySelector('input[name="longitude"]')
        };
        
        this.locationInputs = {
            street: document.querySelector('input[name="street"]'),
            barangay: document.querySelector('input[name="barangay"]'),
            city: document.querySelector('input[name="city"]')
        };

        if (this.mapLinkInput) {
            this.setupMapLinkHandling();
            this.createStatusElement();
            this.createExtractButton();
        }
    }

    setupMapLinkHandling() {
        // Real-time validation as user types/pastes
        this.mapLinkInput.addEventListener('input', this.debounce(() => {
            this.validateMapUrl();
        }, 500));

        // Handle paste events specifically
        this.mapLinkInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.validateMapUrl();
                this.showExtractButton();
            }, 100);
        });

        // Handle form submission
        const form = this.mapLinkInput.closest('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                this.handleFormSubmission(e);
            });
        }
    }

    createStatusElement() {
        // Create status display element
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'map-link-status mt-2';
        this.statusElement.style.fontSize = '0.875rem';
        
        // Insert after the map link input
        this.mapLinkInput.parentNode.insertBefore(
            this.statusElement, 
            this.mapLinkInput.nextSibling
        );
    }

    createExtractButton() {
        // Create extract location button
        this.extractButton = document.createElement('button');
        this.extractButton.type = 'button';
        this.extractButton.className = 'btn btn-outline-primary btn-sm mt-2';
        this.extractButton.innerHTML = '📍 Extract Location from Map Link';
        this.extractButton.style.display = 'none';
        
        this.extractButton.addEventListener('click', () => {
            this.extractLocationFromUrl();
        });

        // Insert after status element
        this.statusElement.parentNode.insertBefore(
            this.extractButton,
            this.statusElement.nextSibling
        );
    }

    validateMapUrl() {
        const url = this.mapLinkInput.value.trim();
        
        if (!url) {
            this.updateStatus('', '');
            this.hideExtractButton();
            return;
        }

        if (this.isValidMapUrl(url)) {
            this.updateStatus('✅ Valid map URL detected', 'text-success');
            this.showExtractButton();
        } else {
            this.updateStatus('⚠️ Please enter a valid Google Maps or Apple Maps URL', 'text-warning');
            this.hideExtractButton();
        }
    }

    isValidMapUrl(url) {
        const patterns = [
            // Google Maps patterns
            /https?:\/\/(?:www\.)?google\.com\/maps/,
            /https?:\/\/maps\.google\.com/,
            /https?:\/\/maps\.app\.goo\.gl/,
            // Apple Maps patterns
            /https?:\/\/maps\.apple\.com/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    async extractLocationFromUrl() {
        const url = this.mapLinkInput.value.trim();
        
        if (!url || !this.isValidMapUrl(url)) {
            this.updateStatus('❌ Please enter a valid map URL first', 'text-danger');
            return;
        }

        // Show loading state
        this.extractButton.disabled = true;
        this.extractButton.innerHTML = '⏳ Extracting location...';
        this.updateStatus('🔍 Extracting location data from map URL...', 'text-info');

        try {
            // Get CSRF token
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value;
            console.log('CSRF Token found:', !!csrfToken);
            
            // Make API call to extract location
            const response = await fetch('/api/extract-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ maps_link: url })
            });

            console.log('API Response status:', response.status);
            console.log('API Response headers:', response.headers);

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Non-JSON response received:', contentType);
                throw new Error(`Server returned non-JSON response: ${response.status}`);
            }

            const result = await response.json();
            console.log('API Response data:', result);

            if (response.ok && result.success) {
                this.populateLocationFields(result);
                this.updateStatus('✅ Location extracted successfully!', 'text-success');
            } else {
                const errorMsg = result.error || `Server error: ${response.status}`;
                this.updateStatus(`❌ Could not extract location: ${errorMsg}`, 'text-danger');
                console.error('API Error:', result);
            }

        } catch (error) {
            console.error('Error extracting location:', error);
            this.updateStatus(`❌ Error extracting location: ${error.message}`, 'text-danger');
        } finally {
            // Reset button state
            this.extractButton.disabled = false;
            this.extractButton.innerHTML = '📍 Extract Location from Map Link';
        }
    }

    populateLocationFields(result) {
        const { coordinates, location } = result;

        // Populate coordinates
        if (coordinates) {
            if (this.coordinateInputs.latitude && !this.coordinateInputs.latitude.value) {
                this.coordinateInputs.latitude.value = coordinates.lat;
                this.animateFieldUpdate(this.coordinateInputs.latitude);
            }
            
            if (this.coordinateInputs.longitude && !this.coordinateInputs.longitude.value) {
                this.coordinateInputs.longitude.value = coordinates.lng;
                this.animateFieldUpdate(this.coordinateInputs.longitude);
            }

            // Trigger map update when coordinates are populated
            this.updateMapLocation(coordinates.lat, coordinates.lng);
        }

        // Populate location details
        if (location) {
            if (this.locationInputs.street && !this.locationInputs.street.value && location.street) {
                this.locationInputs.street.value = location.street;
                this.animateFieldUpdate(this.locationInputs.street);
            }
            
            if (this.locationInputs.barangay && !this.locationInputs.barangay.value && location.barangay) {
                this.locationInputs.barangay.value = location.barangay;
                this.animateFieldUpdate(this.locationInputs.barangay);
            }
            
            if (this.locationInputs.city && !this.locationInputs.city.value && location.city) {
                this.locationInputs.city.value = location.city;
                this.animateFieldUpdate(this.locationInputs.city);
            }
        }

        // Show what was filled
        const filledFields = [];
        if (coordinates) filledFields.push('coordinates');
        if (location?.street) filledFields.push('street');
        if (location?.barangay) filledFields.push('barangay');
        if (location?.city) filledFields.push('city');

        if (filledFields.length > 0) {
            this.updateStatus(
                `✅ Auto-filled: ${filledFields.join(', ')} + map updated`, 
                'text-success'
            );
        }
    }

    updateMapLocation(lat, lng) {
        // Trigger a custom event that the map can listen to
        const mapUpdateEvent = new CustomEvent('locationExtracted', {
            detail: {
                latitude: lat,
                longitude: lng
            }
        });
        
        document.dispatchEvent(mapUpdateEvent);
        
        // Also trigger the 'change' event on coordinate inputs to maintain compatibility
        // with existing map integration code
        if (this.coordinateInputs.latitude) {
            this.coordinateInputs.latitude.dispatchEvent(new Event('change'));
        }
        if (this.coordinateInputs.longitude) {
            this.coordinateInputs.longitude.dispatchEvent(new Event('change'));
        }
        
        console.log('🗺️ Map location update triggered:', { lat, lng });
    }

    animateFieldUpdate(field) {
        // Add visual feedback when field is auto-filled
        field.style.transition = 'all 0.3s ease';
        field.style.backgroundColor = '#d4edda';
        field.style.borderColor = '#28a745';
        
        setTimeout(() => {
            field.style.backgroundColor = '';
            field.style.borderColor = '';
        }, 2000);
    }

    updateStatus(message, className) {
        this.statusElement.textContent = message;
        this.statusElement.className = `map-link-status mt-2 ${className}`;
    }

    showExtractButton() {
        if (this.extractButton) {
            this.extractButton.style.display = 'inline-block';
        }
    }

    hideExtractButton() {
        if (this.extractButton) {
            this.extractButton.style.display = 'none';
        }
    }

    handleFormSubmission(e) {
        // Optional: validate that location extraction was attempted
        const url = this.mapLinkInput.value.trim();
        
        if (url && this.isValidMapUrl(url)) {
            // Check if coordinates are missing
            const hasCoords = this.coordinateInputs.latitude?.value && 
                             this.coordinateInputs.longitude?.value;
            
            if (!hasCoords) {
                // Show warning but don't prevent submission
                this.updateStatus(
                    '⚠️ Consider extracting location data for better accuracy', 
                    'text-warning'
                );
            }
        }
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Example map URLs for user reference
const EXAMPLE_MAP_URLS = {
    google: [
        'https://www.google.com/maps/place/SM+City+Davao/@7.0724147,125.61276,17z',
        'https://maps.app.goo.gl/ABC123xyz',
        'https://www.google.com/maps/@7.0724147,125.61276,15z'
    ],
    apple: [
        'https://maps.apple.com/?ll=7.0724147,125.61276',
        'https://maps.apple.com/?address=SM%20City%20Davao'
    ]
};

// Function to show example URLs
function showMapUrlExamples() {
    const examples = [
        ...EXAMPLE_MAP_URLS.google,
        ...EXAMPLE_MAP_URLS.apple
    ];

    const examplesText = examples.join('\n');
    
    alert(`Supported Map URL formats:\n\n${examplesText}\n\nJust copy and paste any Google Maps or Apple Maps link!`);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LocationExtractor();
    
    // Add help text for map URL input
    const mapLinkInput = document.querySelector('input[name="maps_link"]');
    if (mapLinkInput) {
        // Add placeholder text
        mapLinkInput.placeholder = 'Paste Google Maps or Apple Maps link here...';
        
        // Add help link
        const helpLink = document.createElement('small');
        helpLink.className = 'form-text text-muted';
        helpLink.innerHTML = `
            <a href="#" onclick="showMapUrlExamples(); return false;">
                ℹ️ What map URLs are supported?
            </a>
        `;
        
        mapLinkInput.parentNode.appendChild(helpLink);
    }
});

// Make showMapUrlExamples available globally
window.showMapUrlExamples = showMapUrlExamples; 