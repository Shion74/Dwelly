-- This is your initial schema migration
-- All your existing tables from dwelly_db.sql should be here
-- This ensures we have a baseline for future migrations

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    UNIQUE KEY unique_course_dept (name, department_id)
);

-- Create room_types table
CREATE TABLE IF NOT EXISTS room_types (
    type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    description TEXT,
    city VARCHAR(100) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    street VARCHAR(100) NOT NULL,
    building_name VARCHAR(100),
    unit_number VARCHAR(50),
    landlord_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    social_link VARCHAR(255),
    maps_link VARCHAR(255),
    price DECIMAL(10,2),
    availability_status ENUM('available', 'rented', 'reserved') DEFAULT 'available',
    is_flagged BOOLEAN DEFAULT FALSE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE RESTRICT,
    INDEX idx_location_city (city),
    INDEX idx_location_barangay (barangay),
    INDEX idx_user (user_id)
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    contact_type ENUM('phone', 'social', 'email') NOT NULL,
    contact_value VARCHAR(255) NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
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
CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    rating_type ENUM('overall', 'cleanliness', 'landlord', 'price', 'location') NOT NULL,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_rating (user_id, post_id, rating_type),
    INDEX idx_post (post_id)
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_report (reporter_id, post_id),
    INDEX idx_post (post_id)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('report', 'rating', 'favorite', 'system') NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
); 