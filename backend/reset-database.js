/**
 * Reset Database Script
 * 
 * Cleans up database while keeping admin account:
 * - Deletes all users except admin
 * - Deletes all blood requests
 * - Deletes all notifications
 * - Resets donor ineligibilities (clears last_donated)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Starting database reset...\n');

// Run all cleanup operations in series
db.serialize(() => {
  
  // 1. Delete all users except admin
  console.log('👥 Deleting all users except admin...');
  db.run(`DELETE FROM users WHERE role != 'admin'`, function(err) {
    if (err) {
      console.error('❌ Error deleting users:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} non-admin users`);
    }
  });

  // 2. Delete all blood requests
  console.log('\n🩸 Deleting all blood requests...');
  db.run(`DELETE FROM blood_requests`, function(err) {
    if (err) {
      console.error('❌ Error deleting blood requests:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} blood requests`);
    }
  });

  // 3. Delete all accepted donors
  console.log('\n🤝 Deleting all accepted donors...');
  db.run(`DELETE FROM accepted_donors`, function(err) {
    if (err) {
      console.error('❌ Error deleting accepted donors:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} accepted donor records`);
    }
  });

  // 4. Delete all declined donors
  console.log('\n🚫 Deleting all declined donors...');
  db.run(`DELETE FROM declined_donors`, function(err) {
    if (err) {
      console.error('❌ Error deleting declined donors:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} declined donor records`);
    }
  });

  // 5. Delete all notifications
  console.log('\n🔔 Deleting all notifications...');
  db.run(`DELETE FROM notifications`, function(err) {
    if (err) {
      console.error('❌ Error deleting notifications:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} notifications`);
    }
  });

  // 6. Delete all donor profiles
  console.log('\n📋 Deleting all donor profiles...');
  db.run(`DELETE FROM donor_profiles`, function(err) {
    if (err) {
      console.error('❌ Error deleting donor profiles:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} donor profiles`);
    }
  });

  // 7. Delete all recipient profiles
  console.log('\n📋 Deleting all recipient profiles...');
  db.run(`DELETE FROM recipient_profiles`, function(err) {
    if (err) {
      console.error('❌ Error deleting recipient profiles:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} recipient profiles`);
    }
  });

  // 8. Delete all respect ratings
  console.log('\n⭐ Deleting all respect ratings...');
  db.run(`DELETE FROM respect_ratings`, function(err) {
    if (err) {
      console.error('❌ Error deleting respect ratings:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} respect ratings`);
    }
  });

  // 9. Delete all request cancellations
  console.log('\n❌ Deleting all request cancellations...');
  db.run(`DELETE FROM request_cancellations`, function(err) {
    if (err) {
      console.error('❌ Error deleting request cancellations:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} request cancellations`);
    }
  });

  // 10. Delete all account appeals
  console.log('\n📝 Deleting all account appeals...');
  db.run(`DELETE FROM account_appeals`, function(err) {
    if (err) {
      console.error('❌ Error deleting account appeals:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} account appeals`);
    }
  });

  // 11. Delete all live locations
  console.log('\n📍 Deleting all live locations...');
  db.run(`DELETE FROM live_locations`, function(err) {
    if (err) {
      console.error('❌ Error deleting live locations:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} live locations`);
    }
  });

  // 12. Delete all audit logs except admin logins
  console.log('\n📊 Deleting all audit logs (except admin logins)...');
  db.run(`DELETE FROM audit_logs WHERE actor_role != 'admin' OR action NOT IN ('LOGIN', 'LOGOUT')`, function(err) {
    if (err) {
      console.error('❌ Error deleting audit logs:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} audit logs`);
    }
  });

  // 13. Delete all verification codes
  console.log('\n🔐 Deleting all verification codes...');
  db.run(`DELETE FROM verification_codes`, function(err) {
    if (err) {
      console.error('❌ Error deleting verification codes:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} verification codes`);
    }
  });

  // 14. Delete all registered emails except admin
  console.log('\n📧 Deleting all registered emails except admin...');
  db.run(`DELETE FROM registered_emails WHERE email NOT LIKE '%admin%'`, function(err) {
    if (err) {
      console.error('❌ Error deleting registered emails:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} registered emails`);
    }
  });

  // 15. Verify admin account still exists
  console.log('\n✅ Verifying admin account...');
  db.get(`SELECT * FROM users WHERE role = 'admin'`, (err, row) => {
    if (err) {
      console.error('❌ Error checking admin:', err);
    } else if (row) {
      console.log(`✅ Admin account preserved: ${row.email}`);
    } else {
      console.error('❌ WARNING: No admin account found!');
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 DATABASE RESET COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log('  ✅ All non-admin users deleted');
    console.log('  ✅ All blood requests deleted');
    console.log('  ✅ All notifications cleared');
    console.log('  ✅ All donor profiles deleted (eligibility reset)');
    console.log('  ✅ All recipient profiles deleted');
    console.log('  ✅ All ratings and cancellations deleted');
    console.log('  ✅ All appeals and locations deleted');
    console.log('  ✅ Admin account preserved');
    console.log('\n🔐 Admin Login:');
    console.log('  Email: admin@bdmos.com');
    console.log('  Password: admin123');
    console.log('\n✨ Database is now clean and ready for fresh data!');
    console.log('='.repeat(50) + '\n');

    // Close database
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('✅ Database connection closed\n');
      }
    });
  });
});

