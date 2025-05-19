-- Migration: Add post_amenities table for custom amenities per post

CREATE TABLE IF NOT EXISTS post_amenities (
    amenity_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    amenity_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
); 