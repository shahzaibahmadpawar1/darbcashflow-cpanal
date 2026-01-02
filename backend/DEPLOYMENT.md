# Deployment Guide: cPanel + MySQL

This guide walks you through deploying the Petroleum Station Management System to cPanel (backend) with MySQL database.

## Prerequisites

- cPanel hosting account with Node.js support
- MySQL database access (via cPanel)
- FTP/SSH access to cPanel
- Cloudinary account (optional, for receipt image uploads)

## Step 1: Set Up MySQL Database

### 1.1 Create MySQL Database in cPanel

1. Log in to your cPanel account
2. Navigate to **MySQL Databases** (under Databases section)
3. Create a new database:
   - Enter database name (e.g., `cashflow_db`)
   - Click "Create Database"
4. Create a database user:
   - Enter username and password
   - Click "Create User"
5. Add user to database:
   - Select the user and database
   - Grant ALL PRIVILEGES
   - Click "Make Changes"

### 1.2 Get Database Connection Details

From cPanel MySQL Databases page, note:
- **Database Name**: `cpanel_username_dbname`
- **Database User**: `cpanel_username_dbuser`
- **Database Host**: Usually `localhost` (check cPanel for actual host)
- **Port**: Usually `3306` (default MySQL port)

### 1.3 Import Database Schema

1. Navigate to **phpMyAdmin** in cPanel
2. Select your database
3. Click **Import** tab
4. Choose the `database` SQL file from the project root
5. Click **Go** to import

Alternatively, use command line (if SSH access available):
```bash
mysql -u username -p database_name < database
```

## Step 2: Prepare Backend for cPanel

### 2.1 Update Environment Variables

Create a `.env` file in the backend directory with:

```env
# Database
DATABASE_URL=mysql://username:password@host:3306/database_name
# Example: DATABASE_URL=mysql://user_dbuser:password123@localhost:3306/user_cashflow_db

# JWT
JWT_SECRET=your-secret-key-min-32-characters-long
JWT_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=5000

# File Uploads
UPLOAD_DIR=/home/username/public_html/uploads/receipts
BASE_URL=https://yourdomain.com

# CORS
FRONTEND_URL=https://yourdomain.com

# Cloudinary (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Important Notes:**
- Replace `username` with your cPanel username
- Use absolute paths for `UPLOAD_DIR`
- Update `BASE_URL` and `FRONTEND_URL` with your actual domain

### 2.2 Install Dependencies

1. Upload backend files to cPanel (via FTP or File Manager)
2. Navigate to backend directory via SSH or Terminal in cPanel
3. Install dependencies:
   ```bash
   npm install --production
   ```

### 2.3 Build the Application

```bash
npm run build
```

This creates the `dist` folder with compiled JavaScript.

### 2.4 Create Upload Directory

Create the uploads directory for receipt storage:

```bash
mkdir -p uploads/receipts
chmod 755 uploads
chmod 755 uploads/receipts
```

Or via cPanel File Manager:
1. Navigate to backend directory
2. Create `uploads` folder
3. Inside `uploads`, create `receipts` folder
4. Set permissions: `755` for both folders

## Step 3: Configure Node.js App in cPanel

### 3.1 Setup Node.js Application

1. In cPanel, navigate to **Node.js** (if available) or **Setup Node.js App**
2. Click **Create Application**
3. Configure:
   - **Node.js Version**: Select latest LTS (e.g., 18.x or 20.x)
   - **Application Mode**: Production
   - **Application Root**: `/home/username/public_html/backend` (or your backend path)
   - **Application URL**: `/api` or `/backend` (or your preferred path)
   - **Application Startup File**: `dist/server.js`
   - **Load App File**: `.env`

4. Click **Create**

### 3.2 Set Environment Variables

In the Node.js App settings:
1. Click **Edit** on your application
2. Add environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `NODE_ENV=production`
   - `PORT` (usually auto-set by cPanel)
   - `UPLOAD_DIR`
   - `BASE_URL`
   - `FRONTEND_URL`
   - Cloudinary variables (if using)

3. Click **Save**

### 3.3 Start/Restart Application

1. In Node.js App settings, click **Restart** or **Start**
2. Check logs for any errors

## Step 4: Configure File Serving

### 4.1 Serve Uploaded Files

Create a `.htaccess` file in the `uploads` directory (if using Apache):

```apache
Options -Indexes
<FilesMatch "\.(jpg|jpeg|png|gif|pdf)$">
    Header set Content-Disposition "inline"
</FilesMatch>
```

Or configure nginx to serve static files from the uploads directory.

### 4.2 Update Server to Serve Static Files

The Express server should serve static files. Ensure `server.ts` includes:

```typescript
import express from 'express';
import path from 'path';

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

## Step 5: Deploy Frontend

### 5.1 Build Frontend

1. Navigate to frontend directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file:
   ```env
   VITE_API_URL=https://yourdomain.com/api
   ```
