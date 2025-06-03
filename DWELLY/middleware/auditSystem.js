const pool = require('../config/database');

// Create audit logs table if it doesn't exist
const initializeAuditTables = async () => {
    try {
        // Security events audit table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS security_audit_logs (
                log_id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                session_id VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                action_type ENUM(
                    'login_attempt', 'login_success', 'login_failure', 
                    'logout', 'register', 'password_change',
                    'post_create', 'post_edit', 'post_delete',
                    'user_block', 'user_unblock', 'admin_action',
                    'suspicious_activity', 'rate_limit_exceeded',
                    'csrf_violation', 'validation_failure',
                    'file_upload', 'content_moderated'
                ) NOT NULL,
                resource VARCHAR(255),
                details JSON,
                status ENUM('success', 'failure', 'warning') NOT NULL,
                severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_action_type (action_type),
                INDEX idx_created_at (created_at),
                INDEX idx_severity (severity),
                INDEX idx_ip_address (ip_address)
            )
        `);

        // Content moderation logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS content_moderation_logs (
                log_id INT PRIMARY KEY AUTO_INCREMENT,
                content_type ENUM('post', 'comment', 'user_profile', 'image') NOT NULL,
                content_id INT,
                user_id INT,
                moderator_id INT,
                action_taken ENUM(
                    'content_flagged', 'content_approved', 'content_rejected',
                    'profanity_detected', 'spam_detected', 'image_rejected',
                    'manual_review', 'auto_approved', 'auto_rejected'
                ) NOT NULL,
                original_content TEXT,
                moderated_content TEXT,
                reason TEXT,
                confidence_score DECIMAL(3,2),
                is_automated BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
                FOREIGN KEY (moderator_id) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_content_type (content_type),
                INDEX idx_user_id (user_id),
                INDEX idx_action_taken (action_taken),
                INDEX idx_created_at (created_at)
            )
        `);

        // Failed login attempts tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS failed_login_attempts (
                attempt_id INT PRIMARY KEY AUTO_INCREMENT,
                ip_address VARCHAR(45) NOT NULL,
                email VARCHAR(255),
                attempt_count INT DEFAULT 1,
                last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_blocked BOOLEAN DEFAULT FALSE,
                blocked_until TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ip_address (ip_address),
                INDEX idx_email (email),
                INDEX idx_last_attempt (last_attempt)
            )
        `);

        console.log('Audit tables initialized successfully');
    } catch (error) {
        console.error('Error initializing audit tables:', error);
    }
};

// Log security events
const logSecurityEvent = async (eventData) => {
    try {
        const {
            user_id = null,
            session_id = null,
            ip_address,
            user_agent,
            action_type,
            resource = null,
            details = {},
            status = 'success',
            severity = 'low'
        } = eventData;

        await pool.query(`
            INSERT INTO security_audit_logs 
            (user_id, session_id, ip_address, user_agent, action_type, resource, details, status, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user_id, session_id, ip_address, user_agent, 
            action_type, resource, JSON.stringify(details), status, severity
        ]);

        // Alert on critical events
        if (severity === 'critical') {
            console.error('CRITICAL SECURITY EVENT:', eventData);
            // Here you could integrate with alerting systems
        }

    } catch (error) {
        console.error('Error logging security event:', error);
    }
};

