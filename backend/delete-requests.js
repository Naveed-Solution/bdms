/**
 * Delete All Blood Requests Script
 * 
 * This script deletes all blood request data by removing:
 * - All blood requests
 * - All accepted donors
 * - All request cancellations
 * - All donation ratings
 * - All request-related notifications
 * 
 * Usage: node delete-requests.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Starting blood request deletion...\n');

db.serialize(() => {
  // Delete donation ratings
  db.run(`DELETE FROM donation_ratings`, function(err) {
    if (err) {
      console.error('❌ Error deleting ratings:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} donation ratings`);
    }
  });

  // Delete accepted donors
  db.run(`DELETE FROM accepted_donors`, function(err) {
    if (err) {
      console.error('❌ Error deleting accepted donors:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} accepted donor records`);
    }
  });

  // Delete request cancellations
  db.run(`DELETE FROM request_cancellations`, function(err) {
    if (err) {
      console.error('❌ Error deleting cancellations:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} cancellation records`);
    }
  });

  // Delete blood requests
  db.run(`DELETE FROM blood_requests`, function(err) {
    if (err) {
      console.error('❌ Error deleting blood requests:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} blood requests`);
    }
  });

  // Delete request-related notifications
  db.run(`
    DELETE FROM notifications 
    WHERE type IN ('BLOOD_REQUEST_CREATED', 'REQUEST_ACCEPTED', 'REQUEST_COMPLETED')
  `, function(err) {
    if (err) {
      console.error('❌ Error deleting notifications:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} request-related notifications`);
    }
  });

  // Verify results
  db.get(`SELECT COUNT(*) as count FROM blood_requests`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying deletion:', err);
    } else {
      console.log(`\n📊 Verification: ${row.count} blood requests remaining`);
    }
    
    console.log('\n✅ Blood request deletion complete!');
    console.log('All blood request data has been removed from the database.\n');
    
    db.close();
  });
});

