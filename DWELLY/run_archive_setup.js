const pool = require('./config/database');
const fs = require('fs');

async function setupArchiveSystem() {
    try {
        console.log('Setting up archive system...');
        
        // Read the SQL file
        const sqlContent = fs.readFileSync('./create_archive_system.sql', 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                await pool.query(statement);
            }
        }
        
        console.log('✅ Archive system setup completed successfully!');
        
        // Verify tables were created
        const [tables] = await pool.query(`
            SHOW TABLES LIKE 'archived_%'
        `);
        
        console.log('📋 Archive tables created:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up archive system:', error);
        process.exit(1);
    }
}

setupArchiveSystem(); 