4. Build:
   ```bash
   npm run build
   ```

### 5.2 Upload Frontend Files

1. Upload the `dist` folder contents to your public_html directory
2. Or configure a subdomain for the frontend

### 5.3 Update API URL

Ensure frontend `.env` or build configuration points to your backend URL.

## Step 6: Create Initial Admin User

After deployment, create an admin user. Options:

### Option A: Via API (after creating first user)

Use the register endpoint (requires authentication, so you'll need to create the first user via database).

### Option B: Via Database

1. Access phpMyAdmin in cPanel
2. Navigate to `users` table
3. Insert a new row:
   - `employee_id`: Your admin employee ID
   - `password`: Hash using bcrypt (use online tool or Node.js script)
   - `name`: Admin name
   - `role`: `Admin`
   - `station_id`: NULL
   - `area_manager_id`: NULL

### Option C: Create Seed Script

Create a script to hash password and insert admin user:

```javascript
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('your-password', 10);
  // Insert admin user using your database connection
}
```

## Step 7: Verify Deployment

### 7.1 Test Backend

1. Test health endpoint:
   ```
   https://yourdomain.com/api/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-..."
   }
   ```

2. Test login endpoint:
   ```bash
   curl -X POST https://yourdomain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"employeeId":"admin","password":"password"}'
   ```

### 7.2 Test Frontend

1. Visit your frontend URL
2. Try logging in
3. Test major features:
   - Cash flow entry
   - Inventory readings
   - File uploads (receipts)
   - User management

## Troubleshooting

### Database Connection Issues

- **Error**: "Can't reach database server"
  - Verify `DATABASE_URL` format: `mysql://user:pass@host:port/db`
  - Check database host (may not be `localhost` in cPanel)
  - Verify user has proper permissions
  - Check firewall settings

- **Error**: "Access denied"
  - Verify database username and password
  - Ensure user has privileges on the database

### File Upload Issues

- **Error**: "Failed to upload file"
  - Check `UPLOAD_DIR` path exists and has write permissions (755 or 777)
  - Verify absolute path is correct
  - Check disk space

- **Error**: "File not found" when accessing uploaded files
  - Verify static file serving is configured
  - Check file path in database matches actual file location
  - Ensure `.htaccess` or nginx config allows file access

### Node.js App Issues

- **Error**: "Application failed to start"
  - Check Node.js version compatibility
  - Review application logs in cPanel
  - Verify all environment variables are set
  - Check port availability

- **Error**: "Module not found"
  - Run `npm install` again
  - Verify `node_modules` is uploaded (or install on server)
  - Check `package.json` dependencies

### CORS Issues

- **Error**: "CORS policy blocked"
  - Verify `FRONTEND_URL` in backend environment variables
  - Check frontend `VITE_API_URL` matches backend URL
  - Ensure CORS middleware is configured correctly in `server.ts`

## Environment Variables Summary

### Backend (.env)

```
DATABASE_URL          # MySQL connection string
JWT_SECRET            # Random string, min 32 characters
JWT_EXPIRES_IN        # Token expiration (e.g., "7d")
NODE_ENV              # "production"
PORT                  # Server port (usually set by cPanel)
UPLOAD_DIR            # Absolute path to uploads directory
BASE_URL              # Your backend base URL
FRONTEND_URL          # Your frontend URL (for CORS)
CLOUDINARY_CLOUD_NAME # Optional: Cloudinary cloud name
CLOUDINARY_API_KEY    # Optional: Cloudinary API key
CLOUDINARY_API_SECRET # Optional: Cloudinary API secret
```

### Frontend (.env)

```
VITE_API_URL          # Your backend API URL
```

## Production Checklist

- [ ] MySQL database created and schema imported
- [ ] Backend dependencies installed
- [ ] Backend built successfully
- [ ] Environment variables configured
- [ ] Upload directory created with proper permissions
- [ ] Node.js app configured and running
- [ ] Frontend built and deployed
- [ ] API endpoints accessible
- [ ] File uploads working
- [ ] Admin user created
- [ ] CORS configured correctly
- [ ] Static files serving correctly
- [ ] Test all major workflows:
  - [ ] User login
  - [ ] Cash flow entry
  - [ ] Cash transfer workflow
  - [ ] Inventory readings
  - [ ] Tanker delivery
  - [ ] Receipt upload/download
- [ ] Monitor application logs
- [ ] Set up error tracking (optional)

## Additional Resources

- [cPanel Documentation](https://docs.cpanel.net/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Drizzle ORM MySQL Guide](https://orm.drizzle.team/docs/get-started-mysql)
- [Express.js Deployment](https://expressjs.com/en/advanced/best-practice-production.html)

## Support

If you encounter issues:
1. Check cPanel application logs
2. Check MySQL error logs
3. Verify all environment variables are set correctly
4. Test endpoints individually using curl or Postman
5. Check browser console for frontend errors
6. Verify file permissions on upload directory
