/**
 * Delete All Users Except Admin Script
 * 
 * This script removes all user accounts EXCEPT the admin account by:
 * - Deleting all donor and recipient profiles
 * - Deleting all user-related data (requests, notifications, etc.)
 * - Preserving only the admin account
 * 
 * ⚠️ WARNING: This is a destructive operation!
 * 
 * Usage: node delete-users.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath);

console.log('⚠️  WARNING: This will delete ALL users except admin!\n');
console.log('🔄 Starting user deletion...\n');

db.serialize(() => {
  // Delete donation ratings for non-admin users
  db.run(`
    DELETE FROM donation_ratings 
    WHERE donor_id != 'admin-default' OR recipient_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting ratings:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} donation ratings`);
    }
  });

  // Delete accepted donors for non-admin users
  db.run(`
    DELETE FROM accepted_donors 
    WHERE donor_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting accepted donors:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} accepted donor records`);
    }
  });

  // Delete request cancellations for non-admin users
  db.run(`DELETE FROM request_cancellations`, function(err) {
    if (err) {
      console.error('❌ Error deleting cancellations:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} cancellation records`);
    }
  });

  // Delete blood requests for non-admin users
  db.run(`
    DELETE FROM blood_requests 
    WHERE recipient_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting blood requests:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} blood requests`);
    }
  });

  // Delete notifications for non-admin users
  db.run(`
    DELETE FROM notifications 
    WHERE user_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting notifications:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} notifications`);
    }
  });

  // Delete donor ineligibility records
  db.run(`DELETE FROM donor_ineligibility`, function(err) {
    if (err) {
      console.error('❌ Error deleting ineligibility records:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} ineligibility records`);
    }
  });

  // Delete appeal submissions
  db.run(`
    DELETE FROM appeal_submissions 
    WHERE user_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting appeals:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} appeal submissions`);
    }
  });

  // Delete donor profiles
  db.run(`
    DELETE FROM donor_profiles 
    WHERE user_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting donor profiles:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} donor profiles`);
    }
  });

  // Delete recipient profiles
  db.run(`
    DELETE FROM recipient_profiles 
    WHERE user_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting recipient profiles:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} recipient profiles`);
    }
  });

  // Delete audit logs (except admin logins)
  db.run(`
    DELETE FROM audit_logs 
    WHERE actor_id != 'admin-default' 
      OR (actor_id = 'admin-default' AND action NOT IN ('USER_LOGIN', 'USER_LOGOUT'))
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting audit logs:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} audit log entries`);
    }
  });

  // Delete user location data
  db.run(`
    DELETE FROM user_locations 
    WHERE user_id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting locations:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} location records`);
    }
  });

  // Delete non-admin users
  db.run(`
    DELETE FROM users 
    WHERE id != 'admin-default'
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting users:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} user accounts`);
    }
  });

  // Verify results
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying deletion:', err);
    } else {
      console.log(`\n📊 Verification: ${row.count} user(s) remaining (should be 1 - admin)`);
    }
  });

  db.get(`SELECT * FROM users WHERE id = 'admin-default'`, (err, admin) => {
    if (err) {
      console.error('❌ Error checking admin:', err);
    } else if (admin) {
      console.log(`✅ Admin account preserved: ${admin.email}`);
    } else {
      console.error('❌ WARNING: Admin account not found!');
    }
    
    console.log('\n✅ User deletion complete!');
    console.log('All user accounts (except admin) have been removed.\n');
    
    db.close();
  });
});