// Log content moderation events
const logContentModeration = async (moderationData) => {
    try {
        const {
            content_type,
            content_id = null,
            user_id = null,
            moderator_id = null,
            action_taken,
            original_content = null,
            moderated_content = null,
            reason = null,
            confidence_score = null,
            is_automated = true
        } = moderationData;

        await pool.query(`
            INSERT INTO content_moderation_logs 
            (content_type, content_id, user_id, moderator_id, action_taken, 
             original_content, moderated_content, reason, confidence_score, is_automated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            content_type, content_id, user_id, moderator_id, action_taken,
            original_content, moderated_content, reason, confidence_score, is_automated
        ]);

    } catch (error) {
        console.error('Error logging content moderation:', error);
    }
};

// Track failed login attempts
const trackFailedLogin = async (ip_address, email) => {
    try {
        // Check if IP already has failed attempts
        const [existing] = await pool.query(
            'SELECT * FROM failed_login_attempts WHERE ip_address = ? AND DATE(last_attempt) = CURDATE()',
            [ip_address]
        );

        if (existing.length > 0) {
            const attempt = existing[0];
            const newCount = attempt.attempt_count + 1;
            let isBlocked = false;
            let blockedUntil = null;

            // Block IP after 5 failed attempts
            if (newCount >= 5) {
                isBlocked = true;
                blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // Block for 1 hour
            }

            await pool.query(`
                UPDATE failed_login_attempts 
                SET attempt_count = ?, last_attempt = CURRENT_TIMESTAMP, 
                    is_blocked = ?, blocked_until = ?, email = ?
                WHERE ip_address = ? AND DATE(last_attempt) = CURDATE()
            `, [newCount, isBlocked, blockedUntil, email, ip_address]);

            return { isBlocked, attemptCount: newCount };
        } else {
            // Create new failed attempt record
            await pool.query(`
                INSERT INTO failed_login_attempts (ip_address, email, attempt_count)
                VALUES (?, ?, 1)
            `, [ip_address, email]);

            return { isBlocked: false, attemptCount: 1 };
        }
    } catch (error) {
        console.error('Error tracking failed login:', error);
        return { isBlocked: false, attemptCount: 0 };
    }
};

// Check if IP is blocked
const isIpBlocked = async (ip_address) => {
    try {
        const [blocked] = await pool.query(`
            SELECT * FROM failed_login_attempts 
            WHERE ip_address = ? AND is_blocked = TRUE 
            AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
        `, [ip_address]);

        return blocked.length > 0;
    } catch (error) {
        console.error('Error checking IP block status:', error);
        return false;
    }
};

// Clear successful login attempts
const clearFailedAttempts = async (ip_address) => {
    try {
        await pool.query(
            'DELETE FROM failed_login_attempts WHERE ip_address = ?',
            [ip_address]
        );
    } catch (error) {
        console.error('Error clearing failed attempts:', error);
    }
};

// Generate security report
const generateSecurityReport = async (timeframe = '7 days') => {
    try {
        const timeQuery = timeframe === '24 hours' ? 'DATE(created_at) = CURDATE()' :
                         timeframe === '7 days' ? 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)' :
                         timeframe === '30 days' ? 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)' :
                         'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';

        // Security events summary
        const [securityEvents] = await pool.query(`
            SELECT 
                action_type,
                status,
                severity,
                COUNT(*) as count,
                COUNT(DISTINCT ip_address) as unique_ips
            FROM security_audit_logs 
            WHERE ${timeQuery}
            GROUP BY action_type, status, severity
            ORDER BY count DESC
        `);

        // Failed login attempts
        const [failedLogins] = await pool.query(`
            SELECT 
                ip_address,
                email,
                attempt_count,
                is_blocked,
                last_attempt
            FROM failed_login_attempts 
            WHERE ${timeQuery.replace('created_at', 'last_attempt')}
            ORDER BY attempt_count DESC
            LIMIT 20
        `);

        // Content moderation summary
        const [contentMod] = await pool.query(`
            SELECT 
                content_type,
                action_taken,
                is_automated,
                COUNT(*) as count
            FROM content_moderation_logs 
            WHERE ${timeQuery}
            GROUP BY content_type, action_taken, is_automated
            ORDER BY count DESC
        `);

        // Suspicious activity
        const [suspicious] = await pool.query(`
            SELECT 
                ip_address,
                user_id,
                resource,
                COUNT(*) as incident_count
            FROM security_audit_logs 
            WHERE action_type = 'suspicious_activity' AND ${timeQuery}
            GROUP BY ip_address, user_id, resource
            ORDER BY incident_count DESC
            LIMIT 10
        `);

        return {
            timeframe,
            securityEvents,
            failedLogins,
            contentModeration: contentMod,
            suspiciousActivity: suspicious,
            generatedAt: new Date()
        };

    } catch (error) {
        console.error('Error generating security report:', error);
        return null;
    }
};

// Audit middleware to log requests
const auditMiddleware = (req, res, next) => {
    // Store original res.json to capture response
    const originalJson = res.json;
    
    res.json = function(data) {
        // Log the request if audit info exists
        if (req.auditLog) {
            logSecurityEvent({
                ...req.auditLog,
                session_id: req.sessionID,
                details: {
                    method: req.method,
                    body: req.method === 'POST' ? req.body : undefined,
                    response_status: res.statusCode
                },
                status: res.statusCode < 400 ? 'success' : 'failure',
                severity: res.statusCode >= 500 ? 'high' : 
                         res.statusCode >= 400 ? 'medium' : 'low'
            });
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

module.exports = {
    initializeAuditTables,
    logSecurityEvent,
    logContentModeration,
    trackFailedLogin,
    isIpBlocked,
    clearFailedAttempts,
    generateSecurityReport,
    auditMiddleware
}; 