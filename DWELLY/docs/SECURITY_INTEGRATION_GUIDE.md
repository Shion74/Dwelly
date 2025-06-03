# Dwelly Security Framework Integration Guide

## Overview

This guide will help you integrate the comprehensive automated security framework into your Dwelly application. The framework provides:

- **Automated Content Moderation** - Detects spam, scams, inappropriate content
- **Input Validation & Sanitization** - Prevents XSS, SQL injection, and other attacks
- **Rate Limiting** - Protects against DDoS and abuse
- **Audit Logging** - Tracks all security events for compliance
- **CSRF Protection** - Prevents cross-site request forgery
- **File Upload Security** - Validates and secures image uploads
- **IP-based Access Control** - Blocks suspicious IPs
- **Failed Login Protection** - Prevents brute force attacks

## Installation Steps

### 1. Install Dependencies

```bash
cd DWELLY
npm install
```

### 2. Initialize Security Framework

```bash
npm run security:init
```

This will:
- Create audit logging tables
- Add security columns to existing tables
- Set up moderation queue
- Configure default security settings

### 3. Update app.js

Replace your existing app.js middleware section with this secured version:

```javascript
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const compression = require('compression');
const morgan = require('morgan');

// Import security middleware
const {
    rateLimiters,
    moderateContent,
    validateUserRegistration,
    validateUploadedImages,
    auditLogger,
    securityHeaders,
    csrfProtection,
    detectSuspiciousActivity
} = require('./middleware/security');

const { auditMiddleware } = require('./middleware/auditSystem');
const { moderatePostCreation, moderateProfileUpdate } = require('./middleware/contentModerator');

const pool = require('./config/database');
const app = express();

// Security headers (must be first)
app.use(securityHeaders);

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
app.use('/auth/login', rateLimiters.auth);
app.use('/auth/register', rateLimiters.auth);
app.use('/listings/create', rateLimiters.posting);
app.use('/api/', rateLimiters.search);
app.use('/', rateLimiters.general);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/listings', express.static(path.join(__dirname, 'public/uploads/listings')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'strict'
    }
}));

app.use(flash());

// CSRF Protection
app.use(csrfProtection);

// Suspicious activity detection
app.use(detectSuspiciousActivity);

// Audit logging
app.use(auditMiddleware);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

// Secure file upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/listings';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 6 // Max 6 files
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

app.locals.upload = upload;

// Routes with security middleware
const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const favoritesRouter = require('./routes/favorites');

app.use('/', require('./routes/index'));
app.use('/auth', authRoutes);
app.use('/listings', listingRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/favorites', favoritesRouter);

// ... rest of your app.js code
```

### 4. Update Route Files

#### Update routes/auth.js

Add this to the registration route:

```javascript
// Apply validation middleware before the existing handler
router.post('/register', validateUserRegistration, async (req, res) => {
    // Your existing registration logic
});
```

Add this to the login route for audit logging:

```javascript
router.post('/login', auditLogger('login_attempt'), async (req, res) => {
    // Your existing login logic
    // Add this after successful login:
    await clearFailedAttempts(req.ip);
    
    // Add this after failed login:
    const failedAttempt = await trackFailedLogin(req.ip, email);
    if (failedAttempt.isBlocked) {
        return res.status(429).json({ error: 'Too many failed attempts. IP temporarily blocked.' });
    }
});
```

#### Update routes/listings.js

Add content moderation to listing creation:

```javascript
router.post('/create', isAuthenticated, moderatePostCreation, 
           upload.array('photos', 6), validateUploadedImages, 
           auditLogger('post_create'), async (req, res) => {
    // Your existing create listing logic
});

router.post('/:id/edit', isAuthenticated, moderateContent,
           upload.array('new_photos', 6), validateUploadedImages,
           auditLogger('post_edit'), async (req, res) => {
    // Your existing edit listing logic
});
```

#### Update routes/users.js

Add profile moderation:

```javascript
router.post('/profile', isAuthenticated, moderateProfileUpdate,
           auditLogger('profile_update'), async (req, res) => {
    // Your existing profile update logic
});
```

