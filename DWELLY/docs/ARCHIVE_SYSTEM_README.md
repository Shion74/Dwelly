# Dwelly Archive System Documentation

## Overview

The Dwelly Archive System is a comprehensive data preservation solution that ensures no data is permanently lost when users delete posts or when administrators delete users/posts. Instead of permanent deletion, all data is archived to dedicated archive tables with full traceability.

## Features

### 🗄️ Complete Data Preservation
- **Posts**: All post data, photos, amenities, room details, ratings, favorites, and reports
- **Users**: User profiles, all their posts, and related data
- **Metadata**: Who deleted what, when, and why

### 🔒 Transaction Safety
- Database transactions ensure data consistency
- Rollback capability if archiving fails
- Proper error handling and logging

### 👥 Admin Tracking
- Records which admin performed deletions
- Distinguishes between user-initiated and admin-initiated deletions
- Integrates with existing audit log system

### 🎯 User Experience
- Strong confirmation dialogs prevent accidental deletions
- Clear warnings about permanent nature of deletions
- Visual feedback during deletion process
- Informative success/error messages

## Database Schema

### Archive Tables

#### `archived_posts`
Stores deleted post data with metadata:
- Original post data (title, description, price, location, etc.)
- `deleted_by` - ID of user/admin who deleted the post
- `deletion_reason` - Reason for deletion (user_deleted, admin_deleted, etc.)
- `deleted_at` - Timestamp of deletion

#### `archived_users`
Stores deleted user data:
- Original user data (name, email, role, etc.)
- `deleted_by` - ID of admin who deleted the user
- `deletion_reason` - Reason for deletion
- `deleted_at` - Timestamp of deletion

#### `archived_photos`
Preserves photo file paths and metadata:
- `file_path` - Original photo file path
- `archived_reason` - Why the photo was archived

#### `archived_post_amenities`
Saves amenity data (both default and custom):
- `amenity_name` - Name of the amenity
- `amenity_type` - 'default' or 'custom'

#### `archived_rooms`
Room details and specifications:
- `number_of_rooms` - Room count
- `bathroom_type` - Private or shared
- `room_type` - Type of room

#### `archived_favorites`
User favorite relationships:
- Preserves which users favorited which posts

#### `archived_ratings`
User ratings and comments:
- `stars` - Rating value
- `comment` - User comment

#### `archived_reports`
Report data and status:
- `report_type` - Type of report (scam, occupied, other)
- `reason` - Report reason/description
- `status` - Report status

### Database Views

#### `archived_post_complete`
Provides complete post information with related data:
```sql
SELECT * FROM archived_post_complete WHERE post_id = ?;
```

#### `archived_user_complete`
Provides complete user information with statistics:
```sql
SELECT * FROM archived_user_complete WHERE user_id = ?;
```

## API Functions

### Archive Utilities (`utils/archiveUtils.js`)

#### `archivePost(postId, deletedBy, deletionReason)`
Archives a post and all its related data before deletion.

**Parameters:**
- `postId` - ID of the post to archive
- `deletedBy` - ID of user/admin performing deletion
- `deletionReason` - Reason for deletion (default: 'user_deleted')

#### `archiveUser(userId, deletedBy, deletionReason)`
Archives a user and all their related data before deletion.

**Parameters:**
- `userId` - ID of the user to archive
- `deletedBy` - ID of admin performing deletion
- `deletionReason` - Reason for deletion (default: 'admin_deleted')

#### `archiveAndDeletePost(postId, deletedBy, deletionReason)`
Complete workflow: archives post data then deletes from live tables.

#### `archiveAndDeleteUser(userId, deletedBy, deletionReason)`
Complete workflow: archives user data then deletes from live tables.

#### `getArchivedPost(postId)`
Retrieves archived post data by original post ID.

#### `getArchivedUser(userId)`
Retrieves archived user data by original user ID.

## Implementation Details

### User Post Deletion
**Route:** `POST /listings/:id/delete`
**File:** `routes/listings.js`

```javascript
const { archiveAndDeletePost } = require('../utils/archiveUtils');
const result = await archiveAndDeletePost(
    req.params.id, 
    req.session.user.id, 
    'user_deleted'
);
```

### Admin User Deletion
**Route:** `POST /admin/users/:id/delete`
**File:** `routes/admin.js`

