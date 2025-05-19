// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const mainNav = document.querySelector('.main-nav');
const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

if (mobileMenuToggle && mainNav && mobileMenuOverlay) {
    mobileMenuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        mobileMenuOverlay.classList.toggle('active');
    });

    mobileMenuOverlay.addEventListener('click', () => {
        mainNav.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
    });
}

// Alert Messages
const closeAlertButtons = document.querySelectorAll('.close-alert');

closeAlertButtons.forEach(button => {
    button.addEventListener('click', () => {
        const alert = button.parentElement;
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    });
});

// Auto-hide alerts after 5 seconds
const alerts = document.querySelectorAll('.alert');

alerts.forEach(alert => {
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 5000);
});

// Listing Gallery
const galleryMain = document.querySelector('.listing-gallery-main img');
const galleryThumbs = document.querySelectorAll('.listing-gallery-thumb img');

if (galleryMain && galleryThumbs.length > 0) {
    galleryThumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            // Update main image
            galleryMain.src = thumb.src;
            
            // Update active state
            galleryThumbs.forEach(t => t.parentElement.classList.remove('active'));
            thumb.parentElement.classList.add('active');
        });
    });
}

// Rating Stars
const ratingStars = document.querySelectorAll('.rating-star');
const ratingInput = document.querySelector('input[name="rating"]');

