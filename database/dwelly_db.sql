-- Drop database if exists and create new one
DROP DATABASE IF EXISTS dwelly_db;
CREATE DATABASE dwelly_db;
USE dwelly_db;

-- Create departments table
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Create courses table
CREATE TABLE courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    UNIQUE KEY unique_course_dept (name, department_id)
);

-- Create room_types table
CREATE TABLE room_types (
    type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
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

-- Create users table
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    id_number CHAR(10) NOT NULL UNIQUE,
    role ENUM('student', 'staff') NOT NULL,
    year_level ENUM('1st', '2nd', '3rd', '4th', '5th', '6th'),
    department_id INT,
    course_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- Create posts table
CREATE TABLE posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    description TEXT,
    city VARCHAR(100) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    street VARCHAR(100) NOT NULL,
    landlord_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    social_link VARCHAR(255),
    maps_link VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE RESTRICT
);

-- Create photos table
CREATE TABLE photos (
    photo_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create favorites table
CREATE TABLE favorites (
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create ratings table
CREATE TABLE ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_rating (user_id, post_id)
);

-- Create reports table
CREATE TABLE reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_report (reporter_id, post_id)
);

-- Create admins table
CREATE TABLE admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
INSERT INTO admins (email, password, name) VALUES 
('admin@dwelly.com', 'admin123', 'System Admin'); 