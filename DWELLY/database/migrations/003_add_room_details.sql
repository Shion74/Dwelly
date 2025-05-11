-- Migration: Add room details columns
-- Description: Adds necessary columns for room details to the rooms table
-- Date: 2024-03-19

-- Add new columns to rooms table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS number_of_rooms INT NOT NULL AFTER post_id,
ADD COLUMN IF NOT EXISTS bathroom_type ENUM('common', 'own') NOT NULL AFTER number_of_rooms,
ADD COLUMN IF NOT EXISTS room_type ENUM('bare', 'semi_furnished', 'furnished') NOT NULL AFTER bathroom_type,
ADD COLUMN IF NOT EXISTS has_wifi BOOLEAN NOT NULL DEFAULT 0 AFTER room_type,
ADD COLUMN IF NOT EXISTS has_cctv BOOLEAN NOT NULL DEFAULT 0 AFTER has_wifi,
ADD COLUMN IF NOT EXISTS is_airconditioned BOOLEAN NOT NULL DEFAULT 0 AFTER has_cctv,
ADD COLUMN IF NOT EXISTS has_parking BOOLEAN NOT NULL DEFAULT 0 AFTER is_airconditioned,
ADD COLUMN IF NOT EXISTS has_own_electricity BOOLEAN NOT NULL DEFAULT 0 AFTER has_parking,
ADD COLUMN IF NOT EXISTS has_own_water BOOLEAN NOT NULL DEFAULT 0 AFTER has_own_electricity; 