if (ratingStars.length > 0 && ratingInput) {
    ratingStars.forEach((star, index) => {
        star.addEventListener('click', () => {
            const rating = index + 1;
            ratingInput.value = rating;
            
            // Update stars display
            ratingStars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });

        // Hover effect
        star.addEventListener('mouseenter', () => {
            const rating = index + 1;
            ratingStars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    // Reset stars on mouse leave
    const ratingContainer = document.querySelector('.rating-stars');
    if (ratingContainer) {
        ratingContainer.addEventListener('mouseleave', () => {
            const currentRating = parseInt(ratingInput.value) || 0;
            ratingStars.forEach((s, i) => {
                if (i < currentRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    }
}

// Form Validation
const forms = document.querySelectorAll('form');

forms.forEach(form => {
    form.addEventListener('submit', (e) => {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('is-invalid');
            } else {
                field.classList.remove('is-invalid');
            }
        });

        if (!isValid) {
            e.preventDefault();
        }
    });
});

// Image Upload Preview
const imageInput = document.querySelector('input[type="file"][accept="image/*"]');
const imagePreview = document.querySelector('.image-preview');

if (imageInput && imagePreview) {
    imageInput.addEventListener('change', () => {
        const files = imageInput.files;
        imagePreview.innerHTML = '';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.classList.add('preview-image');
                    imagePreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        }
    });
}

// Search Form
const searchForm = document.querySelector('.search-form');
const searchInput = document.querySelector('.search-input');

if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
        if (!searchInput.value.trim()) {
            e.preventDefault();
            searchInput.classList.add('is-invalid');
        } else {
            searchInput.classList.remove('is-invalid');
        }
    });
}

// Favorites Toggle
document.addEventListener('DOMContentLoaded', function() {
    // Handle favorite button clicks
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        // Remove any existing event listeners by cloning the button
        const newFavoriteBtn = favoriteBtn.cloneNode(true);
        favoriteBtn.parentNode.replaceChild(newFavoriteBtn, favoriteBtn);
        
        newFavoriteBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const listingId = this.dataset.postId;
            if (!listingId) {
                console.error('No listing ID found');
                return;
            }

            try {
                const response = await fetch(`/listings/${listingId}/favorite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to toggle favorite');
                }

                const data = await response.json();
                
                // Update button state
                this.classList.toggle('active');
                this.querySelector('i').classList.toggle('fas');
                this.querySelector('i').classList.toggle('far');
                
                // Update favorite count if it exists
                const favoriteCount = document.querySelector('.favorite-count');
                if (favoriteCount) {
                    favoriteCount.textContent = data.action === 'added' ? 
                        parseInt(favoriteCount.textContent) + 1 : 
                        parseInt(favoriteCount.textContent) - 1;
                }

                // If we're on the favorites page, remove the card if unfavorited
                if (data.action === 'removed' && window.location.pathname === '/favorites') {
                    const card = this.closest('.listing-card');
                    if (card) {
                        card.style.opacity = '0';
                        setTimeout(() => {
                            card.remove();
                            // Check if there are any listings left
                            const remainingCards = document.querySelectorAll('.listing-card');
                            if (remainingCards.length === 0) {
                                const grid = document.querySelector('.listings-grid');
                                if (grid) {
                                    grid.innerHTML = `
                                        <div class="empty-state">
                                            <h2>No Favorite Listings Yet</h2>
                                            <p>Start adding listings to your favorites!</p>
                                        </div>
                                    `;
                                }
                            }
                        }, 300);
                    }
                }
            } catch (error) {
                console.error('Error toggling favorite:', error);
                alert('Failed to update favorite status. Please try again.');
            }
        });
    }

    // Handle rate button clicks
    const rateBtn = document.getElementById('rateBtn');
    if (rateBtn) {
        rateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Add rating functionality here
            console.log('Rate button clicked');
        });
    }

    // Handle report button clicks
    const reportBtn = document.getElementById('reportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Add report functionality here
            console.log('Report button clicked');
        });
    }
});

// Report Listing
const reportForm = document.querySelector('.report-form');
const reportModal = document.querySelector('.report-modal');

if (reportForm && reportModal) {
    const openReportModal = (listingId) => {
        reportForm.dataset.listingId = listingId;
        reportModal.classList.add('active');
    };

    const closeReportModal = () => {
        reportModal.classList.remove('active');
    };

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const listingId = reportForm.dataset.listingId;
        const formData = new FormData(reportForm);

        try {
            const response = await fetch(`/listings/${listingId}/report`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                closeReportModal();
                // Show success message
                const alert = document.createElement('div');
                alert.classList.add('alert', 'alert-success');
                alert.textContent = 'Report submitted successfully';
                document.querySelector('.main-content').prepend(alert);
            }
        } catch (error) {
            console.error('Error submitting report:', error);
        }
    });

    // Close modal when clicking outside
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            closeReportModal();
        }
    });
}

// Infinite Scroll for Listings
const listingsGrid = document.querySelector('.listings-grid');
const loadMoreButton = document.querySelector('.load-more');

if (listingsGrid && loadMoreButton) {
    let page = 1;
    let loading = false;

    const loadMoreListings = async () => {
        if (loading) return;
        loading = true;

        try {
            const response = await fetch(`/listings?page=${page + 1}`);
            const data = await response.json();

            if (data.listings.length > 0) {
                data.listings.forEach(listing => {
                    const listingCard = createListingCard(listing);
                    listingsGrid.appendChild(listingCard);
                });
                page++;
            } else {
                loadMoreButton.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading more listings:', error);
        }

        loading = false;
    };

    loadMoreButton.addEventListener('click', loadMoreListings);

    // Create listing card element
    function createListingCard(listing) {
        const card = document.createElement('div');
        card.classList.add('card');
        card.innerHTML = `
            <img src="${listing.image}" class="card-img-top" alt="${listing.title}">
            <div class="card-body">
                <h5 class="card-title">${listing.title}</h5>
                <p class="card-text">${listing.description}</p>
                <div class="listing-meta">
                    <span><i class="fas fa-bed"></i> ${listing.bedrooms}</span>
                    <span><i class="fas fa-bath"></i> ${listing.bathrooms}</span>
                    <span><i class="fas fa-ruler-combined"></i> ${listing.area} sq ft</span>
                </div>
                <div class="card-footer">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="price">$${listing.price}/month</span>
                        <a href="/listings/${listing.id}" class="btn btn-primary">View Details</a>
                    </div>
                </div>
            </div>
        `;
        return card;
    }
}

// Map Initialization
async function initializeMap() {
    try {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            throw new Error('Leaflet library not loaded!');
        }

        // Get the map container
        const mapContainer = document.getElementById('listingsMap');
        if (!mapContainer) {
            console.log('No map container found on this page');
            return; // No map container on this page
        }

        console.log('Map container found:', mapContainer);

        // Remove loading indicator
        const loadingIndicator = mapContainer.querySelector('.map-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        // Get listings data from the page
        const listingsData = window.listingsData;
        console.log('Listings data:', listingsData);
        
        if (!listingsData || !listingsData.length) {
            mapContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">No listings with location data available</div>';
            return;
        }

        // Initialize map centered on Davao City
        const map = L.map('listingsMap', {
            center: [7.0633, 125.5956],
            zoom: 14,
            zoomControl: true,
            attributionControl: true
        });
        console.log('Map created');
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        console.log('Tile layer added');

        // Add markers for each listing with coordinates
        let markersAdded = 0;
        const listingsWithCoords = listingsData.filter(l => l.latitude && l.longitude);
        console.log('Listings with coordinates:', listingsWithCoords);

        if (listingsWithCoords.length === 0) {
            mapContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">No listings with location data available</div>';
            return;
        }

        // Create a bounds object to fit all markers
        const bounds = L.latLngBounds(listingsWithCoords.map(l => [l.latitude, l.longitude]));
        
        listingsWithCoords.forEach(listing => {
            console.log('Adding marker for listing:', listing.post_id, 'at', listing.latitude, listing.longitude);
            const marker = L.marker([listing.latitude, listing.longitude]).addTo(map);
            marker.bindPopup(`
                <strong>${listing.type}</strong><br>
                ₱${listing.price ? listing.price.toLocaleString() : 'Price not set'}/month<br>
                ${listing.barangay}, ${listing.city}<br>
                <a href="/listings/${listing.post_id}">View Details</a>
            `);
            markersAdded++;
        });

        // Fit map to show all markers
        map.fitBounds(bounds, { padding: [50, 50] });

        console.log('Total markers added:', markersAdded);

    } catch (error) {
        console.error('Error initializing map:', error);
        const mapContainer = document.getElementById('listingsMap');
        if (mapContainer) {
            mapContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: red;">Error loading map: ' + error.message + '</div>';
        }
    }
}

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize map if we're on a page with a map
    if (document.getElementById('listingsMap')) {
        console.log('Map container found, initializing map...');
        initializeMap();
    } else {
        console.log('No map container found on this page');
    }
}); 