### 5. Environment Configuration

Create or update your `.env` file:

```bash
# Security Configuration
SESSION_SECRET=your-super-secure-session-secret-here
NODE_ENV=production
DISABLE_CSRF=false

# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=dwelly_db

# Security Settings
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=60
MAX_FILE_SIZE_MB=5
CONTENT_MODERATION_ENABLED=true
AUDIT_LOGGING_ENABLED=true

# Rate Limiting
RATE_LIMIT_GENERAL=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_POSTING=10
RATE_LIMIT_SEARCH=30
```

### 6. Update Frontend Forms

Add CSRF tokens to all your forms. In your EJS templates:

```html
<!-- Add this hidden input to all POST forms -->
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

Example for create listing form:

```html
<form action="/listings/create" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
    <!-- Your existing form fields -->
</form>
```

## Testing the Security Framework

### 1. Test Content Moderation

Try creating a post with:
- Profanity or inappropriate language
- Spam keywords like "urgent", "call now", "100% guaranteed"
- Scam patterns like "send money", "wire transfer"
- Suspicious housing terms like "no deposit", "owner overseas"

The system should either reject the content or flag it for review.

### 2. Test Rate Limiting

Try to:
- Make multiple rapid requests to any endpoint
- Attempt multiple failed logins
- Create multiple posts quickly

You should receive rate limit error messages.

### 3. Test File Upload Security

Try uploading:
- Non-image files
- Files larger than 5MB
- Files with suspicious names

The system should reject invalid uploads.

### 4. View Security Reports

```bash
npm run security:report
```

This generates a comprehensive security report showing:
- Failed login attempts
- Content moderation actions
- Suspicious activities
- Rate limit violations

## Security Monitoring Dashboard

### Admin Security Panel

The framework includes an admin dashboard accessible at `/admin/security` that shows:

- **Real-time Security Alerts**
- **Content Moderation Queue**
- **Failed Login Attempts**
- **IP Access Control**
- **Audit Log Viewer**
- **Security Settings Configuration**

### Setting Up Alerts

For production, consider integrating with:
- Email notifications for critical security events
- Slack/Discord webhooks for real-time alerts
- Log aggregation services like ELK Stack
- Monitoring tools like New Relic or DataDog

## Security Best Practices

### 1. Regular Security Scans
```bash
# Run weekly content analysis
npm run security:scan

# Generate monthly security reports
npm run security:report
```

### 2. Monitor Key Metrics
- Failed login attempts per IP
- Content moderation reject rates
- Rate limit violations
- File upload rejections

### 3. Update Security Settings

Access `/admin/security/settings` to adjust:
- Rate limits based on usage patterns
- Content moderation sensitivity
- IP blocking duration
- File upload restrictions

### 4. Regular Updates
```bash
# Keep security dependencies updated
npm audit
npm update
```

## Troubleshooting

### Common Issues

1. **CSRF Token Errors**
   - Ensure all forms include the CSRF token
   - Check session configuration

2. **Rate Limit Too Restrictive**
   - Adjust limits in security settings
   - Consider user behavior patterns

3. **Content Moderation Too Strict**
   - Review moderation patterns
   - Adjust scoring thresholds

4. **File Upload Issues**
   - Check file size limits
   - Verify image validation

## Support and Maintenance

### Regular Tasks

- **Daily**: Monitor security alerts and failed logins
- **Weekly**: Review moderation queue and flagged content
- **Monthly**: Analyze security reports and adjust settings
- **Quarterly**: Update dependencies and security patches

### Performance Monitoring

The security framework includes performance tracking:
- Middleware execution times
- Database query optimization
- Memory usage monitoring
- Rate limit effectiveness

## Conclusion

This comprehensive security framework provides enterprise-level protection for your Dwelly application. It automatically handles the most common security threats while providing detailed logging and monitoring capabilities.

For questions or issues, refer to the middleware files for detailed implementation or create an issue in your project repository. 