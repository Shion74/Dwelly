-- Create the database
CREATE DATABASE IF NOT EXISTS dwelly_db;
USE dwelly_db;

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    id_number CHAR(10) NOT NULL UNIQUE,
    role ENUM('student', 'staff') NOT NULL,
    year_level ENUM('1st', '2nd', '3rd', '4th', '5th', '6th'),
    department_id INT,
    course_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('Condo', 'Apartment', 'Dorm', 'Studio', 'Pad') NOT NULL,
    description TEXT,
    city VARCHAR(100) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    street VARCHAR(100) NOT NULL,
    landlord_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    social_link VARCHAR(255),
    maps_link VARCHAR(255) NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
    photo_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_rating (user_id, post_id)
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id),
    UNIQUE KEY unique_user_post_report (reporter_id, post_id)
);

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
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
('Communication', 2),
('Multimedia Arts', 2),

-- CCIS Courses
('Computer Science', 3),
('Entertainment Multimedia Computing', 3),
('Information Systems', 3),

-- CEA Courses
('Architecture', 4),
('Chemical Engineering', 4),
('Civil Engineering', 4),
('Computer Engineering', 4),
('Electrical Engineering', 4),
('Electronics Engineering', 4),
('Industrial Engineering', 4),
('Mechanical Engineering', 4),

-- CHS Courses
('BS Biology', 5),
('BS Psychology', 5),
('BS Pharmacy', 5),
('BS Physical Therapy', 5);

-- Create a default admin account (password should be hashed in the application)
INSERT INTO admins (email, password, name) VALUES 
('admin@dwelly.com', 'admin123', 'System Admin'); 