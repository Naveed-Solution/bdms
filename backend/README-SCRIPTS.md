# 🛠️ Backend Utility Scripts

Quick reference for all backend management scripts.

---

## 📁 Available Scripts

### 1. `reset-ineligibilities.js`
Resets all donor eligibility timers.

```bash
node reset-ineligibilities.js
```

**Effect:**
- ✅ All donors become eligible immediately
- ✅ Clears last donation dates
- ✅ Removes ineligibility records

---

### 2. `delete-requests.js`
Removes all blood request data.

```bash
node delete-requests.js
```

**Effect:**
- ✅ Deletes all blood requests
- ✅ Removes accepted donors
- ✅ Clears ratings and cancellations
- ✅ Removes request notifications

---

### 3. `delete-users.js`
Deletes all users except admin.

```bash
node delete-users.js
```

**Effect:**
- ✅ Removes all donor/recipient accounts
- ✅ Preserves admin account
- ✅ Cleans up all user data
- ⚠️ **DESTRUCTIVE OPERATION**

---

### 4. `reset-admin.js`
Resets admin credentials to defaults.

```bash
node reset-admin.js
```

**Effect:**
- ✅ Email: admin@bdms.com
- ✅ Password: admin123
- ✅ Creates admin if missing

---

### 5. `reset-database.js`
Complete database cleanup (existing script).

```bash
node reset-database.js
```

**Effect:**
- ✅ Runs all cleanup operations
- ✅ Comprehensive reset
- ✅ Preserves admin only

---

## 🚀 Quick Commands

**Complete Reset:**
```bash
node delete-users.js && node delete-requests.js && node reset-ineligibilities.js && node reset-admin.js
```

**Clean Test Data:**
```bash
node delete-requests.js && node reset-ineligibilities.js
```

**Recover Admin:**
```bash
node reset-admin.js
```

---

## ⚠️ Important Notes

1. **Always stop the backend** before running scripts
2. **Backup database** before destructive operations
3. **Scripts are idempotent** - safe to run multiple times
4. **Check verification output** after each script

---

**See RESET.md for complete documentation**

