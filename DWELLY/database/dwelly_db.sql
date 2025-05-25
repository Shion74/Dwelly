-- Drop database if exists and create new one
DROP DATABASE IF EXISTS dwelly_db;
CREATE DATABASE dwelly_db;
USE dwelly_db;

-- Create departments table
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create courses table
CREATE TABLE courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    UNIQUE KEY unique_course_dept (name, department_id)
);

-- Create room_types table
CREATE TABLE room_types (
    type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default room types
INSERT INTO room_types (type_name, display_name) VALUES
('condo', 'Condo'),
('apartment', 'Apartment'),
('dorm', 'Dormitory'),
('house', 'House'),
('studio', 'Studio'),
('bedspace', 'Bedspace');

-- Create users table with admin role
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    id_number CHAR(10) NOT NULL UNIQUE,
    role ENUM('student', 'staff', 'admin') NOT NULL,
    year_level ENUM('1st', '2nd', '3rd', '4th', '5th', '6th'),
    department_id INT,
    course_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Create posts table with availability status
CREATE TABLE posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    description TEXT,
    -- Search-related columns
    search_keywords TEXT,
    -- Detailed address fields
    city VARCHAR(100) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    street VARCHAR(100) NOT NULL,
    building_name VARCHAR(100),
    unit_number VARCHAR(50),
    -- Contact information
    landlord_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    social_link VARCHAR(255),
    maps_link VARCHAR(255),
    -- Location coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    price DECIMAL(10,2),
    -- Price range for filtering
    price_range ENUM('below_3000', '3000_to_5000', '5000_to_8000', '8000_to_12000', 'above_12000'),
    availability_status ENUM('available', 'rented', 'reserved') DEFAULT 'available',
    -- Status for advanced reporting/archiving
    status ENUM('available', 'occupied', 'archived') NOT NULL DEFAULT 'available',
    is_flagged BOOLEAN DEFAULT FALSE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE RESTRICT,
    -- Indexes for location-based searches
    INDEX idx_location_city (city),
    INDEX idx_location_barangay (barangay),
    INDEX idx_user (user_id),
    INDEX idx_coordinates (latitude, longitude),
    -- Fulltext index for search
    FULLTEXT INDEX idx_search (description, search_keywords, city, barangay, street)
);

-- Create rooms table for room details and amenities
CREATE TABLE rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    number_of_rooms INT NOT NULL,
    bathroom_type ENUM('common', 'own') NOT NULL,
    room_type ENUM('bare', 'semi_furnished', 'furnished') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
);

-- Create post_amenities table for custom amenities per post
CREATE TABLE post_amenities (
    amenity_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    amenity_name VARCHAR(100) NOT NULL,
    amenity_type ENUM('default', 'custom') DEFAULT 'custom',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id),
    INDEX idx_type (amenity_type)
);

-- Create contacts table for post contacts
CREATE TABLE contacts (
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    contact_type ENUM('phone', 'social', 'email') NOT NULL,
    contact_value VARCHAR(255) NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
);

-- Create photos table with featured flag
CREATE TABLE photos (
    photo_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE,
    photo_order INT DEFAULT 0,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
);

-- Create favorites table
CREATE TABLE favorites (
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create ratings table with rating types
CREATE TABLE ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_rating (user_id, post_id),
    INDEX idx_post (post_id)
);

-- Create reports table
CREATE TABLE reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT NOT NULL,
    type ENUM('occupied', 'scam', 'other') NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_report (reporter_id, post_id),
    INDEX idx_post (post_id)
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action_type ENUM('create', 'update', 'delete', 'block', 'unblock') NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    old_values JSON,
    new_values JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_admin (admin_id),
    INDEX idx_table_record (table_name, record_id)
);

-- Create notifications table
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('report', 'rating', 'favorite', 'system') NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Insert initial department data
INSERT INTO departments (name) VALUES 
('ATYCB'),
('CAS'),
('CCIS'),
('CEA'),
('CHS');

-- Insert initial course data
INSERT INTO courses (name, department_id) VALUES 
-- ATYCB Courses
('BS Entrepreneurship', 1),
('BS Management Accounting', 1),
('BS Real Estate Management', 1),
('BS Tourism Management', 1),
('BS Accountancy', 1),

-- CAS Courses
('BS Communication', 2),
('BS Multimedia Arts', 2),

-- CCIS Courses
('BS Computer Science', 3),
('BS Entertainment Multimedia Computing', 3),
('BS Information Systems', 3),

-- CEA Courses
('BS Architecture', 4),
('BS Chemical Engineering', 4),
('BS Civil Engineering', 4),
('BS Computer Engineering', 4),
('BS Electrical Engineering', 4),
('BS Electronics Engineering', 4),
('BS Industrial Engineering', 4),
('BS Mechanical Engineering', 4),

-- CHS Courses
('BS Biology', 5),
('BS Psychology', 5),
('BS Pharmacy', 5),
('BS Physical Therapy', 5);

-- Create a default admin account (password should be hashed in the application)
INSERT INTO users (email, password, full_name, role, id_number, phone_number) VALUES 
('admin@dwelly.com', '$2b$10$eRov6e4cRZfk9CFmCBuiTusd9MkXzZvaar2hddxvNKFHUjdamIhbm', 'System Admin', 'admin', 'ADMIN0001', '1234567890');

-- Create triggers to automatically update price_range based on price
DELIMITER $$

CREATE TRIGGER update_price_range
BEFORE INSERT ON posts
FOR EACH ROW
BEGIN
    IF NEW.price IS NOT NULL THEN
        IF NEW.price < 3000 THEN
            SET NEW.price_range = 'below_3000';
        ELSEIF NEW.price <= 5000 THEN
            SET NEW.price_range = '3000_to_5000';
        ELSEIF NEW.price <= 8000 THEN
            SET NEW.price_range = '5000_to_8000';
        ELSEIF NEW.price <= 12000 THEN
            SET NEW.price_range = '8000_to_12000';
        ELSE
            SET NEW.price_range = 'above_12000';
        END IF;
    END IF;
END$$

CREATE TRIGGER update_price_range_on_update
BEFORE UPDATE ON posts
FOR EACH ROW
BEGIN
    IF NEW.price IS NOT NULL THEN
        IF NEW.price < 3000 THEN
            SET NEW.price_range = 'below_3000';
        ELSEIF NEW.price <= 5000 THEN
            SET NEW.price_range = '3000_to_5000';
        ELSEIF NEW.price <= 8000 THEN
            SET NEW.price_range = '5000_to_8000';
        ELSEIF NEW.price <= 12000 THEN
            SET NEW.price_range = '8000_to_12000';
        ELSE
            SET NEW.price_range = 'above_12000';
        END IF;
    END IF;
END$$

DELIMITER ; 