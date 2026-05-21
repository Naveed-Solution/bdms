/**
 * Reset Donor Ineligibilities Script
 * 
 * This script resets all donor ineligibility data by:
 * - Setting last_donated to NULL for all donors
 * - Removing all ineligibility records
 * - Making all approved donors immediately eligible to donate
 * 
 * Usage: node reset-ineligibilities.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Starting donor ineligibility reset...\n');

db.serialize(() => {
  // Reset last_donated in donor_profiles
  db.run(`UPDATE donor_profiles SET last_donated = NULL`, function(err) {
    if (err) {
      console.error('❌ Error resetting last_donated:', err);
    } else {
      console.log(`✅ Reset last_donated for ${this.changes} donor profiles`);
    }
  });

  // Delete all ineligibility records
  db.run(`DELETE FROM donor_ineligibility`, function(err) {
    if (err) {
      console.error('❌ Error deleting ineligibility records:', err);
    } else {
      console.log(`✅ Deleted ${this.changes} ineligibility records`);
    }
  });

  // Verify results
  db.get(`SELECT COUNT(*) as count FROM donor_profiles WHERE last_donated IS NOT NULL`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying reset:', err);
    } else {
      console.log(`\n📊 Verification: ${row.count} donors still have last_donated set`);
    }
  });

  db.get(`SELECT COUNT(*) as count FROM donor_ineligibility`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying ineligibility:', err);
    } else {
      console.log(`📊 Verification: ${row.count} ineligibility records remaining`);
    }
    
    console.log('\n✅ Donor ineligibility reset complete!');
    console.log('All approved donors are now eligible to donate immediately.\n');
    
    db.close();
  });
});

