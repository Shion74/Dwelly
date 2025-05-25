const pool = require('../config/database');

/**
 * Archive a post and all its related data before deletion
 */
async function archivePost(postId, deletedBy, deletionReason = 'user_deleted') {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        console.log(`Archiving post ${postId}...`);
        
        // 1. Archive the main post data
        await connection.query(`
            INSERT INTO archived_posts (
                post_id, user_id, type_id, description, price, street, barangay, city,
                latitude, longitude, maps_link, search_keywords, price_range, status, is_flagged,
                created_at, deleted_by, deletion_reason
            )
            SELECT 
                post_id, user_id, type_id, description, price, street, barangay, city,
                latitude, longitude, maps_link, search_keywords, price_range, status, is_flagged,
                created_at, ?, ?
            FROM posts 
            WHERE post_id = ?
        `, [deletedBy, deletionReason, postId]);
        
        // 2. Archive photos
        await connection.query(`
            INSERT INTO archived_photos (photo_id, post_id, file_path, archived_reason)
            SELECT photo_id, post_id, file_path, ?
            FROM photos 
            WHERE post_id = ?
        `, [deletionReason, postId]);
        
        // 3. Archive amenities
        await connection.query(`
            INSERT INTO archived_post_amenities (amenity_id, post_id, amenity_name, amenity_type, created_at, archived_reason)
            SELECT amenity_id, post_id, amenity_name, amenity_type, created_at, ?
            FROM post_amenities 
            WHERE post_id = ?
        `, [deletionReason, postId]);
        
        // 4. Archive rooms data
        await connection.query(`
            INSERT INTO archived_rooms (room_id, post_id, number_of_rooms, bathroom_type, room_type, archived_reason)
            SELECT room_id, post_id, number_of_rooms, bathroom_type, room_type, ?
            FROM rooms 
            WHERE post_id = ?
        `, [deletionReason, postId]);
        
        // 5. Archive favorites
        await connection.query(`
            INSERT INTO archived_favorites (user_id, post_id, created_at, archived_reason)
            SELECT user_id, post_id, created_at, 'post_deleted'
            FROM favorites 
            WHERE post_id = ?
        `, [postId]);
        
        // 6. Archive ratings
        await connection.query(`
            INSERT INTO archived_ratings (rating_id, user_id, post_id, stars, comment, created_at, archived_reason)
            SELECT rating_id, user_id, post_id, stars, comment, created_at, 'post_deleted'
            FROM ratings 
            WHERE post_id = ?
        `, [postId]);
        
        // 7. Archive reports
        await connection.query(`
            INSERT INTO archived_reports (report_id, reporter_id, post_id, report_type, reason, created_at, archived_reason)
            SELECT report_id, reporter_id, post_id, type, reason, created_at, 'post_deleted'
            FROM reports 
            WHERE post_id = ?
        `, [postId]);
        
        await connection.commit();
        console.log(`✅ Post ${postId} archived successfully`);
        
    } catch (error) {
        await connection.rollback();
        console.error(`❌ Error archiving post ${postId}:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Archive a user and all their related data before deletion
 */
async function archiveUser(userId, deletedBy, deletionReason = 'admin_deleted') {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        console.log(`Archiving user ${userId}...`);
        
        // 1. Archive all user's posts first
        const [userPosts] = await connection.query('SELECT post_id FROM posts WHERE user_id = ?', [userId]);
        
        for (const post of userPosts) {
            await archivePost(post.post_id, deletedBy, 'user_account_deleted');
        }
        
        // 2. Archive the user data
        await connection.query(`
            INSERT INTO archived_users (
                user_id, full_name, email, password, id_number, phone_number, course_id, department_id,
                role, is_blocked, created_at, deleted_by, deletion_reason
            )
            SELECT 
                user_id, full_name, email, password, id_number, phone_number, course_id, department_id,
                role, is_blocked, created_at, ?, ?
            FROM users 
            WHERE user_id = ?
        `, [deletedBy, deletionReason, userId]);
        
        // 3. Archive user's favorites (for posts they didn't own)
        await connection.query(`
            INSERT INTO archived_favorites (user_id, post_id, created_at, archived_reason)
            SELECT f.user_id, f.post_id, f.created_at, 'user_deleted'
            FROM favorites f
            LEFT JOIN posts p ON f.post_id = p.post_id
            WHERE f.user_id = ? AND (p.user_id != ? OR p.user_id IS NULL)
        `, [userId, userId]);
        
        // 4. Archive user's ratings (for posts they didn't own)
        await connection.query(`
            INSERT INTO archived_ratings (rating_id, user_id, post_id, stars, comment, created_at, archived_reason)
            SELECT r.rating_id, r.user_id, r.post_id, r.stars, r.comment, r.created_at, 'user_deleted'
            FROM ratings r
            LEFT JOIN posts p ON r.post_id = p.post_id
            WHERE r.user_id = ? AND (p.user_id != ? OR p.user_id IS NULL)
        `, [userId, userId]);
        
        // 5. Archive user's reports (for posts they didn't own)
        await connection.query(`
            INSERT INTO archived_reports (report_id, reporter_id, post_id, report_type, reason, created_at, archived_reason)
            SELECT rep.report_id, rep.reporter_id, rep.post_id, rep.type, rep.reason, rep.created_at, 'user_deleted'
            FROM reports rep
            LEFT JOIN posts p ON rep.post_id = p.post_id
            WHERE rep.reporter_id = ? AND (p.user_id != ? OR p.user_id IS NULL)
        `, [userId, userId]);
        
        await connection.commit();
        console.log(`✅ User ${userId} archived successfully`);
        
    } catch (error) {
        await connection.rollback();
        console.error(`❌ Error archiving user ${userId}:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Delete post data after archiving
 */
async function deletePostData(postId) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Delete in reverse order of foreign key dependencies
        await connection.query('DELETE FROM reports WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM ratings WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM favorites WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM rooms WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM post_amenities WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM photos WHERE post_id = ?', [postId]);
        await connection.query('DELETE FROM posts WHERE post_id = ?', [postId]);
        
        await connection.commit();
        console.log(`✅ Post ${postId} data deleted successfully`);
        
    } catch (error) {
        await connection.rollback();
        console.error(`❌ Error deleting post ${postId} data:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Delete user data after archiving
 */
async function deleteUserData(userId) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Get all user's posts to delete them first
        const [userPosts] = await connection.query('SELECT post_id FROM posts WHERE user_id = ?', [userId]);
        
        // Delete each post
        for (const post of userPosts) {
            await deletePostData(post.post_id);
        }
        
        // Delete user's remaining data
        await connection.query('DELETE FROM reports WHERE reporter_id = ?', [userId]);
        await connection.query('DELETE FROM ratings WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM favorites WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM users WHERE user_id = ?', [userId]);
        
        await connection.commit();
        console.log(`✅ User ${userId} data deleted successfully`);
        
    } catch (error) {
        await connection.rollback();
        console.error(`❌ Error deleting user ${userId} data:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Complete archive and delete process for a post
 */
async function archiveAndDeletePost(postId, deletedBy, deletionReason = 'user_deleted') {
    try {
        await archivePost(postId, deletedBy, deletionReason);
        await deletePostData(postId);
        return { success: true, message: 'Post archived and deleted successfully' };
    } catch (error) {
        console.error('Error in archiveAndDeletePost:', error);
        return { success: false, message: 'Failed to archive and delete post', error };
    }
}

/**
 * Complete archive and delete process for a user
 */
async function archiveAndDeleteUser(userId, deletedBy, deletionReason = 'admin_deleted') {
    try {
        await archiveUser(userId, deletedBy, deletionReason);
        await deleteUserData(userId);
        return { success: true, message: 'User archived and deleted successfully' };
    } catch (error) {
        console.error('Error in archiveAndDeleteUser:', error);
        return { success: false, message: 'Failed to archive and delete user', error };
    }
}

/**
 * Get archived post data
 */
async function getArchivedPost(postId) {
    try {
        const [posts] = await pool.query('SELECT * FROM archived_post_complete WHERE post_id = ?', [postId]);
        return posts[0] || null;
    } catch (error) {
        console.error('Error getting archived post:', error);
        return null;
    }
}

/**
 * Get archived user data
 */
async function getArchivedUser(userId) {
    try {
        const [users] = await pool.query('SELECT * FROM archived_user_complete WHERE user_id = ?', [userId]);
        return users[0] || null;
    } catch (error) {
        console.error('Error getting archived user:', error);
        return null;
    }
}

module.exports = {
    archivePost,
    archiveUser,
    deletePostData,
    deleteUserData,
    archiveAndDeletePost,
    archiveAndDeleteUser,
    getArchivedPost,
    getArchivedUser
}; 