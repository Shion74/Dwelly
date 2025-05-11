-- Migration: Add rooms table with amenities and map coordinates
-- Date: 2024-03-21

-- Create rooms table with amenities
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    number_of_rooms INT NOT NULL,
    has_wifi BOOLEAN DEFAULT FALSE,
    has_cctv BOOLEAN DEFAULT FALSE,
    bathroom_type ENUM('common', 'own') NOT NULL,
    is_airconditioned BOOLEAN DEFAULT FALSE,
    room_type ENUM('bare', 'semi_furnished', 'furnished') NOT NULL,
    has_parking BOOLEAN DEFAULT FALSE,
    has_own_electricity BOOLEAN DEFAULT FALSE,
    has_own_water BOOLEAN DEFAULT FALSE,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
);

-- Add map coordinates to posts table if they don't exist
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) AFTER maps_link,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) AFTER latitude;

-- Add search-related columns to posts table if they don't exist
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS search_keywords TEXT AFTER description;

-- Add fulltext index if it doesn't exist
CREATE FULLTEXT INDEX IF NOT EXISTS idx_search ON posts(description, search_keywords, city, barangay, street);

-- Add price range to posts table for filtering if it doesn't exist
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS price_range ENUM('below_3000', '3000_to_5000', '5000_to_8000', '8000_to_12000', 'above_12000') 
AFTER price;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_price_range;
DROP TRIGGER IF EXISTS update_price_range_on_update;

-- Create a trigger to automatically update price_range based on price
CREATE TRIGGER update_price_range
BEFORE INSERT ON posts
FOR EACH ROW
BEGIN
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
END;

-- Create a trigger to update price_range when price is updated
CREATE TRIGGER update_price_range_on_update
BEFORE UPDATE ON posts
FOR EACH ROW
BEGIN
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
END; 