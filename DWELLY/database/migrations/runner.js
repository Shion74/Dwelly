const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dwelly_db',
    multipleStatements: true
};

async function runMigrations() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // Create migrations table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get all migration files
        const migrationFiles = await fs.readdir(__dirname);
        const sqlFiles = migrationFiles
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sort files to ensure they run in order

        // Get executed migrations
        const [executedMigrations] = await connection.execute('SELECT name FROM migrations');
        const executedMigrationNames = executedMigrations.map(m => m.name);

        // Execute new migrations
        for (const file of sqlFiles) {
            if (!executedMigrationNames.includes(file)) {
                console.log(`Executing migration: ${file}`);
                const sql = await fs.readFile(path.join(__dirname, file), 'utf8');
                
                try {
                    await connection.beginTransaction();
                    await connection.query(sql);
                    await connection.execute('INSERT INTO migrations (name) VALUES (?)', [file]);
                    await connection.commit();
                    console.log(`Successfully executed migration: ${file}`);
                } catch (error) {
                    await connection.rollback();
                    console.error(`Error executing migration ${file}:`, error);
                    throw error;
                }
            }
        }

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runMigrations(); 