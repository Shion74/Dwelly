const pool = require('./config/database');

async function testArchiveTables() {
    try {
        console.log('Testing archive tables...');
        
        // Check if archive tables exist
        const [tables] = await pool.query(`
            SHOW TABLES LIKE 'archived_%'
        `);
        
        console.log('📋 Archive tables found:');
        if (tables.length === 0) {
            console.log('❌ No archive tables found! Creating them...');
            
            // Create the tables manually
            await pool.query(`
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
                    latitude DECIMAL(10, 8),
                    longitude DECIMAL(11, 8),
                    maps_link TEXT,
                    search_keywords TEXT,
                    price_range VARCHAR(50),
                    status VARCHAR(50),
                    is_flagged BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_by INT,
                    deletion_reason VARCHAR(255),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_deleted_by (deleted_by),
                    INDEX idx_deleted_at (deleted_at)
                )
            `);
            
            await pool.query(`
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
                    role ENUM('student', 'admin') DEFAULT 'student',
                    is_blocked BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_by INT,
                    deletion_reason VARCHAR(255),
                    INDEX idx_original_user_id (user_id),
                    INDEX idx_deleted_by (deleted_by),
                    INDEX idx_deleted_at (deleted_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_photos (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    photo_id INT NOT NULL,
                    post_id INT NOT NULL,
                    file_path VARCHAR(255),
                    created_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_post_amenities (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    amenity_id INT NOT NULL,
                    post_id INT NOT NULL,
                    amenity_name VARCHAR(255),
                    amenity_type ENUM('default', 'custom') DEFAULT 'default',
                    created_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_rooms (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    post_id INT NOT NULL,
                    number_of_rooms INT,
                    bathroom_type ENUM('private', 'shared'),
                    room_type VARCHAR(100),
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_favorites (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    favorite_id INT NOT NULL,
                    user_id INT NOT NULL,
                    post_id INT NOT NULL,
                    created_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_user_id (user_id),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_ratings (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    rating_id INT NOT NULL,
                    user_id INT NOT NULL,
                    post_id INT NOT NULL,
                    stars INT,
                    comment TEXT,
                    created_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_user_id (user_id),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS archived_reports (
                    archive_id INT AUTO_INCREMENT PRIMARY KEY,
                    report_id INT NOT NULL,
                    reporter_id INT NOT NULL,
                    post_id INT NOT NULL,
                    report_type VARCHAR(100),
                    description TEXT,
                    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archived_reason VARCHAR(255),
                    INDEX idx_original_reporter_id (reporter_id),
                    INDEX idx_original_post_id (post_id),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            console.log('✅ Archive tables created successfully!');
        } else {
            tables.forEach(table => {
                console.log(`  ✅ ${Object.values(table)[0]}`);
            });
        }
        
        // Test the archive utility functions
        console.log('\n🧪 Testing archive utility functions...');
        const { getArchivedPost, getArchivedUser } = require('./utils/archiveUtils');
        
        console.log('✅ Archive utility functions loaded successfully!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error testing archive system:', error);
        process.exit(1);
    }
}

testArchiveTables(); 