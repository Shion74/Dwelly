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
const favoriteButtons = document.querySelectorAll('.favorite-toggle');

favoriteButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        const listingId = button.dataset.listingId;
        
        try {
            const response = await fetch(`/listings/${listingId}/favorite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                button.classList.toggle('active');
                button.querySelector('i').classList.toggle('fas');
                button.querySelector('i').classList.toggle('far');
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    });
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