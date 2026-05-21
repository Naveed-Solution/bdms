/**
 * Reset Admin Credentials Script
 * 
 * This script resets the admin account credentials to defaults:
 * - Email: admin@bdms.com
 * - Password: admin123
 * 
 * Use this if you've forgotten admin credentials or need to restore defaults.
 * 
 * Usage: node reset-admin.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath);

const DEFAULT_ADMIN = {
  id: 'admin-default',
  name: 'System Administrator',
  email: 'admin@bdms.com',
  password: 'admin123',
  role: 'admin',
  account_status: 'active'
};

console.log('🔄 Resetting admin credentials...\n');

db.serialize(() => {
  // Check if admin exists
  db.get(`SELECT * FROM users WHERE id = ?`, [DEFAULT_ADMIN.id], (err, admin) => {
    if (err) {
      console.error('❌ Error checking admin:', err);
      db.close();
      return;
    }

    if (admin) {
      // Update existing admin
      db.run(`
        UPDATE users 
        SET email = ?, password = ?, name = ?, account_status = ?
        WHERE id = ?
      `, [DEFAULT_ADMIN.email, DEFAULT_ADMIN.password, DEFAULT_ADMIN.name, DEFAULT_ADMIN.account_status, DEFAULT_ADMIN.id], function(err) {
        if (err) {
          console.error('❌ Error updating admin:', err);
        } else {
          console.log('✅ Admin credentials updated successfully!');
          displayAdminInfo();
        }
      });
    } else {
      // Create new admin
      db.run(`
        INSERT INTO users (id, name, email, password, role, account_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      `, [DEFAULT_ADMIN.id, DEFAULT_ADMIN.name, DEFAULT_ADMIN.email, DEFAULT_ADMIN.password, DEFAULT_ADMIN.role, DEFAULT_ADMIN.account_status], function(err) {
        if (err) {
          console.error('❌ Error creating admin:', err);
        } else {
          console.log('✅ Admin account created successfully!');
          displayAdminInfo();
        }
      });
    }
  });

  function displayAdminInfo() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     ADMIN CREDENTIALS RESET            ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Email:    ${DEFAULT_ADMIN.email.padEnd(27)}║`);
    console.log(`║  Password: ${DEFAULT_ADMIN.password.padEnd(27)}║`);
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log('✅ You can now login with these credentials.\n');
    
    db.close();
  }
});

