const { batchAnalyzeContent } = require('../middleware/contentModerator');
const { generateSecurityReport } = require('../middleware/auditSystem');
const pool = require('../config/database');

async function performSecurityScan() {
    try {
        console.log('🔍 Starting Dwelly Security Scan...\n');

        // Analyze existing posts for security issues
        console.log('📝 Analyzing existing posts for content violations...');
        const contentAnalysis = await batchAnalyzeContent(500); // Analyze up to 500 posts
        
        console.log(`✅ Analyzed posts, found ${contentAnalysis.length} potential issues`);
        
        if (contentAnalysis.length > 0) {
            console.log('\n⚠️ Content Issues Found:');
            contentAnalysis.forEach((issue, index) => {
                console.log(`${index + 1}. Post ID ${issue.post_id}:`);
                console.log(`   - Score: ${issue.analysis.score}/100`);
                console.log(`   - Recommendation: ${issue.analysis.recommendation}`);
                console.log(`   - Issues: ${issue.analysis.reasons.join(', ')}`);
                console.log('');
            });
        }

        // Check for users with suspicious activity
        console.log('👥 Checking for users with suspicious activity...');
        const [suspiciousUsers] = await pool.query(`
            SELECT 
                u.user_id,
                u.full_name,
                u.email,
                COUNT(p.post_id) as post_count,
                COUNT(CASE WHEN p.is_flagged = TRUE THEN 1 END) as flagged_posts,
                COUNT(CASE WHEN p.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as posts_last_24h
            FROM users u
            LEFT JOIN posts p ON u.user_id = p.user_id AND p.is_deleted = 0
            WHERE u.is_deleted = 0
            GROUP BY u.user_id
            HAVING 
                flagged_posts > 2 OR 
                posts_last_24h > 10 OR
                (post_count > 0 AND (flagged_posts / post_count) > 0.5)
            ORDER BY flagged_posts DESC, posts_last_24h DESC
        `);

        if (suspiciousUsers.length > 0) {
            console.log(`⚠️ Found ${suspiciousUsers.length} users with suspicious activity:`);
            suspiciousUsers.forEach(user => {
                console.log(`- ${user.full_name} (${user.email}): ${user.flagged_posts} flagged posts, ${user.posts_last_24h} posts in 24h`);
            });
        } else {
            console.log('✅ No suspicious user activity detected');
        }

        // Check for duplicate or near-duplicate posts
        console.log('\n🔄 Checking for duplicate posts...');
        const [duplicatePosts] = await pool.query(`
            SELECT 
                p1.post_id as post1_id,
                p2.post_id as post2_id,
                p1.user_id,
                p1.description,
                p1.street,
                p1.price
            FROM posts p1
            JOIN posts p2 ON p1.post_id < p2.post_id
            WHERE 
                p1.is_deleted = 0 AND p2.is_deleted = 0
                AND p1.user_id = p2.user_id
                AND (
                    (p1.description = p2.description AND LENGTH(p1.description) > 50) OR
                    (p1.street = p2.street AND p1.barangay = p2.barangay AND ABS(p1.price - p2.price) < 500)
                )
            LIMIT 20
        `);

        if (duplicatePosts.length > 0) {
            console.log(`⚠️ Found ${duplicatePosts.length} potential duplicate posts:`);
            duplicatePosts.forEach(dup => {
                console.log(`- Posts ${dup.post1_id} and ${dup.post2_id} by user ${dup.user_id} appear similar`);
            });
        } else {
            console.log('✅ No obvious duplicate posts found');
        }

        // Check for orphaned files
        console.log('\n📁 Checking for orphaned uploaded files...');
        const fs = require('fs').promises;
        const path = require('path');

        try {
            const uploadDir = path.join(__dirname, '../public/uploads/listings');
            const files = await fs.readdir(uploadDir);
            
            const [dbFiles] = await pool.query('SELECT DISTINCT file_path FROM photos WHERE is_deleted = 0');
            const dbFileNames = dbFiles.map(row => path.basename(row.file_path));
            
            const orphanedFiles = files.filter(file => 
                !dbFileNames.includes(file) && 
                file !== '.gitkeep' &&
                !file.startsWith('.')
            );

            if (orphanedFiles.length > 0) {
                console.log(`⚠️ Found ${orphanedFiles.length} orphaned files:`);
                console.log(`   Files: ${orphanedFiles.slice(0, 10).join(', ')}${orphanedFiles.length > 10 ? '...' : ''}`);
            } else {
                console.log('✅ No orphaned files found');
            }
        } catch (error) {
            console.log('⚠️ Could not check for orphaned files:', error.message);
        }

        // Check database integrity
        console.log('\n🗃️ Checking database integrity...');
        
        const integrityChecks = [
            {
                name: 'Posts without valid users',
                query: 'SELECT COUNT(*) as count FROM posts p LEFT JOIN users u ON p.user_id = u.user_id WHERE u.user_id IS NULL AND p.is_deleted = 0'
            },
            {
                name: 'Photos without valid posts',
                query: 'SELECT COUNT(*) as count FROM photos ph LEFT JOIN posts p ON ph.post_id = p.post_id WHERE p.post_id IS NULL AND ph.is_deleted = 0'
            },
            {
                name: 'Users with invalid departments',
                query: 'SELECT COUNT(*) as count FROM users u LEFT JOIN departments d ON u.department_id = d.department_id WHERE u.department_id IS NOT NULL AND d.department_id IS NULL AND u.is_deleted = 0'
            }
        ];

        for (const check of integrityChecks) {
            const [result] = await pool.query(check.query);
            if (result[0].count > 0) {
                console.log(`⚠️ ${check.name}: ${result[0].count} issues found`);
            } else {
                console.log(`✅ ${check.name}: OK`);
            }
        }

        // Generate summary
        console.log('\n📊 Security Scan Summary:');
        console.log('='.repeat(50));
        console.log(`Content violations detected: ${contentAnalysis.length}`);
        console.log(`Suspicious users found: ${suspiciousUsers.length}`);
        console.log(`Potential duplicate posts: ${duplicatePosts.length}`);
        
        const totalIssues = contentAnalysis.length + suspiciousUsers.length + duplicatePosts.length;
        
        if (totalIssues === 0) {
            console.log('\n🎉 No major security issues detected!');
            console.log('Your Dwelly application appears to be secure.');
        } else {
            console.log(`\n⚠️ Total issues requiring attention: ${totalIssues}`);
            console.log('\nRecommended Actions:');
            
            if (contentAnalysis.length > 0) {
                console.log('1. Review flagged posts in the admin moderation queue');
                console.log('2. Consider adjusting content moderation sensitivity');
            }
            
            if (suspiciousUsers.length > 0) {
                console.log('3. Investigate users with high flagged post ratios');
                console.log('4. Consider implementing stricter posting limits');
            }
            
            if (duplicatePosts.length > 0) {
                console.log('5. Review and remove duplicate posts');
                console.log('6. Implement duplicate detection for new posts');
            }
        }

        console.log('\n📋 Next Steps:');
        console.log('- Run `npm run security:report` for detailed analytics');
        console.log('- Access /admin/security for the web dashboard');
        console.log('- Schedule regular security scans (weekly recommended)');
        
    } catch (error) {
        console.error('❌ Error during security scan:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    performSecurityScan();
}

module.exports = { performSecurityScan }; 