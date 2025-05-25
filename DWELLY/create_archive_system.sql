-- Archive System for Dwelly Application
-- This script creates archive tables to preserve data when posts or users are deleted

-- Archive table for posts
CREATE TABLE IF NOT EXISTS archived_posts (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    type_id INT,
    title VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    street VARCHAR(255),
    barangay VARCHAR(255),
    city VARCHAR(255),
    building_name VARCHAR(255),
    unit_number VARCHAR(50),
    landlord_name VARCHAR(255),
    contact_number VARCHAR(20),
    social_link TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    maps_link TEXT,
    search_keywords TEXT,
    price_range VARCHAR(50),
    status VARCHAR(50),
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_by INT,
    deletion_reason VARCHAR(255),
    INDEX idx_original_post_id (post_id),
    INDEX idx_deleted_by (deleted_by),
    INDEX idx_deleted_at (deleted_at)
);

-- Archive table for users
CREATE TABLE IF NOT EXISTS archived_users (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    id_number VARCHAR(50),
    phone_number VARCHAR(20),
    course_id INT,
    department_id INT,
    year_level VARCHAR(10),
    role ENUM('student', 'staff', 'admin') DEFAULT 'student',
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_by INT,
    deletion_reason VARCHAR(255),
    INDEX idx_original_user_id (user_id),
    INDEX idx_deleted_by (deleted_by),
    INDEX idx_deleted_at (deleted_at)
);

-- Archive table for photos
CREATE TABLE IF NOT EXISTS archived_photos (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    photo_id INT NOT NULL,
    post_id INT NOT NULL,
    file_path VARCHAR(255),
    created_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Archive table for post amenities
CREATE TABLE IF NOT EXISTS archived_post_amenities (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    amenity_id INT NOT NULL,
    post_id INT NOT NULL,
    amenity_name VARCHAR(255),
    amenity_type ENUM('default', 'custom') DEFAULT 'default',
    created_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Archive table for rooms
CREATE TABLE IF NOT EXISTS archived_rooms (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    post_id INT NOT NULL,
    number_of_rooms INT,
    bathroom_type ENUM('private', 'shared'),
    room_type VARCHAR(100),
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Archive table for favorites
CREATE TABLE IF NOT EXISTS archived_favorites (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    favorite_id INT NOT NULL,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_user_id (user_id),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Archive table for ratings
CREATE TABLE IF NOT EXISTS archived_ratings (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    rating_id INT NOT NULL,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    stars INT,
    comment TEXT,
    created_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_user_id (user_id),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Archive table for reports
CREATE TABLE IF NOT EXISTS archived_reports (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    reporter_id INT NOT NULL,
    post_id INT NOT NULL,
    report_type VARCHAR(100),
    type VARCHAR(100),
    reason TEXT,
    description TEXT,
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(255),
    INDEX idx_original_reporter_id (reporter_id),
    INDEX idx_original_post_id (post_id),
    INDEX idx_archived_at (archived_at)
);

-- Create views for easy access to archived data with complete information
CREATE OR REPLACE VIEW archived_post_complete AS
SELECT 
    ap.*,
    au.full_name as poster_name,
    au.email as poster_email,
    GROUP_CONCAT(DISTINCT aph.file_path) as photos,
    GROUP_CONCAT(DISTINCT apa.amenity_name) as amenities,
    ar.number_of_rooms,
    ar.bathroom_type,
    ar.room_type
FROM archived_posts ap
LEFT JOIN archived_users au ON ap.user_id = au.user_id
LEFT JOIN archived_photos aph ON ap.post_id = aph.post_id
LEFT JOIN archived_post_amenities apa ON ap.post_id = apa.post_id
LEFT JOIN archived_rooms ar ON ap.post_id = ar.post_id
GROUP BY ap.archive_id;

CREATE OR REPLACE VIEW archived_user_complete AS
SELECT 
    au.*,
    COUNT(DISTINCT ap.post_id) as archived_posts_count,
    COUNT(DISTINCT af.favorite_id) as archived_favorites_count,
    COUNT(DISTINCT art.rating_id) as archived_ratings_count,
    COUNT(DISTINCT arep.report_id) as archived_reports_count
FROM archived_users au
LEFT JOIN archived_posts ap ON au.user_id = ap.user_id
LEFT JOIN archived_favorites af ON au.user_id = af.user_id
LEFT JOIN archived_ratings art ON au.user_id = art.user_id
LEFT JOIN archived_reports arep ON au.user_id = arep.reporter_id
GROUP BY au.archive_id; 