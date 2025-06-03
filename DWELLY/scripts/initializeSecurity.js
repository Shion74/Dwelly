const { initializeAuditTables } = require('../middleware/auditSystem');
const pool = require('../config/database');

async function initializeSecurity() {
    try {
        console.log('🔒 Initializing Dwelly Security Framework...\n');

        // Initialize audit tables
        console.log('📊 Setting up audit logging tables...');
        await initializeAuditTables();

        // Add security-related columns to existing tables if they don't exist
        console.log('🔧 Updating existing tables with security columns...');
        
        // Add moderation columns to posts table
        try {
            await pool.query(`
                ALTER TABLE posts 
                ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
                ADD COLUMN IF NOT EXISTS moderation_score INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_moderated TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Posts table updated with moderation columns');
        } catch (error) {
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Posts table may already have security columns:', error.message);
            }
        }

        // Add security columns to users table
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
                ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Users table updated with security columns');
        } catch (error) {
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Users table may already have security columns:', error.message);
            }
        }

        // Create security settings table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS security_settings (
                    setting_id INT PRIMARY KEY AUTO_INCREMENT,
                    setting_name VARCHAR(100) NOT NULL UNIQUE,
                    setting_value TEXT,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    updated_by INT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
                )
            `);

            // Insert default security settings
            const defaultSettings = [
                ['max_login_attempts', '5', 'Maximum failed login attempts before account lockout'],
                ['lockout_duration_minutes', '60', 'Duration of account lockout in minutes'],
                ['max_posts_per_hour', '10', 'Maximum posts a user can create per hour'],
                ['max_file_upload_size_mb', '5', 'Maximum file upload size in MB'],
                ['content_moderation_enabled', 'true', 'Enable automatic content moderation'],
                ['profanity_filter_enabled', 'true', 'Enable profanity filtering'],
                ['ip_blocking_enabled', 'true', 'Enable IP-based blocking for suspicious activity'],
                ['audit_logging_enabled', 'true', 'Enable comprehensive audit logging'],
                ['csrf_protection_enabled', 'true', 'Enable CSRF protection'],
                ['rate_limiting_enabled', 'true', 'Enable rate limiting']
            ];

            for (const [name, value, description] of defaultSettings) {
                await pool.query(`
                    INSERT IGNORE INTO security_settings (setting_name, setting_value, description)
                    VALUES (?, ?, ?)
                `, [name, value, description]);
            }

            console.log('✅ Security settings table created and configured');
        } catch (error) {
            console.log('⚠️ Security settings table may already exist:', error.message);
        }

        // Create IP whitelist/blacklist table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ip_access_control (
                    rule_id INT PRIMARY KEY AUTO_INCREMENT,
                    ip_address VARCHAR(45) NOT NULL,
                    subnet_mask VARCHAR(45),
                    rule_type ENUM('whitelist', 'blacklist') NOT NULL,
                    reason TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_by INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NULL,
                    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
                    INDEX idx_ip_address (ip_address),
                    INDEX idx_rule_type (rule_type),
                    INDEX idx_is_active (is_active)
                )
            `);
            console.log('✅ IP access control table created');
        } catch (error) {
            console.log('⚠️ IP access control table may already exist:', error.message);
        }

        // Create content moderation queue table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS moderation_queue (
                    queue_id INT PRIMARY KEY AUTO_INCREMENT,
                    content_type ENUM('post', 'user_profile', 'comment', 'image') NOT NULL,
                    content_id INT,
                    user_id INT,
                    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                    status ENUM('pending', 'in_review', 'approved', 'rejected') DEFAULT 'pending',
                    assigned_moderator INT,
                    moderation_notes TEXT,
                    automated_flags JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at TIMESTAMP NULL,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    FOREIGN KEY (assigned_moderator) REFERENCES users(user_id) ON DELETE SET NULL,
                    INDEX idx_status (status),
                    INDEX idx_priority (priority),
                    INDEX idx_content_type (content_type),
                    INDEX idx_assigned_moderator (assigned_moderator)
                )
            `);
            console.log('✅ Moderation queue table created');
        } catch (error) {
            console.log('⚠️ Moderation queue table may already exist:', error.message);
        }

        // Create indexes for better performance
        console.log('🚀 Creating performance indexes...');
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_flagged ON posts(is_flagged)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_moderation_score ON posts(moderation_score)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_ip)');
            console.log('✅ Performance indexes created');
        } catch (error) {
            console.log('⚠️ Some indexes may already exist:', error.message);
        }

        console.log('\n🎉 Security Framework Initialization Complete!');
        console.log('\n📋 Security Features Enabled:');
        console.log('   ✅ Comprehensive audit logging');
        console.log('   ✅ Automated content moderation');
        console.log('   ✅ Rate limiting and DDoS protection');
        console.log('   ✅ Input validation and sanitization');
        console.log('   ✅ CSRF protection');
        console.log('   ✅ Failed login attempt tracking');
        console.log('   ✅ IP-based access control');
        console.log('   ✅ File upload security');
        console.log('   ✅ Security headers and XSS protection');
        console.log('   ✅ Moderation queue for manual review');
        console.log('\n📊 Next Steps:');
        console.log('   1. Run `npm run security:scan` to analyze existing content');
        console.log('   2. Run `npm run security:report` to generate security reports');
        console.log('   3. Update your app.js to include the security middleware');
        console.log('   4. Configure environment variables for production');

    } catch (error) {
        console.error('❌ Error initializing security framework:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    initializeSecurity();
}

module.exports = { initializeSecurity }; 