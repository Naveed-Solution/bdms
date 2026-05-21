# BDMS Startup Guide

Complete step-by-step guide to install, configure, and run the Blood Donation Management System from scratch.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Starting the Application](#starting-the-application)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Network Configuration](#network-configuration)
8. [Platform-Specific Setup](#platform-specific-setup)

---

## 1. Prerequisites

### Required Software

#### Node.js and npm
**Version**: Node.js 18.x or higher, npm 9.x or higher

**Installation**:

**Windows**:
```bash
# Download from official website
https://nodejs.org/en/download/

# Or use winget
winget install OpenJS.NodeJS.LTS
```

**macOS**:
```bash
# Using Homebrew
brew install node

# Or download from
https://nodejs.org/en/download/
```

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify Installation**:
```bash
node --version   # Should output: v18.x.x or higher
npm --version    # Should output: 9.x.x or higher
```

#### Expo CLI (Optional but Recommended)
```bash
npm install -g expo-cli
```

#### Git (For Version Control)
```bash
# Windows: Download from https://git-scm.com/
# macOS: Already installed or use Homebrew
brew install git

# Linux:
sudo apt-get install git
```

### Recommended Tools

- **Visual Studio Code**: Code editor
- **Android Studio**: For Android development and emulator
- **Xcode**: For iOS development (macOS only)
- **Postman**: API testing (optional)
- **SQLite Browser**: Database inspection (optional)

---

## 2. Installation

### Step 2.1: Get the Code

**If you have the repository URL**:
```bash
git clone <repository-url>
cd BDMS
```

**If you have a zip file**:
1. Extract the zip file
2. Open terminal/command prompt
3. Navigate to the extracted folder:
   ```bash
   cd path/to/BDMS
   ```

### Step 2.2: Install Frontend Dependencies

```bash
# Make sure you're in the root directory (BDMS)
npm install
```

**Expected output**:
```
added 1500+ packages in ~2-3 minutes
```

**If you encounter errors**:
```bash
# Clear npm cache
npm cache clean --force

# Try installing again
npm install --legacy-peer-deps
```

### Step 2.3: Install Backend Dependencies

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Return to root directory
cd ..
```

**Expected output**:
```
added 150+ packages in ~30 seconds
```

### Step 2.4: Verify Installation

```bash
# Check if node_modules exist
ls node_modules        # Should list many packages
ls backend/node_modules  # Should list backend packages
```

---

## 3. Configuration

### Step 3.1: Configure API Endpoint

The frontend needs to know where the backend server is running.

**Find your IP address**:

**Windows**:
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
# Example: 192.168.0.102
```

**macOS/Linux**:
```bash
ifconfig
# Look for "inet" under your active network adapter
# Example: 192.168.0.102
```

**Update API configuration**:

Open `src/services/api.ts` and update the IP address:

```typescript
// Replace with your actual IP address
export const API_BASE_URL = 'http://192.168.0.102:3000/api';
```

**Important Notes**:
- Use `localhost` ONLY if testing on web
- Use your computer's IP address for mobile devices
- Never use `localhost` for physical devices or emulators

### Step 3.2: Email Configuration (Optional)

The system uses email for verification codes. Default configuration is provided.

**To use your own Gmail**:

1. Open `backend/server.js`
2. Find the email configuration section:
   ```javascript
   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: 'your-email@gmail.com',
       pass: 'your-app-password', // Not your regular password!
     },
   });
   ```

3. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password
   - Use this password in the configuration

---

## 4. Starting the Application

### Step 4.1: Start the Backend Server

**CRITICAL**: Always start the backend FIRST before the frontend.

**Option A - Using Batch File (Windows)**:
```bash
# Double-click: start-backend.bat
# OR
start-backend.bat
```

**Option B - Command Line (All Platforms)**:
```bash
cd backend
node server.js
```

**Expected Output** (Success):
```
🚀 Email service running on port 3000
💾 Using SQLite database: E:\BDMS\BDMS\backend\bdms.db
✅ Connected to SQLite database
✅ All tables created successfully
✅ Default admin account added
📊 Admin: admin@bdmos.com / admin123
```

**Keep this terminal window OPEN!** Do not close it.

**If you see "EADDRINUSE" error**:
```bash
# Port 3000 is already in use
# Windows:
netstat -ano | findstr :3000
taskkill /PID <process-id> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

### Step 4.2: Verify Backend is Running

Open a web browser and visit:
```
http://localhost:3000/api/users
```

**You should see**:
```json
{
  "users": [
    {
      "id": "admin-default",
      "name": "System Administrator",
      "email": "admin@bdmos.com",
      "role": "admin"
    }
  ]
}
```

**If you see this JSON response → Backend is working! ✅**

**If you get an error → Backend is not running ❌**

### Step 4.3: Start the Frontend

**Open a NEW terminal window** (keep backend running in the first one).

```bash
# Navigate to root directory
cd BDMS

# Start the frontend
npm start
```

**Expected Output**:
```
Starting Metro Bundler...
Metro waiting on exp://192.168.0.102:8081
› Press w │ open web
› Press a │ open Android
› Press i │ open iOS
```

### Step 4.4: Choose Your Platform

**For Web Testing** (Recommended for first run):
```
Press 'w' in the terminal
```
- Opens in default browser
- No additional setup needed
- Best for quick testing

**For Android**:
```
Press 'a' in the terminal
```
Requirements:
- Android Studio with emulator, OR
- Physical device with Expo Go app installed

**For iOS** (macOS only):
```
Press 'i' in the terminal
```
Requirements:
- Xcode installed
- iOS Simulator configured

---

## 5. Verification

### Step 5.1: Test Backend Endpoints

**Using browser or Postman**:

1. **Get Users**:
   ```
   GET http://localhost:3000/api/users
   ```

2. **Get Blood Requests**:
   ```
   GET http://localhost:3000/api/blood-requests
   ```

3. **Test Login**:
   ```
   POST http://localhost:3000/api/auth/login
   Content-Type: application/json

   {
     "email": "admin@bdmos.com",
     "password": "admin123"
   }
   ```

**Expected**: JSON responses without errors

### Step 5.2: Test Frontend Login

1. **Open the app** (web browser or mobile device)

2. **You should see the Login screen**

3. **Test Admin Login**:
   - Email: `admin@bdmos.com`
   - Password: `admin123`

4. **If successful**:
   - You should see the Admin Dashboard
   - Statistics should load (users, donors, requests)
   - Menu should be accessible

5. **Test Registration**:
   - Click "Sign Up"
   - Fill in details
   - Select a role (Donor or User)
   - Complete registration

### Step 5.3: Verify Database

**Check if database file exists**:
```bash
ls backend/bdms.db
```

**Optional - Inspect Database**:
```bash
cd backend
sqlite3 bdms.db

# Inside SQLite:
.tables                 # List all tables
SELECT * FROM users;    # View users
SELECT * FROM blood_requests;  # View requests
.quit                   # Exit
```

---

## 6. Troubleshooting

### Issue 1: "Cannot find module" errors

**Cause**: Dependencies not installed

**Solution**:
```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### Issue 2: "EADDRINUSE: Port 3000 already in use"

**Cause**: Another process is using port 3000

**Solution**:

**Windows**:
```bash
netstat -ano | findstr :3000
taskkill /PID <ProcessId> /F
```

**macOS/Linux**:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue 3: "Network request failed" in app

**Cause**: Frontend can't reach backend

**Checklist**:
1. ✅ Is backend terminal running?
2. ✅ Does `http://localhost:3000/api/users` work in browser?
3. ✅ Did you update IP address in `src/services/api.ts`?
4. ✅ Are frontend and backend on same network?

**Solution**:
```bash
# 1. Verify backend is running
curl http://localhost:3000/api/users

# 2. Update IP address in src/services/api.ts
# Use ipconfig (Windows) or ifconfig (macOS/Linux) to find IP

# 3. Restart both backend and frontend
```

### Issue 4: Metro Bundler cache issues

**Cause**: Stale cache

**Solution**:
```bash
# Clear cache and restart
npm start -- --reset-cache
```

### Issue 5: TypeScript errors

**Cause**: Type definitions mismatch

**Solution**:
```bash
# Check for errors
npx tsc --noEmit

# Reinstall types
npm install --save-dev @types/react @types/react-native
```

### Issue 6: Database errors

**Cause**: Corrupted database or schema mismatch

**Solution**:
```bash
# Backup existing database (if needed)
cp backend/bdms.db backend/bdms.db.backup

# Delete database (it will be recreated)
rm backend/bdms.db

# Restart backend
cd backend
node server.js
```

### Issue 7: Expo Go QR code not working

**Cause**: Network configuration

**Solution**:
```bash
# Use tunnel mode
npx expo start --tunnel

# Or manually enter URL in Expo Go app
```

---

## 7. Network Configuration

### For Local Testing (Same Computer)

**Web**:
```typescript
// src/services/api.ts
export const API_BASE_URL = 'http://localhost:3000/api';
```

### For Mobile Device Testing (Same Network)

**Find your IP address**:
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

**Update configuration**:
```typescript
// src/services/api.ts
export const API_BASE_URL = 'http://192.168.0.102:3000/api';
// Replace 192.168.0.102 with YOUR IP address
```

**Firewall Settings**:
- Ensure port 3000 is not blocked
- Allow Node.js through firewall

**Windows**:
```bash
# Add firewall rule
netsh advfirewall firewall add rule name="BDMS Backend" dir=in action=allow protocol=TCP localport=3000
```

### Quick Update Script

**Windows** (`update-ip.bat`):
```batch
@echo off
echo Current IP Configuration:
ipconfig | findstr /C:"IPv4"
echo.
echo Update src/services/api.ts with your IP address
pause
```

---

## 8. Platform-Specific Setup

### Android Setup

#### Using Android Studio Emulator

1. **Install Android Studio**:
   ```
   https://developer.android.com/studio
   ```

2. **Create Virtual Device**:
   - Open Android Studio
   - Tools → Device Manager
   - Create Device
   - Select Pixel 6 (or any)
   - System Image: Android 12 or higher
   - Finish

3. **Start Emulator**:
   ```bash
   # From Android Studio, or
   emulator -avd Pixel_6_API_33
   ```

4. **Run App**:
   ```bash
   npm start
   # Press 'a'
   ```

#### Using Physical Device

1. **Install Expo Go**:
   - Google Play Store → "Expo Go"

2. **Connect to Same Network**:
   - Ensure device and computer are on same Wi-Fi

3. **Scan QR Code**:
   - Open Expo Go app
   - Scan QR code from terminal

### iOS Setup (macOS Only)

1. **Install Xcode**:
   ```bash
   # From App Store or
   xcode-select --install
   ```

2. **Install Simulator**:
   - Xcode → Preferences → Components
   - Download iOS Simulator

3. **Run App**:
   ```bash
   npm start
   # Press 'i'
   ```

### Web Setup

No additional setup required. Just press 'w' after starting the frontend.

**Supported Browsers**:
- Chrome (recommended)
- Firefox
- Safari
- Edge

---

## 9. Production Deployment Checklist

### Pre-Deployment

- [ ] Update all dependencies to stable versions
- [ ] Remove console.log statements
- [ ] Change default admin password
- [ ] Configure production email service
- [ ] Set up proper database (PostgreSQL/MySQL)
- [ ] Implement proper authentication (JWT with refresh tokens)
- [ ] Add HTTPS/SSL certificates
- [ ] Configure environment variables
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Implement rate limiting
- [ ] Add data backup strategy

### Backend Deployment

- [ ] Choose hosting (AWS, Heroku, DigitalOcean, etc.)
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] Configure domain and SSL

### Frontend Deployment

- [ ] Build production bundle
- [ ] Submit to App Store (iOS)
- [ ] Submit to Play Store (Android)
- [ ] Deploy web version to hosting

---

## 10. Development Workflow

### Daily Development

1. **Start Backend**:
   ```bash
   cd backend
   node server.js
   ```

2. **Start Frontend** (new terminal):
   ```bash
   npm start
   ```

3. **Make Changes**:
   - Edit code in `src/` directory
   - Save files
   - Metro Bundler auto-reloads

4. **Test Changes**:
   - Refresh app (R R on device)
   - Check console for errors

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

### Testing Checklist

Before considering a feature complete:

- [ ] Test on web browser
- [ ] Test on Android device/emulator
- [ ] Test on iOS device/simulator (if available)
- [ ] Test all user roles (Admin, Donor, Recipient)
- [ ] Test with network disconnected
- [ ] Check console for errors
- [ ] Test database operations
- [ ] Verify API responses

---

## 11. Quick Reference Commands

### Start Everything
```bash
# Terminal 1 - Backend
cd backend && node server.js

# Terminal 2 - Frontend
npm start
```

### Stop Everything
```bash
# Press Ctrl+C in both terminals
```

### Reset Database
```bash
rm backend/bdms.db
cd backend && node server.js
```

### Clear Cache
```bash
npm start -- --reset-cache
```

### Check Logs
```bash
# Backend logs are in the terminal
# Frontend logs: Press Shift+M in terminal or check browser console
```

---

## 12. Support & Resources

### Documentation
- README.md - Project overview
- This file - Setup instructions
- Code comments - Inline documentation

### Testing Accounts
- **Admin**: admin@bdmos.com / admin123
- **Donor**: Create via Register screen
- **Recipient**: Create via Register screen

### Common URLs
- Backend API: `http://localhost:3000/api`
- Frontend Web: `http://localhost:8081`
- Metro Bundler: `http://localhost:8081`

### Need Help?
1. Check troubleshooting section above
2. Review console logs for errors
3. Verify all prerequisites are installed
4. Ensure backend is running before frontend

---

**✅ Setup Complete! You're ready to develop and test the BDMS application.**

**Remember**: Always start the backend before the frontend!

