# 🛠️ Dwelly Scripts

This folder contains setup scripts, database migrations, and utility files for the Dwelly application.

## 📁 Directory Structure

### 🗄️ Database Setup
- **[create_archive_system.sql](create_archive_system.sql)** - SQL script to set up the archive system tables and procedures
- **[run_archive_setup.js](run_archive_setup.js)** - Node.js script to execute the archive system setup

### 🔒 Security Scripts
- **[initializeSecurity.js](initializeSecurity.js)** - Initialize security middleware and CSRF protection
- **[securityScan.js](securityScan.js)** - Security vulnerability scanner for the application
- **[generateSecurityReport.js](generateSecurityReport.js)** - Generate comprehensive security audit reports

### 🗺️ Geolocation Testing
- **[testGeoLocation.js](testGeoLocation.js)** - Test script for geolocation extraction functionality

### 🧪 Tests & Debugging
- **[tests/](tests/)** - Directory containing test files and debugging utilities
  - **[test_archive_tables.js](tests/test_archive_tables.js)** - Tests for archive system functionality
  - **[debug_deletion.js](tests/debug_deletion.js)** - Debug utility for deletion operations

## 🚀 Quick Start

### Setting Up Archive System
```bash
# Run the archive system setup
node scripts/run_archive_setup.js
```

### Security Operations
```bash
# Initialize security features
node scripts/initializeSecurity.js

# Run security scan
node scripts/securityScan.js

# Generate security report
node scripts/generateSecurityReport.js
```

### Testing Geolocation
```bash
# Test geolocation extraction
node scripts/testGeoLocation.js
```

### Running Tests
```bash
# Test archive functionality
node scripts/tests/test_archive_tables.js

# Debug deletion issues
node scripts/tests/debug_deletion.js
```

## ⚠️ Important Notes

- **Database Connection**: All scripts require proper database configuration in `config/database.js`
- **Environment**: Ensure you're running these scripts from the main application directory
- **Permissions**: Some scripts may require admin privileges for database operations
- **Backup**: Always backup your database before running setup or migration scripts

## 🔧 Script Purposes

### Setup Scripts
- Initialize database tables and procedures
- Set up archive system for data lifecycle management
- Configure necessary database triggers and constraints
- Initialize security middleware and protections

### Security Scripts
- Scan for vulnerabilities and security issues
- Generate audit reports and compliance checks
- Initialize CSRF protection and content moderation

### Test Scripts
- Validate functionality of archive operations
- Test user deletion workflows
- Debug data consistency issues
- Verify database integrity
- Test geolocation extraction accuracy

## 📋 Prerequisites

1. Node.js installed
2. MySQL/MariaDB running
3. Database credentials configured
4. npm dependencies installed (`npm install`)

## 🆘 Troubleshooting

If scripts fail:
1. Check database connection settings
2. Verify database user permissions
3. Ensure tables don't already exist (for setup scripts)
4. Check console output for specific error messages
5. Verify API keys for geolocation testing

---

*Part of the Dwelly Student Housing Platform*
*See [../docs/](../docs/) for complete documentation* 