```javascript
const { archiveAndDeleteUser } = require('../utils/archiveUtils');
const result = await archiveAndDeleteUser(
    req.params.id, 
    req.admin.user_id, 
    'admin_deleted'
);
```

### Admin Post Deletion
**Route:** `POST /admin/posts/:id/delete`
**File:** `routes/admin.js`

```javascript
const { archiveAndDeletePost } = require('../utils/archiveUtils');
const result = await archiveAndDeletePost(
    req.params.id, 
    req.admin.user_id, 
    'admin_deleted'
);
```

## Frontend Integration

### User Confirmation Dialogs
Strong confirmation dialogs require users to type "DELETE" to confirm:

```javascript
function deletePost(postId) {
    const confirmation = prompt('Type "DELETE" to confirm:');
    if (confirmation === 'DELETE') {
        // Proceed with deletion
    }
}
```

### Admin Interface
- **User Details Page**: Delete user button with comprehensive warnings
- **Posts Management**: Delete post button with data archiving information
- Visual feedback during deletion process
- Success/error message display

## Setup Instructions

### 1. Create Archive Tables
```bash
node run_archive_setup.js
```

### 2. Test Archive System
```bash
node test_archive_tables.js
```

### 3. Verify Integration
The archive system is automatically integrated into:
- User post deletion workflow
- Admin user deletion workflow
- Admin post deletion workflow

## Data Recovery

### Retrieving Archived Data
```javascript
// Get archived post
const archivedPost = await getArchivedPost(postId);

// Get archived user
const archivedUser = await getArchivedUser(userId);

// Query archive tables directly
const [posts] = await pool.query('SELECT * FROM archived_posts WHERE post_id = ?', [postId]);
```

### Archive Data Analysis
```sql
-- Posts deleted by users vs admins
SELECT deletion_reason, COUNT(*) as count 
FROM archived_posts 
GROUP BY deletion_reason;

-- Most active admin deletions
SELECT deleted_by, COUNT(*) as deletions 
FROM archived_posts 
WHERE deletion_reason = 'admin_deleted' 
GROUP BY deleted_by;

-- Archive data by date
SELECT DATE(deleted_at) as date, COUNT(*) as deletions 
FROM archived_posts 
GROUP BY DATE(deleted_at) 
ORDER BY date DESC;
```

## Security Considerations

### Data Protection
- Archive tables preserve sensitive data (passwords, emails)
- Access should be restricted to authorized administrators
- Consider encryption for sensitive archived data

### Audit Trail
- All deletions are logged with admin ID and timestamp
- Integration with existing audit log system
- Deletion reasons provide context for data governance

## Maintenance

### Regular Cleanup
Consider implementing periodic cleanup of very old archived data:

```sql
-- Example: Delete archives older than 7 years
DELETE FROM archived_posts WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 7 YEAR);
```

### Monitoring
- Monitor archive table sizes
- Track deletion patterns
- Alert on unusual deletion activity

## Troubleshooting

### Common Issues

1. **Transaction Rollback**: If archiving fails, the transaction rolls back and no data is deleted
2. **Missing Archive Tables**: Run `node run_archive_setup.js` to create tables
3. **Permission Errors**: Ensure database user has CREATE, INSERT, DELETE permissions

### Error Handling
The system includes comprehensive error handling:
- Database connection errors
- Transaction failures
- File system errors (for photo deletion)
- Invalid user permissions

## Future Enhancements

### Potential Improvements
1. **Archive Viewer Interface**: Admin interface to browse archived data
2. **Data Restoration**: Ability to restore archived posts/users
3. **Archive Export**: Export archived data for backup/compliance
4. **Automated Cleanup**: Scheduled cleanup of old archives
5. **Archive Statistics**: Dashboard showing archive metrics

### Performance Optimization
1. **Indexing**: Additional indexes on frequently queried fields
2. **Partitioning**: Partition archive tables by date for better performance
3. **Compression**: Compress old archive data to save space

## Conclusion

The Dwelly Archive System provides a robust, safe, and traceable approach to data deletion. It ensures data preservation while maintaining the user experience of "deleting" content, with full administrative oversight and audit capabilities.

For questions or issues, refer to the troubleshooting section or contact the development team. 