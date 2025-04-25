const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dwelly_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize database tables
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create posts table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS posts (
                post_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                street VARCHAR(255) NOT NULL,
                barangay VARCHAR(100) NOT NULL,
                city VARCHAR(100) NOT NULL,
                landlord_name VARCHAR(100) NOT NULL,
                contact_number VARCHAR(20) NOT NULL,
                social_media_link VARCHAR(255),
                google_maps_link VARCHAR(255),
                description TEXT,
                price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_flagged BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);

        // Add price column if it doesn't exist
        try {
            await connection.query(`
                ALTER TABLE posts 
                ADD COLUMN price DECIMAL(10,2) DEFAULT NULL
            `);
            console.log('Price column added successfully');
        } catch (error) {
            // Ignore error if column already exists
            if (!error.message.includes('Duplicate column name')) {
                console.error('Error adding price column:', error);
            }
        }

        // Create photos table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS photos (
                photo_id INT PRIMARY KEY AUTO_INCREMENT,
                post_id INT NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            )
        `);

        // Create favorites table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                favorite_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                UNIQUE KEY unique_favorite (user_id, post_id)
            )
        `);

        // Create ratings table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                rating_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                UNIQUE KEY unique_rating (user_id, post_id)
            )
        `);

        connection.release();
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Call initialize function
initializeDatabase();

// Test the connection
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to the database:', err);
    });

module.exports = pool; 