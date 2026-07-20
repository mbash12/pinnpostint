# Scripts Directory

This directory contains utility scripts for Pin N Post application.

## Available Scripts

### Create Super Admin

Creates a super admin user with predefined credentials for initial setup and testing.

**Credentials:**
- Email: `admin@pinnpost.com`
- Password: `admin123`
- Role: `ADMIN`

**Usage:**

```bash
# Using Node.js (recommended)
npm run create-super-admin

# Using TypeScript
npm run create-super-admin:ts

# Direct execution
node scripts/create-super-admin.js
ts-node scripts/create-super-admin.ts
```

**Features:**
- ✅ Creates super admin if doesn't exist
- ✅ Updates password if admin already exists
- ✅ Handles phone number conflicts automatically
- ✅ Sets admin as active and verified
- ✅ Provides clear success/error messages

**Output Example:**
```
🚀 Creating super admin user...
✅ Super admin created successfully:
{
  "id": "cm1k...",
  "email": "admin@pinnpost.com",
  "phone": "+6281234567890",
  "firstName": "Super",
  "lastName": "Admin",
  "role": "ADMIN",
  "isActive": true,
  "isVerified": true,
  "createdAt": "2025-09-29T12:48:30.000Z"
}

📋 Login credentials:
Email: admin@pinnpost.com
Password: admin123

🔗 Use these credentials to login at: POST /api/v1/auth/admin/login
```

## Prerequisites

- Database must be running and accessible
- Prisma client must be generated (`npm run db:generate`)
- Environment variables must be configured (`.env` file)

## Security Notes

⚠️ **Important**: These scripts contain hardcoded credentials and should only be used for:
- Initial development setup
- Testing environments
- Demo purposes

**Never use these scripts in production** without changing the default credentials first.
