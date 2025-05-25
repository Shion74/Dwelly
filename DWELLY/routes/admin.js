const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        // Check if user has admin role in users table
        const [users] = await pool.query(
            'SELECT * FROM users WHERE user_id = ? AND role = "admin"',
            [req.session.user.id]
        );

        if (users.length === 0) {
            return res.status(403).render('error', {
                title: 'Access Denied - Dwelly',
                message: 'Access denied. Admin privileges required.',
                error: {}
            });
        }

        req.admin = users[0];
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to verify admin status',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
    try {
        // Get dashboard statistics
        const [userStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
                COUNT(CASE WHEN role = 'staff' THEN 1 END) as staff,
                COUNT(CASE WHEN is_blocked = 1 THEN 1 END) as blocked_users,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d
            FROM users 
            WHERE is_deleted = 0
        `);

        const [postStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_posts,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available_posts,
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_posts,
                COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_posts,
                COUNT(CASE WHEN is_flagged = 1 THEN 1 END) as flagged_posts,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_posts_30d
            FROM posts 
            WHERE is_deleted = 0
        `);

        const [reportStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN type = 'scam' THEN 1 END) as scam_reports,
                COUNT(CASE WHEN type = 'occupied' THEN 1 END) as occupied_reports,
                COUNT(CASE WHEN type = 'other' THEN 1 END) as other_reports,
                COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_reports_7d
            FROM reports 
            WHERE is_deleted = 0
        `);

        // Get recent activities
        const [recentUsers] = await pool.query(`
            SELECT u.*, d.name as department_name, c.name as course_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            WHERE u.is_deleted = 0
            ORDER BY u.created_at DESC
            LIMIT 5
        `);

        const [recentPosts] = await pool.query(`
            SELECT p.*, u.full_name as poster_name, rt.display_name as type_display
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            JOIN room_types rt ON p.type_id = rt.type_id
            WHERE p.is_deleted = 0
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        const [recentReports] = await pool.query(`
            SELECT r.*, u.full_name as reporter_name, p.street, p.barangay
            FROM reports r
            JOIN users u ON r.reporter_id = u.user_id
            JOIN posts p ON r.post_id = p.post_id
            WHERE r.is_deleted = 0
            ORDER BY r.created_at DESC
            LIMIT 5
        `);

        // Get posts with multiple reports (need attention)
        const [flaggedPosts] = await pool.query(`
            SELECT p.*, u.full_name as poster_name, rt.display_name as type_display,
                   COUNT(r.report_id) as report_count,
                   GROUP_CONCAT(DISTINCT r.type) as report_types
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            JOIN room_types rt ON p.type_id = rt.type_id
            JOIN reports r ON p.post_id = r.post_id
            WHERE p.is_deleted = 0 AND r.is_deleted = 0
            GROUP BY p.post_id
            HAVING report_count >= 2
            ORDER BY report_count DESC
            LIMIT 10
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Dwelly',
            user: req.session.user,
            admin: req.admin,
            stats: {
                users: userStats[0],
                posts: postStats[0],
                reports: reportStats[0]
            },
            recent: {
                users: recentUsers,
                posts: recentPosts,
                reports: recentReports
            },
            flaggedPosts
        });
    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to load admin dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Users management page
router.get('/users', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';

        let whereClause = 'WHERE u.is_deleted = 0';
        let queryParams = [];

        if (search) {
            whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.id_number LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role) {
            whereClause += ' AND u.role = ?';
            queryParams.push(role);
        }

        if (status === 'blocked') {
            whereClause += ' AND u.is_blocked = 1';
        } else if (status === 'active') {
            whereClause += ' AND u.is_blocked = 0';
        }

        const [users] = await pool.query(`
            SELECT u.*, d.name as department_name, c.name as course_name,
                   COUNT(DISTINCT p.post_id) as post_count,
                   COUNT(DISTINCT r.report_id) as report_count
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            LEFT JOIN posts p ON u.user_id = p.user_id AND p.is_deleted = 0
            LEFT JOIN reports r ON u.user_id = r.reporter_id AND r.is_deleted = 0
            ${whereClause}
            GROUP BY u.user_id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        const [totalCount] = await pool.query(`
            SELECT COUNT(DISTINCT u.user_id) as total
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            ${whereClause}
        `, queryParams);

        const totalPages = Math.ceil(totalCount[0].total / limit);

        res.render('admin/users', {
            title: 'User Management - Dwelly',
            user: req.session.user,
            admin: req.admin,
            users,
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: { search, role, status }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to load users',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Posts management page
router.get('/posts', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const type = req.query.type || '';

        let posts, totalCount;

        if (status === 'archived') {
            // Query archived posts from archived_posts table
            let whereClause = 'WHERE 1=1';
            let queryParams = [];

            if (search) {
                whereClause += ' AND (ap.street LIKE ? OR ap.barangay LIKE ? OR au.full_name LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (type) {
                whereClause += ' AND rt.type_name = ?';
                queryParams.push(type);
            }

            [posts] = await pool.query(`
                SELECT ap.*, au.full_name as poster_name, rt.display_name as type_display,
                       COUNT(DISTINCT ar.report_id) as report_count,
                       COUNT(DISTINCT af.user_id) as favorite_count,
                       GROUP_CONCAT(DISTINCT aph.file_path) as photos,
                       ap.deleted_by, ap.deletion_reason
                FROM archived_posts ap
                LEFT JOIN archived_users au ON ap.user_id = au.user_id
                LEFT JOIN users u ON ap.user_id = u.user_id
                LEFT JOIN room_types rt ON ap.type_id = rt.type_id
                LEFT JOIN archived_reports ar ON ap.post_id = ar.post_id
                LEFT JOIN archived_favorites af ON ap.post_id = af.post_id
                LEFT JOIN archived_photos aph ON ap.post_id = aph.post_id
                ${whereClause}
                GROUP BY ap.post_id
                ORDER BY ap.created_at DESC
                LIMIT ? OFFSET ?
            `, [...queryParams, limit, offset]);

            [totalCount] = await pool.query(`
                SELECT COUNT(DISTINCT ap.post_id) as total
                FROM archived_posts ap
                LEFT JOIN archived_users au ON ap.user_id = au.user_id
                LEFT JOIN users u ON ap.user_id = u.user_id
                LEFT JOIN room_types rt ON ap.type_id = rt.type_id
                ${whereClause}
            `, queryParams);

            // Set status to 'archived' for all archived posts
            posts = posts.map(post => ({
                ...post,
                status: 'archived',
                poster_name: post.poster_name || 'Deleted User'
            }));

        } else {
            // Query regular posts from posts table
            let whereClause = 'WHERE p.is_deleted = 0';
            let queryParams = [];

            if (search) {
                whereClause += ' AND (p.street LIKE ? OR p.barangay LIKE ? OR u.full_name LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (status) {
                if (status === 'flagged') {
                    whereClause += ' AND p.is_flagged = 1';
                } else {
                    whereClause += ' AND p.status = ?';
                    queryParams.push(status);
                }
            }

            if (type) {
                whereClause += ' AND rt.type_name = ?';
                queryParams.push(type);
            }

            [posts] = await pool.query(`
                SELECT p.*, u.full_name as poster_name, rt.display_name as type_display,
                       COUNT(DISTINCT r.report_id) as report_count,
                       COUNT(DISTINCT f.user_id) as favorite_count,
                       GROUP_CONCAT(DISTINCT ph.file_path) as photos
                FROM posts p
                JOIN users u ON p.user_id = u.user_id
                JOIN room_types rt ON p.type_id = rt.type_id
                LEFT JOIN reports r ON p.post_id = r.post_id AND r.is_deleted = 0
                LEFT JOIN favorites f ON p.post_id = f.post_id AND f.is_deleted = 0
                LEFT JOIN photos ph ON p.post_id = ph.post_id AND ph.is_deleted = 0
                ${whereClause}
                GROUP BY p.post_id
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `, [...queryParams, limit, offset]);

            [totalCount] = await pool.query(`
                SELECT COUNT(DISTINCT p.post_id) as total
                FROM posts p
                JOIN users u ON p.user_id = u.user_id
                JOIN room_types rt ON p.type_id = rt.type_id
                ${whereClause}
            `, queryParams);
        }

        const [roomTypes] = await pool.query('SELECT * FROM room_types ORDER BY display_name');

        const totalPages = Math.ceil(totalCount[0].total / limit);

        // Process photos for each post
        const processedPosts = posts.map(post => ({
            ...post,
            photos: post.photos ? post.photos.split(',').map(photo => `/uploads/listings/${photo}`) : [],
            price: post.price ? parseFloat(post.price) : null
        }));

        res.render('admin/posts', {
            title: 'Post Management - Dwelly',
            user: req.session.user,
            admin: req.admin,
            posts: processedPosts,
            roomTypes,
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: { search, status, type }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to load posts',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Reports management page
router.get('/reports', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const type = req.query.type || '';

        let whereClause = 'WHERE r.is_deleted = 0';
        let queryParams = [];

        if (type) {
            whereClause += ' AND r.type = ?';
            queryParams.push(type);
        }

        const [reports] = await pool.query(`
            SELECT r.*, u.full_name as reporter_name, pu.full_name as poster_name,
                   p.street, p.barangay, p.city, rt.display_name as type_display,
                   COUNT(DISTINCT r2.report_id) as total_reports_for_post
            FROM reports r
            JOIN users u ON r.reporter_id = u.user_id
            JOIN posts p ON r.post_id = p.post_id
            JOIN users pu ON p.user_id = pu.user_id
            JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN reports r2 ON p.post_id = r2.post_id AND r2.is_deleted = 0
            ${whereClause}
            GROUP BY r.report_id
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        const [totalCount] = await pool.query(`
            SELECT COUNT(*) as total
            FROM reports r
            ${whereClause}
        `, queryParams);

        const totalPages = Math.ceil(totalCount[0].total / limit);

        res.render('admin/reports', {
            title: 'Report Management - Dwelly',
            user: req.session.user,
            admin: req.admin,
            reports,
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: { type }
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to load reports',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// User details and edit page
router.get('/users/:id', isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.*, d.name as department_name, c.name as course_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.department_id
            LEFT JOIN courses c ON u.course_id = c.course_id
            WHERE u.user_id = ? AND u.is_deleted = 0
        `, [req.params.id]);

        if (users.length === 0) {
            return res.status(404).render('error', {
                title: '404 - User Not Found',
                message: 'User not found'
            });
        }

        const user = users[0];

        // Get user's posts
        const [posts] = await pool.query(`
            SELECT p.*, rt.display_name as type_display,
                   COUNT(DISTINCT r.report_id) as report_count
            FROM posts p
            JOIN room_types rt ON p.type_id = rt.type_id
            LEFT JOIN reports r ON p.post_id = r.post_id AND r.is_deleted = 0
            WHERE p.user_id = ? AND p.is_deleted = 0
            GROUP BY p.post_id
            ORDER BY p.created_at DESC
        `, [req.params.id]);

        // Get user's reports
        const [reports] = await pool.query(`
            SELECT r.*, p.street, p.barangay
            FROM reports r
            JOIN posts p ON r.post_id = p.post_id
            WHERE r.reporter_id = ? AND r.is_deleted = 0
            ORDER BY r.created_at DESC
        `, [req.params.id]);

        // Get departments and courses for editing
        const [departments] = await pool.query('SELECT * FROM departments WHERE is_deleted = 0 ORDER BY name');
        const [courses] = await pool.query('SELECT * FROM courses WHERE is_deleted = 0 ORDER BY name');

        res.render('admin/user-details', {
            title: `User: ${user.full_name} - Dwelly`,
            user: req.session.user,
            admin: req.admin,
            targetUser: user,
            posts,
            reports,
            departments,
            courses
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).render('error', {
            title: 'Error - Dwelly',
            message: 'Failed to load user details',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Update user
router.post('/users/:id/update', isAdmin, async (req, res) => {
    try {
        const { full_name, email, phone_number, role, year_level, department_id, course_id } = req.body;

        await pool.query(`
            UPDATE users SET 
                full_name = ?, 
                email = ?, 
                phone_number = ?, 
                role = ?, 
                year_level = ?, 
                department_id = ?, 
                course_id = ?
            WHERE user_id = ?
        `, [full_name, email, phone_number, role, year_level || null, department_id || null, course_id || null, req.params.id]);

        // Log the action
        await pool.query(`
            INSERT INTO audit_logs (admin_id, action_type, table_name)
            VALUES (?, ?, ?)
        `, [req.admin.user_id, 'update', 'users']);

        req.flash('success', 'User updated successfully');
        res.redirect(`/admin/users/${req.params.id}`);
    } catch (error) {
        console.error('Error updating user:', error);
        req.flash('error', 'Failed to update user');
        res.redirect(`/admin/users/${req.params.id}`);
    }
});

// Block/Unblock user
router.post('/users/:id/toggle-block', isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT is_blocked FROM users WHERE user_id = ?', [req.params.id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newStatus = !users[0].is_blocked;
        
        await pool.query('UPDATE users SET is_blocked = ? WHERE user_id = ?', [newStatus, req.params.id]);

        // Log the action
        await pool.query(`
            INSERT INTO audit_logs (admin_id, action_type, table_name)
            VALUES (?, ?, ?)
        `, [req.admin.user_id, newStatus ? 'block' : 'unblock', 'users']);

        res.json({ success: true, blocked: newStatus });
    } catch (error) {
        console.error('Error toggling user block status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Flag/Unflag post
router.post('/posts/:id/toggle-flag', isAdmin, async (req, res) => {
    try {
        const [posts] = await pool.query('SELECT is_flagged FROM posts WHERE post_id = ?', [req.params.id]);
        
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const newStatus = !posts[0].is_flagged;
        
        await pool.query('UPDATE posts SET is_flagged = ? WHERE post_id = ?', [newStatus, req.params.id]);

        // Log the action
        await pool.query(`
            INSERT INTO audit_logs (admin_id, action_type, table_name)
            VALUES (?, ?, ?)
        `, [req.admin.user_id, 'update', 'posts']);

        res.json({ success: true, flagged: newStatus });
    } catch (error) {
        console.error('Error toggling post flag status:', error);
        res.status(500).json({ error: 'Failed to update post status' });
    }
});

// Archive post
router.post('/posts/:id/archive', isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE posts SET status = "archived" WHERE post_id = ?', [req.params.id]);

        // Log the action
        await pool.query(`
            INSERT INTO audit_logs (admin_id, action_type, table_name)
            VALUES (?, ?, ?)
        `, [req.admin.user_id, 'update', 'posts']);

        res.json({ success: true });
    } catch (error) {
        console.error('Error archiving post:', error);
        res.status(500).json({ error: 'Failed to archive post' });
    }
});

// Delete report
router.post('/reports/:id/delete', isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE reports SET is_deleted = 1 WHERE report_id = ?', [req.params.id]);

        // Log the action
        await pool.query(`
            INSERT INTO audit_logs (admin_id, action_type, table_name)
            VALUES (?, ?, ?)
        `, [req.admin.user_id, 'delete', 'reports']);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// Delete user (with archiving)
router.post('/users/:id/delete', isAdmin, async (req, res) => {
    try {
        // Prevent admin from deleting themselves
        if (parseInt(req.params.id) === req.admin.user_id) {
            return res.status(400).json({ 
                error: 'You cannot delete your own account' 
            });
        }

        // Check if user exists
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Archive and delete the user using the archive system
        const { archiveAndDeleteUser } = require('../utils/archiveUtils');
        const result = await archiveAndDeleteUser(
            req.params.id, 
            req.admin.user_id, 
            'admin_deleted'
        );

        if (result.success) {
            // Log the action
            await pool.query(`
                INSERT INTO audit_logs (admin_id, action_type, table_name)
                VALUES (?, ?, ?)
            `, [req.admin.user_id, 'delete', 'users']);

            console.log(`✅ User ${req.params.id} archived and deleted by admin ${req.admin.user_id}`);
            res.json({ success: true, message: 'User archived and deleted successfully' });
        } else {
            console.error(`❌ Failed to archive/delete user ${req.params.id}:`, result.error);
            res.status(500).json({ error: 'Failed to delete user: ' + result.message });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete post (with archiving)
router.post('/posts/:id/delete', isAdmin, async (req, res) => {
    try {
        // Check if post exists
        const [posts] = await pool.query('SELECT * FROM posts WHERE post_id = ?', [req.params.id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Archive and delete the post using the archive system
        const { archiveAndDeletePost } = require('../utils/archiveUtils');
        const result = await archiveAndDeletePost(
            req.params.id, 
            req.admin.user_id, 
            'admin_deleted'
        );

        if (result.success) {
            // Log the action
            await pool.query(`
                INSERT INTO audit_logs (admin_id, action_type, table_name)
                VALUES (?, ?, ?)
            `, [req.admin.user_id, 'delete', 'posts']);

            console.log(`✅ Post ${req.params.id} archived and deleted by admin ${req.admin.user_id}`);
            res.json({ success: true, message: 'Post archived and deleted successfully' });
        } else {
            console.error(`❌ Failed to archive/delete post ${req.params.id}:`, result.error);
            res.status(500).json({ error: 'Failed to delete post: ' + result.message });
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

module.exports = router; 