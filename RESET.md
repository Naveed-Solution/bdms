# 🔄 Database Reset & Management Guide

This guide contains all commands and information for managing the BDMS database, resetting data, and handling backend operations.

---

## 📋 Table of Contents

1. [Reset Scripts](#reset-scripts)
2. [Backend Management](#backend-management)
3. [Port Conflicts](#port-conflicts)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Reset Scripts

All reset scripts are located in the `backend/` directory.

### 1. Reset Donor Ineligibilities

**Purpose:** Makes all donors eligible to donate immediately by clearing last donation dates and ineligibility records.

**File:** `backend/reset-ineligibilities.js`

**What it does:**
- Sets `last_donated` to NULL for all donors
- Deletes all ineligibility records
- Makes approved donors immediately eligible

**Command:**
```bash
cd backend
node reset-ineligibilities.js
```

**When to use:**
- Testing donor availability features
- Resetting donor eligibility timers
- After importing test data

---

### 2. Delete All Blood Requests

**Purpose:** Removes all blood request data from the database.

**File:** `backend/delete-requests.js`

**What it does:**
- Deletes all blood requests
- Removes accepted donor records
- Clears request cancellations
- Deletes donation ratings
- Removes request-related notifications

**Command:**
```bash
cd backend
node delete-requests.js
```

**When to use:**
- Cleaning up test requests
- Starting fresh with blood requests
- Before demo or production deployment

---

### 3. Delete All Users (Except Admin)

**Purpose:** Removes all user accounts while preserving the admin account.

**File:** `backend/delete-users.js`

**What it does:**
- Deletes all donor profiles
- Deletes all recipient profiles
- Removes all user-related data
- Preserves admin account (admin@bdms.com)
- Cleans up orphaned records

⚠️ **WARNING:** This is a destructive operation!

**Command:**
```bash
cd backend
node delete-users.js
```

**When to use:**
- Complete database reset
- Removing all test users
- Privacy compliance (data deletion)
- Before production deployment

---

### 4. Reset Admin Credentials

**Purpose:** Restores admin account to default credentials.

**File:** `backend/reset-admin.js`

**What it does:**
- Resets admin email to `admin@bdms.com`
- Resets admin password to `admin123`
- Creates admin account if it doesn't exist
- Activates admin account

**Command:**
```bash
cd backend
node reset-admin.js
```

**Default Credentials After Reset:**
```
Email:    admin@bdms.com
Password: admin123
```

**When to use:**
- Forgot admin password
- Admin account locked
- Initial setup
- After database corruption

---

## 🚀 Backend Management

### Starting the Backend

#### Method 1: Using Batch File (Windows)

**File:** `start-backend.bat`

**What it does:**
- Starts the backend server on port 3000
- Simple startup without port checking

**Command:**
```bash
start-backend.bat
```

**When to use:**
- First time starting the backend
- Port 3000 is available
- Clean system state

---

#### Method 2: Restart with Port Check (Windows)

**File:** `restart-backend.bat`

**What it does:**
- Checks if port 3000 is in use
- Kills any process using port 3000
- Waits 2 seconds for cleanup
- Starts fresh backend server

**Command:**
```bash
restart-backend.bat
```

**When to use:**
- Backend is already running
- Port 3000 conflict error
- After making backend code changes
- Backend crashed but process still exists

---

#### Method 3: Manual Start (All Platforms)

**Standard Start:**
```bash
cd backend
node server.js
```

**With Port Cleanup (PowerShell):**
```powershell
cd backend
$backendPid = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($backendPid) {
    Write-Host "Stopping existing backend on port 3000..."
    taskkill /F /PID $backendPid
    Start-Sleep -Seconds 2
}
Write-Host "Starting backend server..."
node server.js
```

**With Port Cleanup (Linux/Mac):**
```bash
cd backend
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2
node server.js
```

---

## 🔌 Port Conflicts

### When Port 3000 is Not Available

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

This means another process is using port 3000.

### Solution 1: Kill Process on Port 3000

**Windows (PowerShell):**
```powershell
# Find process on port 3000
$pid = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess

# Kill the process
if ($pid) {
    taskkill /F /PID $pid
    Write-Host "Killed process $pid on port 3000"
} else {
    Write-Host "No process found on port 3000"
}
```

**Windows (CMD):**
```cmd
netstat -ano | findstr :3000
taskkill /F /PID <PID_NUMBER>
```

**Linux/Mac:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or find PID first
lsof -i:3000
kill -9 <PID>
```

### Solution 2: Use Restart Script

Simply run:
```bash
restart-backend.bat
```

This automatically handles port cleanup.

---

## 📝 Common Tasks

### Complete Database Reset

**Reset everything to clean state:**

```bash
# 1. Stop backend
# Press Ctrl+C in backend terminal

# 2. Delete all users except admin
cd backend
node delete-users.js

# 3. Delete all blood requests
node delete-requests.js

# 4. Reset donor ineligibilities
node reset-ineligibilities.js

# 5. Reset admin credentials
node reset-admin.js

# 6. Restart backend
cd ..
restart-backend.bat
```

---

### Quick Clean for Testing

**Remove test data but keep users:**

```bash
cd backend

# Delete all requests
node delete-requests.js

# Reset donor eligibility
node reset-ineligibilities.js

# Restart backend
cd ..
restart-backend.bat
```

---

### Recover Admin Access

**If you can't login as admin:**

```bash
cd backend

# Reset admin credentials
node reset-admin.js

# You can now login with:
# Email: admin@bdms.com
# Password: admin123
```

---

### Production Deployment Prep

**Clean database before going live:**

```bash
cd backend

# 1. Remove all test users
node delete-users.js

# 2. Remove all test requests
node delete-requests.js

# 3. Reset donor eligibility
node reset-ineligibilities.js

# 4. Verify admin credentials
node reset-admin.js

# 5. Restart backend
cd ..
restart-backend.bat
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Symptom:** Backend crashes immediately or won't start.

**Solutions:**

1. **Check port 3000:**
   ```bash
   netstat -ano | findstr :3000
   ```

2. **Kill conflicting process:**
   ```bash
   restart-backend.bat
   ```

3. **Check database file:**
   ```bash
   # Ensure bdms.db exists
   ls backend/bdms.db
   ```

4. **Reinstall dependencies:**
   ```bash
   cd backend
   npm install
   node server.js
   ```

---

### Database Corruption

**Symptom:** Strange errors, missing data, or crashes.

**Solution:**

1. **Backup current database:**
   ```bash
   copy backend\bdms.db backend\bdms.backup.db
   ```

2. **Delete and recreate:**
   ```bash
   del backend\bdms.db
   cd backend
   node server.js
   ```
   
   The server will create a fresh database.

3. **Reset admin:**
   ```bash
   # Stop server (Ctrl+C)
   node reset-admin.js
   node server.js
   ```

---

### Reset Script Errors

**Symptom:** Reset scripts show database errors.

**Solution:**

1. **Stop backend first:**
   - Press `Ctrl+C` in backend terminal
   - Wait for it to fully stop

2. **Run reset script:**
   ```bash
   cd backend
   node <script-name>.js
   ```

3. **Restart backend:**
   ```bash
   cd ..
   restart-backend.bat
   ```

---

### Can't Delete Users

**Symptom:** `delete-users.js` fails with foreign key errors.

**Solution:**

The script deletes in correct order, but if issues persist:

```bash
# Run scripts in this order:
cd backend
node delete-requests.js    # First - removes dependencies
node delete-users.js       # Second - removes users
node reset-ineligibilities.js  # Third - cleanup
```

---

## 📊 Verification Commands

### Check User Count

**SQLite:**
```bash
cd backend
sqlite3 bdms.db "SELECT role, COUNT(*) as count FROM users GROUP BY role;"
```

**Expected after reset:**
```
admin|1
```

---

### Check Request Count

**SQLite:**
```bash
cd backend
sqlite3 bdms.db "SELECT COUNT(*) FROM blood_requests;"
```

**Expected after reset:**
```
0
```

---

### Check Donor Eligibility

**SQLite:**
```bash
cd backend
sqlite3 bdms.db "SELECT COUNT(*) FROM donor_profiles WHERE last_donated IS NOT NULL;"
```

**Expected after reset:**
```
0
```

---

## 🔐 Default Admin Credentials

After running `reset-admin.js`:

```
╔════════════════════════════════════════╗
║     ADMIN CREDENTIALS                  ║
╠════════════════════════════════════════╣
║  Email:    admin@bdms.com              ║
║  Password: admin123                    ║
╚════════════════════════════════════════╝
```

⚠️ **IMPORTANT:** Change these credentials in production!

---

## 📞 Support

If you encounter issues not covered here:

1. Check backend console for error messages
2. Review `backend/server.js` logs
3. Verify database file exists: `backend/bdms.db`
4. Try complete reset sequence
5. Check network configuration in `src/services/api.ts`

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Start backend (first time) | `start-backend.bat` |
| Restart backend (with cleanup) | `restart-backend.bat` |
| Kill port 3000 | `taskkill /F /PID $(Get-NetTCPConnection -LocalPort 3000).OwningProcess` |
| Reset admin password | `cd backend && node reset-admin.js` |
| Delete all users | `cd backend && node delete-users.js` |
| Delete all requests | `cd backend && node delete-requests.js` |
| Reset donor eligibility | `cd backend && node reset-ineligibilities.js` |
| Complete reset | Run all scripts in order |

---

**Last Updated:** December 28, 2025
**BDMS Version:** 1.0

