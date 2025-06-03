const pool = require('./config/database');

async function debugDeletion() {
    try {
        console.log('🔍 Debugging post deletion...');
        
        // Check if we have any posts to test with
        const [posts] = await pool.query('SELECT * FROM posts LIMIT 1');
        
        if (posts.length === 0) {
            console.log('❌ No posts found in database to test with');
            await pool.end();
            return;
        }
        
        const testPost = posts[0];
        console.log(`📋 Found test post: ID ${testPost.post_id} by user ${testPost.user_id}`);
        
        // Test if archive utilities can be loaded
        try {
            const { archiveAndDeletePost } = require('./utils/archiveUtils');
            console.log('✅ Archive utilities loaded successfully');
            console.log('✅ archiveAndDeletePost function type:', typeof archiveAndDeletePost);
        } catch (error) {
            console.error('❌ Error loading archive utilities:', error.message);
            await pool.end();
            return;
        }
        
        // Check if archive tables exist
        const [archiveTables] = await pool.query("SHOW TABLES LIKE 'archived_%'");
        console.log(`✅ Found ${archiveTables.length} archive tables`);
        
        // Test archive table access
        try {
            await pool.query('SELECT 1 FROM archived_posts LIMIT 1');
            console.log('✅ Archive tables are accessible');
        } catch (error) {
            console.error('❌ Archive tables not accessible:', error.message);
        }
        
        console.log('');
        console.log('🧪 Debug complete. Archive system appears to be working.');
        console.log('');
        console.log('📝 To test deletion manually:');
        console.log('1. Start the application: npm start');
        console.log('2. Login as a user who owns a post');
        console.log('3. Go to your post details page');
        console.log('4. Click the "Delete" button');
        console.log('5. Type "DELETE" in the confirmation dialog');
        console.log('6. Check browser console for any JavaScript errors');
        console.log('7. Check server logs for any backend errors');
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error during debug:', error);
        await pool.end();
    }
}

debugDeletion(); 