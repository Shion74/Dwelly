-- Migration: Add status to posts and type to reports for advanced reporting/archiving

ALTER TABLE posts
ADD COLUMN status ENUM('available', 'occupied', 'archived') NOT NULL DEFAULT 'available';

ALTER TABLE reports
ADD COLUMN type ENUM('occupied', 'scam', 'other') NOT NULL DEFAULT 'other'; 