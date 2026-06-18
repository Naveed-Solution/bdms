const express = require('express');
async function sendEmail(to, subject, htmlContent) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: 'Blood Donation System', email: 'naveedulhaq75@gmail.com' },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(JSON.stringify(error));
  }
}
const cors = require('cors');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'bdms.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // db.serialize() forces all db.run/db.get/db.all calls inside this callback
  // to execute strictly in order, one completing before the next starts.
  // Without this, sqlite3's default parallel mode can run the later
  // "ALTER TABLE accepted_donors/blood_requests ADD COLUMN ..." migration
  // statements BEFORE the CREATE TABLE IF NOT EXISTS calls for those same
  // tables have finished — which is exactly what causes
  // "SQLITE_ERROR: no such table" on a fresh/empty database.
  db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      account_status TEXT DEFAULT 'active',
      deactivation_reason TEXT,
      deactivated_at INTEGER,
      deactivated_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (deactivated_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('✅ Users table created/verified');
      
      // Add account status columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN deactivation_reason TEXT`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN deactivated_at INTEGER`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN deactivated_by TEXT`, () => {});
      
      // Add default admin account
      db.run(`
        INSERT OR IGNORE INTO users (id, name, email, password, role, account_status, created_at)
        VALUES ('admin-default', 'System Administrator', 'admin@bdms.com', 'admin123', 'admin', 'active', strftime('%s', 'now'))
      `, (err) => {
        if (err) {
          console.error('Error adding admin to users table:', err);
        } else {
          console.log('✅ Default admin account added to users table');
        }
      });
    }
  });

  // Create verification_codes table
  db.run(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creating verification_codes table:', err);
    } else {
      // Clean up expired verification codes after table is created
      db.run(`
        DELETE FROM verification_codes WHERE expires_at < ?
      `, [Date.now()], (err) => {
        if (err) console.error('Error cleaning up expired codes:', err);
      });
    }
  });

  // Create registered_emails table
  db.run(`
    CREATE TABLE IF NOT EXISTS registered_emails (
      email TEXT PRIMARY KEY,
      registered_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creating registered_emails table:', err);
    } else {
      // Add default admin account to registered emails
      db.run(`
        INSERT OR IGNORE INTO registered_emails (email, registered_at)
        VALUES ('admin@bdms.com', strftime('%s', 'now'))
      `, (err) => {
        if (err) {
          console.error('Error adding admin to registered_emails:', err);
        } else {
          console.log('✅ Default admin account added to registered_emails');
        }
      });
    }
  });

  // Create donor_profiles table
  db.run(`
    CREATE TABLE IF NOT EXISTS donor_profiles (
      user_id TEXT PRIMARY KEY,
      profile_image TEXT,
      mobile TEXT NOT NULL,
      mobile_verified INTEGER DEFAULT 0,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      zipcode TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      age INTEGER NOT NULL,
      weight REAL NOT NULL,
      last_donated TEXT,
      disease TEXT,
      approval_status TEXT DEFAULT 'PENDING',
      admin_remarks TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating donor_profiles table:', err);
    } else {
      console.log('✅ Donor profiles table created');
    }
  });

  // Create recipient_profiles table
  db.run(`
    CREATE TABLE IF NOT EXISTS recipient_profiles (
      user_id TEXT PRIMARY KEY,
      profile_image TEXT,
      mobile TEXT NOT NULL,
      mobile_verified INTEGER DEFAULT 0,
      cnic TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      zipcode TEXT NOT NULL,
      approval_status TEXT DEFAULT 'PENDING',
      admin_remarks TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating recipient_profiles table:', err);
    } else {
      console.log('✅ Recipient profiles table created');
    }
  });

  // Create mobile_verification_codes table
  db.run(`
    CREATE TABLE IF NOT EXISTS mobile_verification_codes (
      mobile TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creating mobile_verification_codes table:', err);
    } else {
      console.log('✅ Mobile verification codes table created');
    }
  });

  // Create blood_requests table (updated with units)
  db.run(`
    CREATE TABLE IF NOT EXISTS blood_requests (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 1,
      accepted_units INTEGER DEFAULT 0,
      urgency_level TEXT NOT NULL,
      location TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      recipient_mobile TEXT,
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating blood_requests table:', err);
    } else {
      console.log('✅ Blood requests table created');
      
      // Migration: Add missing columns if they don't exist
      db.run(`ALTER TABLE blood_requests ADD COLUMN units INTEGER NOT NULL DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
          console.error('Error adding units column:', err);
        } else if (!err) {
          console.log('✅ Added units column to blood_requests');
        }
      });
      
      db.run(`ALTER TABLE blood_requests ADD COLUMN accepted_units INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
          console.error('Error adding accepted_units column:', err);
        } else if (!err) {
          console.log('✅ Added accepted_units column to blood_requests');
        }
      });
      
      db.run(`ALTER TABLE blood_requests ADD COLUMN recipient_mobile TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
          console.error('Error adding recipient_mobile column:', err);
        } else if (!err) {
          console.log('✅ Added recipient_mobile column to blood_requests');
        }
      });
    }
  });

  // Create accepted_donors table (many-to-many relationship)
  db.run(`
    CREATE TABLE IF NOT EXISTS accepted_donors (
      request_id TEXT NOT NULL,
      donor_id TEXT NOT NULL,
      donor_name TEXT NOT NULL,
      accepted_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (request_id, donor_id),
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (donor_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating accepted_donors table:', err);
    } else {
      console.log('✅ Accepted donors table created');
    }
  });

  // Create declined_donors table
  db.run(`
    CREATE TABLE IF NOT EXISTS declined_donors (
      request_id TEXT NOT NULL,
      donor_id TEXT NOT NULL,
      declined_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (request_id, donor_id),
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (donor_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating declined_donors table:', err);
    } else {
      console.log('✅ Declined donors table created');
    }
  });

  // Create respect_ratings table for mutual ratings between donors and recipients
  db.run(`
    CREATE TABLE IF NOT EXISTS respect_ratings (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      donor_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      donor_rating INTEGER,
      donor_comment TEXT,
      donor_rated_at INTEGER,
      donor_skipped INTEGER DEFAULT 0,
      donor_skipped_at INTEGER,
      recipient_rating INTEGER,
      recipient_comment TEXT,
      recipient_rated_at INTEGER,
      recipient_skipped INTEGER DEFAULT 0,
      recipient_skipped_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (donor_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating respect_ratings table:', err);
    } else {
      console.log('✅ Respect ratings table created');
      // Add skip columns if they don't exist (for existing tables)
      db.run(`ALTER TABLE respect_ratings ADD COLUMN donor_skipped INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE respect_ratings ADD COLUMN donor_skipped_at INTEGER`, () => {});
      db.run(`ALTER TABLE respect_ratings ADD COLUMN recipient_skipped INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE respect_ratings ADD COLUMN recipient_skipped_at INTEGER`, () => {});
    }
  });

  // Create request_cancellations table for tracking cancellation reasons
  db.run(`
    CREATE TABLE IF NOT EXISTS request_cancellations (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      cancelled_by TEXT NOT NULL,
      cancelled_by_role TEXT NOT NULL,
      reason TEXT,
      cancelled_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (cancelled_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating request_cancellations table:', err);
    } else {
      console.log('✅ Request cancellations table created');
    }
  });

  // Create account_appeals table for user appeals against account deactivation
  db.run(`
    CREATE TABLE IF NOT EXISTS account_appeals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      appeal_message TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      admin_response TEXT,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating account_appeals table:', err);
    } else {
      console.log('✅ Account appeals table created');
    }
  });

  // Add completion tracking columns to accepted_donors
  db.run(`ALTER TABLE accepted_donors ADD COLUMN donor_completed INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding donor_completed column:', err);
    }
  });

  db.run(`ALTER TABLE accepted_donors ADD COLUMN donor_completed_at INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding donor_completed_at column:', err);
    }
  });

  db.run(`ALTER TABLE accepted_donors ADD COLUMN recipient_completed INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding recipient_completed column:', err);
    }
  });

  db.run(`ALTER TABLE accepted_donors ADD COLUMN recipient_completed_at INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding recipient_completed_at column:', err);
    }
  });

  db.run(`ALTER TABLE accepted_donors ADD COLUMN status TEXT DEFAULT 'ACCEPTED'`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding status column:', err);
    }
  });

  db.run(`ALTER TABLE accepted_donors ADD COLUMN donor_current_location TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding donor_current_location column:', err);
    }
  });

  // Add cancellation tracking to blood_requests
  db.run(`ALTER TABLE blood_requests ADD COLUMN cancelled_by TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding cancelled_by column:', err);
    }
  });

  db.run(`ALTER TABLE blood_requests ADD COLUMN cancellation_reason TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding cancellation_reason column:', err);
    }
  });

  // Add location sharing preference to blood_requests
  db.run(`ALTER TABLE blood_requests ADD COLUMN share_location INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding share_location column:', err);
    }
  });

  db.run(`ALTER TABLE blood_requests ADD COLUMN recipient_latitude REAL`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding recipient_latitude column:', err);
    }
  });

  db.run(`ALTER TABLE blood_requests ADD COLUMN recipient_longitude REAL`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding recipient_longitude column:', err);
    }
  });

  db.run(`ALTER TABLE blood_requests ADD COLUMN recipient_location_updated_at INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column') && !err.message.includes('already has a column')) {
      console.error('Error adding recipient_location_updated_at column:', err);
    }
  });

  // Create live_locations table for real-time tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS live_locations (
      user_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating live_locations table:', err);
    } else {
      console.log('✅ Live locations table created');
    }
  });

  /**
   * Audit Logs Table
   * 
   * This table stores all system actions for accountability and traceability.
   * Audit logs help administrators monitor system usage, detect anomalies,
   * and maintain compliance with data governance requirements.
   * 
   * Fields:
   * - id: Unique identifier for the log entry
   * - timestamp: When the action occurred
   * - actor_role: Role of the user performing the action (admin, donor, user)
   * - actor_id: User ID who performed the action
   * - actor_name: Name of the user (denormalized for quick display)
   * - action: Type of action performed (e.g., LOGIN, CREATE_REQUEST, ACCEPT_REQUEST)
   * - entity_type: Type of entity affected (e.g., USER, REQUEST, PROFILE)
   * - entity_id: ID of the affected entity (optional)
   * - details: Additional context about the action (JSON string)
   * - ip_address: IP address of the actor (for security tracking)
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      actor_role TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      FOREIGN KEY (actor_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating audit_logs table:', err);
    } else {
      console.log('✅ Audit logs table created');
    }
  });

  // Create indexes for faster audit log queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`, () => {});

  /**
   * Notifications Table
   * 
   * This table stores system notifications for users, especially admins.
   * Notifications provide real-time updates about important system events.
   * 
   * Types of notifications:
   * - PROFILE_APPROVAL_REQUEST: New profile submitted for approval
   * - PROFILE_APPROVED: Profile approved by admin
   * - PROFILE_REJECTED: Profile rejected by admin
   * - ACCOUNT_DEACTIVATED: Account deactivated by admin
   * - ACCOUNT_ACTIVATED: Account activated by admin
   * - APPEAL_SUBMITTED: User submitted an appeal
   * - APPEAL_ACCEPTED: Appeal accepted
   * - APPEAL_REJECTED: Appeal rejected
   * - BLOOD_REQUEST_CREATED: New blood request created
   * - REQUEST_ACCEPTED: Blood request accepted by donor
   * - REQUEST_COMPLETED: Blood request completed
   * - REQUEST_CANCELLED: Blood request cancelled
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating notifications table:', err);
    } else {
      console.log('✅ Notifications table created');
    }
  });

  // Create indexes for faster notification queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC)`, () => {});
  }); // end db.serialize
}

// Email configuration using Resend

// Generate 6-digit verification code
function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Audit Log Helper Function
 * 
 * This helper function simplifies creating audit log entries from anywhere
 * in the backend. It ensures consistent log formatting and automatic
 * timestamp generation.
 * 
 * @param {Object} logData - The audit log data
 * @param {string} logData.actorRole - Role of the user (admin, donor, user)
 * @param {string} logData.actorId - User ID
 * @param {string} logData.actorName - User name
 * @param {string} logData.action - Action performed
 * @param {string} logData.entityType - Type of entity affected (optional)
 * @param {string} logData.entityId - ID of affected entity (optional)
 * @param {object} logData.details - Additional details (optional)
 * @param {string} logData.ipAddress - IP address (optional)
 */
function createAuditLog(logData) {
  const { actorRole, actorId, actorName, action, entityType, entityId, details, ipAddress } = logData;
  
  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const detailsJson = details ? JSON.stringify(details) : null;

  db.run(`
    INSERT INTO audit_logs (
      id, timestamp, actor_role, actor_id, actor_name, 
      action, entity_type, entity_id, details, ip_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    logId, timestamp, actorRole, actorId, actorName,
    action, entityType, entityId, detailsJson, ipAddress
  ], (err) => {
    if (err) {
      console.error('❌ Error creating audit log:', err);
    } else {
      console.log(`📝 Audit: ${action} by ${actorRole} ${actorName}`);
    }
  });
}

// Send verification code endpoint
app.post('/api/send-verification-code', async (req, res) => {
  const { email, purpose } = req.body; // purpose: 'registration' or 'password-reset'

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    // Store code in database with expiration (5 minutes)
    db.run(`
      INSERT OR REPLACE INTO verification_codes (email, code, expires_at, purpose)
      VALUES (?, ?, ?, ?)
    `, [email.toLowerCase(), code, expiresAt, purpose], (err) => {
      if (err) {
        console.error('Error storing verification code:', err);
      }
    });

    // Email content
    const subject = purpose === 'registration' 
      ? 'Blood Donation Management System - Email Verification'
      : 'Blood Donation Management System - Password Reset';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #DC143C; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .code { font-size: 32px; font-weight: bold; color: #DC143C; text-align: center; letter-spacing: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Blood Donation Management System</h1>
          </div>
          <div class="content">
            <h2>Verification Code</h2>
            <p>Your verification code is:</p>
            <div class="code">${code}</div>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Blood Donation Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
  await sendEmail(email, subject, htmlContent);
    console.log(`✅ Verification code sent to ${email}: ${code}`);
    res.json({ success: true, message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Check email availability endpoint
app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if email is already registered in users table (primary source)
  db.get(`
    SELECT email FROM users WHERE email = ?
  `, [email.toLowerCase()], (err, row) => {
    if (err) {
      console.error('Error checking email:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const isAvailable = !row;
    res.json({ 
      available: isAvailable,
      message: isAvailable ? 'Email is available' : 'Email is already registered'
    });
  });
});

// Verify code endpoint
app.post('/api/verify-code', async (req, res) => {
  const { email, code, purpose } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  // Check if this is for email_update or password_change (stored in memory)
  if (purpose === 'email_update' || purpose === 'password_change') {
    if (!global.verificationCodes || !global.verificationCodes[email]) {
      return res.status(400).json({ error: 'No verification code found for this email' });
    }

    const storedData = global.verificationCodes[email];

    if (Date.now() > storedData.expiresAt) {
      delete global.verificationCodes[email];
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid
    delete global.verificationCodes[email];
    console.log(`✅ Verification code validated for ${email} (purpose: ${purpose})`);
    return res.json({ success: true, message: 'Verification code is valid' });
  }

  // For registration verification (stored in database)
  db.get(`
    SELECT code, expires_at FROM verification_codes WHERE email = ?
  `, [email.toLowerCase()], (err, row) => {
    if (err) {
      console.error('Error fetching verification code:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(400).json({ error: 'No verification code found for this email' });
    }

    if (Date.now() > row.expires_at) {
      // Delete expired code
      db.run(`DELETE FROM verification_codes WHERE email = ?`, [email.toLowerCase()]);
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (row.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid - mark email as registered
    db.run(`
      INSERT OR REPLACE INTO registered_emails (email) VALUES (?)
    `, [email.toLowerCase()], (err) => {
      if (err) {
        console.error('Error registering email:', err);
        return res.status(500).json({ error: 'Failed to register email' });
      }

      // Delete used verification code
      db.run(`DELETE FROM verification_codes WHERE email = ?`, [email.toLowerCase()]);
      
      console.log(`✅ Email verified and registered: ${email}`);
      res.json({ success: true, message: 'Email verified successfully' });
    });
  });
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * POST /api/register
 * Register a new user
 */
app.post('/api/register', (req, res) => {
  const { id, name, email, password, role } = req.body;

  if (!id || !name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Insert user into database
  db.run(`
    INSERT INTO users (id, name, email, password, role)
    VALUES (?, ?, ?, ?, ?)
  `, [id, name, email.toLowerCase(), password, role], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      console.error('Error registering user:', err);
      return res.status(500).json({ error: 'Failed to register user' });
    }

    // Also add to registered_emails
    db.run(`
      INSERT OR IGNORE INTO registered_emails (email) VALUES (?)
    `, [email.toLowerCase()]);

    console.log(`✅ User registered: ${email} (${role})`);
    res.json({ 
      success: true, 
      user: { id, name, email: email.toLowerCase(), role }
    });
  });
});

/**
 * POST /api/get-user-role
 * Get user's role by email (for intelligent login)
 */
app.post('/api/get-user-role', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Find user in database by email only
  db.get(`
    SELECT role FROM users WHERE email = ?
  `, [email.toLowerCase()], (err, user) => {
    if (err) {
      console.error('Error getting user role:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ role: user.role });
  });
});

/**
 * POST /api/login
 * Authenticate user
 */
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role are required' });
  }

  // Find user in database
  db.get(`
    SELECT * FROM users WHERE email = ? AND role = ?
  `, [email.toLowerCase(), role], (err, user) => {
    if (err) {
      console.error('Error during login:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or role' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create audit log for successful login
    createAuditLog({
      actorRole: user.role,
      actorId: user.id,
      actorName: user.name,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: { email: user.email },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    console.log(`✅ User logged in: ${email} (${role})`);
    res.json({ 
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

/**
 * POST /api/reset-password
 * Reset user password
 */
app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  db.run(`
    UPDATE users SET password = ? WHERE email = ?
  `, [newPassword, email.toLowerCase()], function(err) {
    if (err) {
      console.error('Error resetting password:', err);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Password reset for: ${email}`);
    res.json({ success: true, message: 'Password reset successfully' });
  });
});

// ============================================
// MOBILE VERIFICATION ENDPOINTS
// ============================================

/**
 * POST /api/send-mobile-verification
 * Send verification code to mobile number
 */
app.post('/api/send-mobile-verification', async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || !mobile.match(/^92\d{10}$/)) {
    return res.status(400).json({ error: 'Valid mobile number required (92xxxxxxxxxx)' });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  db.run(`
    INSERT OR REPLACE INTO mobile_verification_codes (mobile, code, expires_at)
    VALUES (?, ?, ?)
  `, [mobile, code, expiresAt], function(err) {
    if (err) {
      console.error('Error storing mobile verification code:', err);
      return res.status(500).json({ error: 'Failed to send verification code' });
    }

    // TODO: Integrate with SMS service (Twilio, etc.)
    // For now, log to console for development
    console.log(`📱 Mobile verification code for ${mobile}: ${code}`);
    
    res.json({ 
      success: true, 
      message: 'Verification code sent',
      // Remove in production:
      devCode: code
    });
  });
});

/**
 * POST /api/verify-mobile-code
 * Verify mobile number with code
 */
app.post('/api/verify-mobile-code', (req, res) => {
  const { mobile, code } = req.body;

  if (!mobile || !code) {
    return res.status(400).json({ error: 'Mobile and code are required' });
  }

  db.get(`
    SELECT * FROM mobile_verification_codes WHERE mobile = ?
  `, [mobile], (err, row) => {
    if (err) {
      console.error('Error verifying mobile code:', err);
      return res.status(500).json({ error: 'Verification failed' });
    }

    if (!row) {
      return res.status(400).json({ error: 'No verification code found' });
    }

    if (row.expires_at < Date.now()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (row.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Delete used code
    db.run(`DELETE FROM mobile_verification_codes WHERE mobile = ?`, [mobile]);

    console.log(`✅ Mobile verified: ${mobile}`);
    res.json({ success: true, message: 'Mobile verified successfully' });
  });
});

// ============================================
// DONOR PROFILE ENDPOINTS
// ============================================

/**
 * POST /api/donor-profile
 * Create or update donor profile
 */
app.post('/api/donor-profile', (req, res) => {
  const { 
    userId, profileImage, mobile, mobileVerified, address, city, zipcode,
    bloodGroup, age, weight, lastDonated, disease 
  } = req.body;

  const isBase64 = profileImage?.startsWith('data:');
  console.log(`📝 Saving donor profile for ${userId}: profileImage length=${profileImage?.length || 0}, type=${isBase64 ? 'BASE64' : 'FILE_URI'}`);

  if (!userId || !mobile || !address || !city || !zipcode || !bloodGroup || !age || !weight) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  if (!mobile.match(/^92\d{10}$/)) {
    return res.status(400).json({ error: 'Invalid mobile format (92xxxxxxxxxx)' });
  }

  // Mobile verification removed as per user request - auto-accept
  const now = Math.floor(Date.now() / 1000);

  // Check existing approval status - preserve if APPROVED
  db.get(`SELECT approval_status FROM donor_profiles WHERE user_id = ?`, [userId], (getErr, existing) => {
    if (getErr) {
      console.error('Error checking existing profile:', getErr);
      return res.status(500).json({ error: 'Database error' });
    }

    const approvalStatus = (existing && existing.approval_status === 'APPROVED') ? 'APPROVED' : 'PENDING';

    db.run(`
      INSERT OR REPLACE INTO donor_profiles (
        user_id, profile_image, mobile, mobile_verified, address, city, zipcode,
        blood_group, age, weight, last_donated, disease, approval_status, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, profileImage, mobile, address, city, zipcode, bloodGroup, age, weight, lastDonated, disease, approvalStatus, now], function(err) {
    if (err) {
      console.error('Error saving donor profile:', err);
      return res.status(500).json({ error: 'Failed to save profile' });
    }

      console.log(`✅ Donor profile saved for user: ${userId} (Status: ${approvalStatus})`);
      
      // Notify all admins if this is a new pending profile
      if (approvalStatus === 'PENDING') {
        db.all(`SELECT id FROM users WHERE role = 'admin'`, [], (err, admins) => {
          if (!err && admins) {
            db.get(`SELECT name FROM users WHERE id = ?`, [userId], (err, user) => {
              if (!err && user) {
                admins.forEach(admin => {
                  createNotification(
                    admin.id,
                    'PROFILE_APPROVAL_REQUEST',
                    'New Donor Profile for Approval',
                    `${user.name} has submitted a donor profile for approval.`,
                    { userId, userType: 'donor', userName: user.name }
                  );
                });
              }
            });
          }
        });
      }
      
      res.json({ 
        success: true, 
        message: approvalStatus === 'APPROVED' 
          ? 'Profile updated successfully (Already Approved)' 
          : 'Profile submitted for admin approval',
        profile: { userId, approvalStatus }
      });
    });
  });
});

/**
 * GET /api/donor-profile/:userId
 * Get donor profile
 */
app.get('/api/donor-profile/:userId', (req, res) => {
  const { userId } = req.params;

  // Join with users table to get name
  db.get(`
    SELECT 
      dp.*,
      u.name as name
    FROM donor_profiles dp
    LEFT JOIN users u ON dp.user_id = u.id
    WHERE dp.user_id = ?
  `, [userId], (err, profile) => {
    if (err) {
      console.error('Error fetching donor profile:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ [Donor Profile] Returning profile for user:', userId, 'Name:', profile.name);

    res.json({ 
      success: true, 
      profile: {
        ...profile,
        name: profile.name,
        photo: profile.profile_image, // Use profile_image from donor_profiles
        mobile: profile.mobile,
        approvalStatus: profile.approval_status, // camelCase alias for frontend
        adminRemarks: profile.admin_remarks,      // camelCase alias for frontend
        createdAt: profile.created_at * 1000,
        updatedAt: profile.updated_at * 1000
      }
    });
  });
});

// ============================================
// RECIPIENT PROFILE ENDPOINTS
// ============================================

/**
 * POST /api/recipient-profile
 * Create or update recipient profile
 */
app.post('/api/recipient-profile', (req, res) => {
  const { 
    userId, profileImage, mobile, mobileVerified, cnic, address, city, zipcode
  } = req.body;

  const isBase64 = profileImage?.startsWith('data:');
  console.log(`📝 Saving recipient profile for ${userId}: profileImage length=${profileImage?.length || 0}, type=${isBase64 ? 'BASE64' : 'FILE_URI'}`);

  if (!userId || !mobile || !address || !city || !zipcode) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  if (!mobile.match(/^92\d{10}$/)) {
    return res.status(400).json({ error: 'Invalid mobile format (92xxxxxxxxxx)' });
  }

  // Mobile verification removed as per user request - auto-accept
  const now = Math.floor(Date.now() / 1000);

  // Check existing approval status - preserve if APPROVED
  db.get(`SELECT approval_status FROM recipient_profiles WHERE user_id = ?`, [userId], (getErr, existing) => {
    if (getErr) {
      console.error('Error checking existing profile:', getErr);
      return res.status(500).json({ error: 'Database error' });
    }

    const approvalStatus = (existing && existing.approval_status === 'APPROVED') ? 'APPROVED' : 'PENDING';

    db.run(`
      INSERT OR REPLACE INTO recipient_profiles (
        user_id, profile_image, mobile, mobile_verified, cnic, address, city, zipcode,
        approval_status, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `, [userId, profileImage, mobile, cnic, address, city, zipcode, approvalStatus, now], function(err) {
    if (err) {
      console.error('Error saving recipient profile:', err);
      return res.status(500).json({ error: 'Failed to save profile' });
    }

      console.log(`✅ Recipient profile saved for user: ${userId} (Status: ${approvalStatus})`);
      
      // Notify all admins if this is a new pending profile
      if (approvalStatus === 'PENDING') {
        db.all(`SELECT id FROM users WHERE role = 'admin'`, [], (err, admins) => {
          if (!err && admins) {
            db.get(`SELECT name FROM users WHERE id = ?`, [userId], (err, user) => {
              if (!err && user) {
                admins.forEach(admin => {
                  createNotification(
                    admin.id,
                    'PROFILE_APPROVAL_REQUEST',
                    'New Recipient Profile for Approval',
                    `${user.name} has submitted a recipient profile for approval.`,
                    { userId, userType: 'recipient', userName: user.name }
                  );
                });
              }
            });
          }
        });
      }
      
      res.json({ 
        success: true, 
        message: approvalStatus === 'APPROVED' 
          ? 'Profile updated successfully (Already Approved)' 
          : 'Profile submitted for admin approval',
        profile: { userId, approvalStatus }
      });
    });
  });
});

/**
 * GET /api/recipient-profile/:userId
 * Get recipient profile
 */
app.get('/api/recipient-profile/:userId', (req, res) => {
  const { userId } = req.params;

  // Join with users table to get name
  db.get(`
    SELECT 
      rp.*,
      u.name as name
    FROM recipient_profiles rp
    LEFT JOIN users u ON rp.user_id = u.id
    WHERE rp.user_id = ?
  `, [userId], (err, profile) => {
    if (err) {
      console.error('Error fetching recipient profile:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ [Recipient Profile] Returning profile for user:', userId, 'Name:', profile.name);

    res.json({ 
      success: true, 
      profile: {
        ...profile,
        name: profile.name,
        photo: profile.profile_image, // Use profile_image from recipient_profiles
        mobile: profile.mobile,
        approvalStatus: profile.approval_status, // camelCase alias for frontend
        adminRemarks: profile.admin_remarks,      // camelCase alias for frontend
        createdAt: profile.created_at * 1000,
        updatedAt: profile.updated_at * 1000
      }
    });
  });
});

// ============================================
// ADMIN APPROVAL ENDPOINTS
// ============================================

/**
 * GET /api/admin/pending-profiles
 * Get all pending profiles for approval
 */
app.get('/api/admin/pending-profiles', (req, res) => {
  const donorQuery = db.all(`
    SELECT dp.*, u.name, u.email, 'donor' as type
    FROM donor_profiles dp
    JOIN users u ON dp.user_id = u.id
    WHERE dp.approval_status = 'PENDING'
  `);

  const recipientQuery = db.all(`
    SELECT rp.*, u.name, u.email, 'recipient' as type
    FROM recipient_profiles rp
    JOIN users u ON rp.user_id = u.id
    WHERE rp.approval_status = 'PENDING'
  `);

  Promise.all([
    new Promise((resolve, reject) => {
      db.all(`
        SELECT dp.*, u.name, u.email, 'donor' as type
        FROM donor_profiles dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.approval_status = 'PENDING'
      `, [], (err, rows) => err ? reject(err) : resolve(rows));
    }),
    new Promise((resolve, reject) => {
      db.all(`
        SELECT rp.*, u.name, u.email, 'recipient' as type
        FROM recipient_profiles rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.approval_status = 'PENDING'
      `, [], (err, rows) => err ? reject(err) : resolve(rows));
    })
  ]).then(([donors, recipients]) => {
    res.json({
      success: true,
      profiles: [...donors, ...recipients]
    });
  }).catch(err => {
    console.error('Error fetching pending profiles:', err);
    res.status(500).json({ error: 'Database error' });
  });
});

/**
 * POST /api/admin/approve-profile
 * Approve a profile
 */
app.post('/api/admin/approve-profile', (req, res) => {
  const { userId, userType } = req.body;

  if (!userId || !userType) {
    return res.status(400).json({ error: 'User ID and type are required' });
  }

  const table = userType === 'donor' ? 'donor_profiles' : 'recipient_profiles';
  const now = Math.floor(Date.now() / 1000);

  db.run(`
    UPDATE ${table} SET approval_status = 'APPROVED', admin_remarks = NULL, updated_at = ?
    WHERE user_id = ?
  `, [now, userId], function(err) {
    if (err) {
      console.error('Error approving profile:', err);
      return res.status(500).json({ error: 'Failed to approve profile' });
    }

    console.log(`✅ Profile approved for ${userType}: ${userId}`);
    
    // Create notification for user
    createNotification(
      userId,
      'PROFILE_APPROVED',
      'Profile Approved',
      `Your ${userType} profile has been approved by the admin. You can now use all system features.`,
      { userType }
    );
    
    res.json({ success: true, message: 'Profile approved' });
  });
});

/**
 * POST /api/admin/reject-profile
 * Reject a profile with remarks
 */
app.post('/api/admin/reject-profile', (req, res) => {
  const { userId, userType, remarks } = req.body;

  if (!userId || !userType || !remarks) {
    return res.status(400).json({ error: 'User ID, type, and remarks are required' });
  }

  const table = userType === 'donor' ? 'donor_profiles' : 'recipient_profiles';
  const now = Math.floor(Date.now() / 1000);

  db.run(`
    UPDATE ${table} SET approval_status = 'REJECTED', admin_remarks = ?, updated_at = ?
    WHERE user_id = ?
  `, [remarks, now, userId], function(err) {
    if (err) {
      console.error('Error rejecting profile:', err);
      return res.status(500).json({ error: 'Failed to reject profile' });
    }

    console.log(`✅ Profile rejected for ${userType}: ${userId}`);
    
    // Create notification for user
    createNotification(
      userId,
      'PROFILE_REJECTED',
      'Profile Rejected',
      `Your ${userType} profile has been rejected. Reason: ${remarks}`,
      { userType, remarks }
    );
    
    res.json({ success: true, message: 'Profile rejected' });
  });
});

/**
 * GET /api/users
 * Get all users (for debugging)
 */
app.get('/api/users', (req, res) => {
  db.all(`SELECT id, name, email, role, created_at FROM users`, [], (err, users) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ users });
  });
});

/**
 * GET /api/donors-by-blood-type
 * Get count of approved donors grouped by blood type
 */
app.get('/api/donors-by-blood-type', (req, res) => {
  db.all(`
    SELECT 
      dp.blood_group,
      COUNT(*) as count
    FROM donor_profiles dp
    INNER JOIN users u ON dp.user_id = u.id
    WHERE dp.approval_status = 'APPROVED'
      AND u.account_status = 'active'
      AND u.role = 'donor'
    GROUP BY dp.blood_group
  `, [], (err, results) => {
    if (err) {
      console.error('❌ Error fetching donors by blood type:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Initialize all blood types with 0 count
    const bloodTypeCounts = {
      'A+': 0,
      'A-': 0,
      'B+': 0,
      'B-': 0,
      'O+': 0,
      'O-': 0,
      'AB+': 0,
      'AB-': 0,
    };

    // Fill in actual counts
    results.forEach(row => {
      if (bloodTypeCounts.hasOwnProperty(row.blood_group)) {
        bloodTypeCounts[row.blood_group] = row.count;
      }
    });

    console.log('✅ Fetched donor counts by blood type:', bloodTypeCounts);
    res.json({ bloodTypes: bloodTypeCounts });
  });
});

// ============================================
// BLOOD REQUEST ENDPOINTS
// ============================================

/**
 * POST /api/blood-requests
 * Create a new blood request (requires approved profile)
 */
app.post('/api/blood-requests', (req, res) => {
  const { id, recipientId, recipientName, bloodGroup, units, urgencyLevel, location, notes, shareLocation, recipientLatitude, recipientLongitude } = req.body;

  if (!id || !recipientId || !recipientName || !bloodGroup || !units || !urgencyLevel || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if user account is active
  db.get(`SELECT account_status, deactivation_reason FROM users WHERE id = ?`, [recipientId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.account_status === 'deactivated') {
      return res.status(403).json({ 
        error: 'Your account has been deactivated',
        reason: user.deactivation_reason,
        canAppeal: true
      });
    }

    // Check if recipient already has an active request
    db.get(`
      SELECT id, status FROM blood_requests 
      WHERE recipient_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED')
      ORDER BY created_at DESC
      LIMIT 1
    `, [recipientId], (err, activeRequest) => {
      if (err) {
        console.error('Error checking active requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (activeRequest) {
        return res.status(400).json({ 
          error: 'You already have an active blood request',
          message: 'Please wait for your current request to be completed or cancelled before creating a new one.',
          activeRequestId: activeRequest.id,
          activeRequestStatus: activeRequest.status
        });
      }

      // Check if recipient profile is approved
      db.get(`
        SELECT approval_status FROM recipient_profiles WHERE user_id = ?
      `, [recipientId], (err, profile) => {
        if (err) {
          console.error('Error checking recipient profile:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!profile) {
          return res.status(403).json({ error: 'Please complete your profile first' });
        }

        if (profile.approval_status !== 'APPROVED') {
          return res.status(403).json({ 
            error: profile.approval_status === 'REJECTED' 
              ? 'Your profile was rejected. Please update it according to admin remarks.'
              : 'Your profile is pending admin approval. Please wait.'
          });
        }

        const now = Math.floor(Date.now() / 1000);

    // Step 1: Insert with only the guaranteed core columns
    db.run(`
      INSERT INTO blood_requests (
        id, recipient_id, recipient_name, blood_group, units, accepted_units,
        urgency_level, location, notes, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'PENDING', ?, ?)
    `, [id, recipientId, recipientName, bloodGroup, units, urgencyLevel, location, notes || null, now, now], function(err) {
      if (err) {
        console.error('Error creating blood request (core insert):', err);
        return res.status(500).json({ error: 'Failed to create request', detail: err.message });
      }

      // Step 2: Update optional location columns (silently ignore if columns don't exist yet)
      db.run(`UPDATE blood_requests SET share_location = ?, recipient_latitude = ?, recipient_longitude = ?, recipient_location_updated_at = ? WHERE id = ?`,
        [shareLocation ? 1 : 0, recipientLatitude || null, recipientLongitude || null, shareLocation ? now : null, id],
        (locErr) => { if (locErr) console.warn('Location columns not yet migrated (safe to ignore):', locErr.message); }
      );

      // Create audit log for request creation
      createAuditLog({
        actorRole: 'user',
        actorId: recipientId,
        actorName: recipientName,
        action: 'CREATE_BLOOD_REQUEST',
        entityType: 'BLOOD_REQUEST',
        entityId: id,
        details: {
          bloodGroup,
          units,
          urgencyLevel,
          location
        },
        ipAddress: req.ip || req.connection.remoteAddress
      });

      // Send notifications to all approved donors
      db.all(`
        SELECT DISTINCT u.id, u.name
        FROM users u
        JOIN donor_profiles dp ON u.id = dp.user_id
        WHERE u.role = 'donor' 
          AND u.account_status = 'active'
          AND dp.approval_status = 'APPROVED'
      `, [], (err, donors) => {
        if (err) {
          console.error('Error fetching donors for notifications:', err);
        } else if (donors && donors.length > 0) {
          console.log(`📢 Sending blood request notification to ${donors.length} donors`);
          
          donors.forEach(donor => {
            createNotification(
              donor.id,
              'BLOOD_REQUEST_CREATED',
              '🩸 New Blood Request',
              `${bloodGroup} blood needed - ${urgencyLevel} urgency at ${location}`,
              { 
                requestId: id,
                bloodGroup,
                urgency: urgencyLevel,
                location,
                units
              }
            );
          });
          
          console.log(`✅ Sent ${donors.length} blood request notifications`);
        }
      });

      console.log(`✅ Blood request created: ${id} (${bloodGroup}, ${units} units, ${urgencyLevel})`);
      res.json({ 
        success: true, 
        requestId: id,
        request: {
          id,
          recipientId,
          recipientName,
          bloodGroup,
          units,
          acceptedUnits: 0,
          urgencyLevel,
          location,
          notes,
          status: 'PENDING',
          createdAt: now * 1000,
          updatedAt: now * 1000
        }
      });
    });
      }); // Close recipient profile check
    }); // Close active request check
  }); // Close account status check
});

/**
 * GET /api/blood-requests
 * Get all blood requests
 */
app.get('/api/blood-requests', (req, res) => {
  db.all(`
    SELECT * FROM blood_requests ORDER BY created_at DESC
  `, [], (err, requests) => {
    if (err) {
      console.error('Error fetching blood requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // For each request, get accepted and declined donors
    const requestsWithDonors = [];
    let processed = 0;

    if (requests.length === 0) {
      return res.json({ requests: [] });
    }

    requests.forEach(request => {
      // Get accepted donors
      db.all(`
        SELECT donor_id, donor_name, accepted_at FROM accepted_donors WHERE request_id = ?
      `, [request.id], (err, acceptedDonors) => {
        if (err) {
          console.error('Error fetching accepted donors:', err);
        }

        // Get declined donors
        db.all(`
          SELECT donor_id FROM declined_donors WHERE request_id = ?
        `, [request.id], (err, declinedDonors) => {
          if (err) {
            console.error('Error fetching declined donors:', err);
          }

          requestsWithDonors.push({
            ...request,
            createdAt: request.created_at * 1000,
            updatedAt: request.updated_at * 1000,
            acceptedBy: acceptedDonors ? acceptedDonors.map(d => ({
              donorId: d.donor_id,
              donorName: d.donor_name,
              acceptedAt: d.accepted_at * 1000
            })) : [],
            declinedBy: declinedDonors ? declinedDonors.map(d => d.donor_id) : []
          });

          processed++;
          if (processed === requests.length) {
            res.json({ requests: requestsWithDonors });
          }
        });
      });
    });
  });
});

/**
 * GET /api/blood-requests/:id
 * Get a specific blood request (with recipient mobile for accepted donors)
 */
app.get('/api/blood-requests/:id', (req, res) => {
  const { id } = req.params;
  const { donorId } = req.query;

  db.get(`SELECT * FROM blood_requests WHERE id = ?`, [id], (err, request) => {
    if (err) {
      console.error('Error fetching blood request:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get cancellation data
    db.get(`
      SELECT cancelled_by, cancelled_by_role, reason, cancelled_at
      FROM request_cancellations
      WHERE request_id = ?
    `, [id], (err, cancellation) => {
      // Get accepted donors
      db.all(`
        SELECT donor_id, donor_name, accepted_at FROM accepted_donors WHERE request_id = ?
      `, [id], (err, acceptedDonors) => {
        // Get declined donors
        db.all(`
          SELECT donor_id FROM declined_donors WHERE request_id = ?
        `, [id], (err, declinedDonors) => {
          // Check if current donor has accepted this request
          const donorHasAccepted = donorId && acceptedDonors && 
            acceptedDonors.some(d => d.donor_id === donorId);

          // Get recipient mobile if donor has accepted
          if (donorHasAccepted) {
            db.get(`
              SELECT mobile FROM recipient_profiles WHERE user_id = ?
            `, [request.recipient_id], (err, recipientProfile) => {
              res.json({
                request: {
                  ...request,
                  createdAt: request.created_at * 1000,
                  updatedAt: request.updated_at * 1000,
                  recipientMobile: recipientProfile ? recipientProfile.mobile : null,
                  acceptedBy: acceptedDonors ? acceptedDonors.map(d => ({
                    donorId: d.donor_id,
                    donorName: d.donor_name,
                    acceptedAt: d.accepted_at * 1000
                  })) : [],
                  declinedBy: declinedDonors ? declinedDonors.map(d => d.donor_id) : [],
                  // Cancellation data
                  cancelledBy: cancellation ? cancellation.cancelled_by : null,
                  cancelledByRole: cancellation ? cancellation.cancelled_by_role : null,
                  cancellationReason: cancellation ? cancellation.reason : null,
                  cancelledAt: cancellation ? cancellation.cancelled_at * 1000 : null,
                }
              });
            });
          } else {
            res.json({
              request: {
                ...request,
                createdAt: request.created_at * 1000,
                updatedAt: request.updated_at * 1000,
                acceptedBy: acceptedDonors ? acceptedDonors.map(d => ({
                  donorId: d.donor_id,
                  donorName: d.donor_name,
                  acceptedAt: d.accepted_at * 1000
                })) : [],
                declinedBy: declinedDonors ? declinedDonors.map(d => d.donor_id) : [],
                // Cancellation data
                cancelledBy: cancellation ? cancellation.cancelled_by : null,
                cancelledByRole: cancellation ? cancellation.cancelled_by_role : null,
                cancellationReason: cancellation ? cancellation.reason : null,
                cancelledAt: cancellation ? cancellation.cancelled_at * 1000 : null,
              }
            });
          }
        });
      });
    });
  });
});

/**
 * PATCH /api/blood-requests/:id/status
 * Update request status
 */
app.patch('/api/blood-requests/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const now = Math.floor(Date.now() / 1000);

  db.run(`
    UPDATE blood_requests SET status = ?, updated_at = ? WHERE id = ?
  `, [status, now, id], function(err) {
    if (err) {
      console.error('Error updating request status:', err);
      return res.status(500).json({ error: 'Failed to update status' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    console.log(`✅ Request ${id} status updated to: ${status}`);
    res.json({ success: true, status, updatedAt: now * 1000 });
  });
});

/**
 * PATCH /api/blood-requests/:id/share-location
 * Update recipient's live location sharing preference
 */
app.patch('/api/blood-requests/:id/share-location', (req, res) => {
  const { id } = req.params;
  const { shareLocation } = req.body;

  if (shareLocation === undefined) {
    return res.status(400).json({ error: 'shareLocation is required' });
  }

  const now = Math.floor(Date.now() / 1000);

  db.run(`
    UPDATE blood_requests 
    SET share_location = ?, 
        recipient_location_updated_at = ?,
        updated_at = ? 
    WHERE id = ?
  `, [shareLocation ? 1 : 0, shareLocation ? now : null, now, id], function(err) {
    if (err) {
      console.error('Error updating share location:', err);
      return res.status(500).json({ error: 'Failed to update share location' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    console.log(`✅ Request ${id} share_location updated to: ${shareLocation}`);
    res.json({ success: true, shareLocation, updatedAt: now * 1000 });
  });
});

/**
 * GET /api/blood-requests/available/:donorId
 * Get available requests for a specific donor (with eligibility checks)
 */
app.get('/api/blood-requests/available/:donorId', (req, res) => {
  const { donorId } = req.params;

  // First check if donor profile is approved
  db.get(`
    SELECT * FROM donor_profiles WHERE user_id = ?
  `, [donorId], (err, donorProfile) => {
    if (err) {
      console.error('Error fetching donor profile:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!donorProfile) {
      return res.json({ 
        requests: [], 
        message: 'Please complete your profile first' 
      });
    }

    if (donorProfile.approval_status !== 'APPROVED') {
      return res.json({ 
        requests: [], 
        message: donorProfile.approval_status === 'REJECTED'
          ? 'Your profile was rejected. Please update it.'
          : 'Your profile is pending admin approval.'
      });
    }

    // Check if donor can donate (3-month rule based on last COMPLETED donation)
    // NOTE: We check last_donated from donor_profiles, which only updates on completion
    if (donorProfile.last_donated) {
      const lastDonatedDate = new Date(donorProfile.last_donated * 1000); // Convert from Unix timestamp
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (lastDonatedDate > threeMonthsAgo) {
        const nextEligibleDate = new Date(lastDonatedDate);
        nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);
        console.log(`❌ Donor ${donorId} not eligible yet. Last donated: ${lastDonatedDate}, Next eligible: ${nextEligibleDate}`);
        return res.json({ 
          requests: [], 
          message: `You can donate again after ${nextEligibleDate.toLocaleDateString()}`
        });
      }
    }

    // If no last_donated or more than 3 months, proceed to fetch available requests
    console.log(`✅ Donor ${donorId} is eligible to donate`);
    fetchAvailableRequests();

    function fetchAvailableRequests() {

    // Blood compatibility mapping: donor blood group -> compatible recipient blood groups
    const bloodCompatibility = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal donor
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+']
    };

    const compatibleBloodGroups = bloodCompatibility[donorProfile.blood_group] || [donorProfile.blood_group];
    const placeholders = compatibleBloodGroups.map(() => '?').join(',');

    // Get requests matching donor's compatible blood groups and not yet fulfilled
    db.all(`
      SELECT br.*, rp.mobile as recipient_mobile
      FROM blood_requests br
      LEFT JOIN recipient_profiles rp ON br.recipient_id = rp.user_id
      WHERE br.blood_group IN (${placeholders})
        AND br.status != 'COMPLETED'
        AND br.status != 'CANCELLED'
        AND br.accepted_units < br.units
      ORDER BY 
        CASE WHEN br.urgency_level = 'EMERGENCY' THEN 0 ELSE 1 END,
        br.created_at DESC
    `, compatibleBloodGroups, (err, requests) => {
      if (err) {
        console.error('Error fetching available requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Filter out requests already accepted/declined by this donor
      const filteredRequests = [];
      let processed = 0;

      if (requests.length === 0) {
        return res.json({ requests: [] });
      }

      requests.forEach(request => {
        // Check if this donor has already accepted/declined this request
        db.get(`
          SELECT 1 FROM accepted_donors WHERE request_id = ? AND donor_id = ?
          UNION
          SELECT 1 FROM declined_donors WHERE request_id = ? AND donor_id = ?
        `, [request.id, donorId, request.id, donorId], (err, donorResult) => {
          if (!donorResult) {
            // Check if ANY donor has already accepted this request (ONE DONOR ONLY rule)
            db.get(`
              SELECT 1 FROM accepted_donors ad JOIN blood_requests br ON ad.request_id = br.id WHERE ad.request_id = ? AND br.status != 'CANCELLED'
            `, [request.id], (err, anyAcceptedResult) => {
              // Only show request if no donor has accepted it yet
              if (!anyAcceptedResult) {
                filteredRequests.push({
                  ...request,
                  createdAt: request.created_at * 1000,
                  updatedAt: request.updated_at * 1000,
                  // Don't show mobile until accepted
                  recipientMobile: null
                });
              }

              processed++;
              if (processed === requests.length) {
                res.json({ requests: filteredRequests });
              }
            });
          } else {
            processed++;
            if (processed === requests.length) {
              res.json({ requests: filteredRequests });
            }
          }
        });
      });
    });
    } // end fetchAvailableRequests
  });
});

/**
 * POST /api/blood-requests/:id/accept
 * Donor accepts a blood request (with units management)
 */
app.post('/api/blood-requests/:id/accept', (req, res) => {
  const { id } = req.params;
  const { donorId, donorName, currentLocation } = req.body;

  if (!donorId || !donorName) {
    return res.status(400).json({ error: 'Donor ID and name are required' });
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if donor account is active
  db.get(`SELECT account_status, deactivation_reason FROM users WHERE id = ?`, [donorId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.account_status === 'deactivated') {
      return res.status(403).json({ 
        error: 'Your account has been deactivated',
        reason: user.deactivation_reason,
        canAppeal: true
      });
    }

    // Check if donor already has an active donation (join blood_requests for status)
    db.get(`
      SELECT ad.request_id, br.status FROM accepted_donors ad
      JOIN blood_requests br ON ad.request_id = br.id
      WHERE ad.donor_id = ? AND br.status NOT IN ('CANCELLED', 'COMPLETED')
      ORDER BY ad.accepted_at DESC
      LIMIT 1
    `, [donorId], (err, activeRequest) => {
      if (err) {
        console.error('Error checking active donations:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (activeRequest) {
        return res.status(400).json({ 
          error: 'You already have an active donation',
          message: 'Please complete or cancel your current donation before accepting another request.',
          activeRequestId: activeRequest.request_id,
          activeRequestStatus: activeRequest.status
        });
      }

      // Check donor eligibility
      db.get(`SELECT * FROM donor_profiles WHERE user_id = ?`, [donorId], (err, donorProfile) => {
        if (err || !donorProfile) {
          return res.status(403).json({ error: 'Donor profile not found' });
        }

        if (donorProfile.approval_status !== 'APPROVED') {
          return res.status(403).json({ error: 'Donor profile not approved' });
        }

    // Insert accepted donor — use only guaranteed core columns
    db.run(`
      INSERT OR IGNORE INTO accepted_donors (request_id, donor_id, donor_name, accepted_at)
      VALUES (?, ?, ?, ?)
    `, [id, donorId, donorName, now], function(err) {
      if (err) {
        console.error('Error accepting request:', err);
        return res.status(500).json({ error: 'Failed to accept request' });
      }
      // Silently set optional columns if they exist
      db.run(`UPDATE accepted_donors SET donor_current_location = ?, status = 'ACCEPTED' WHERE request_id = ? AND donor_id = ?`,
        [currentLocation || null, id, donorId], () => {});

      if (this.changes === 0) {
        return res.json({ success: true, message: 'Already accepted' });
      }

      // Get current request details
      db.get(`SELECT * FROM blood_requests WHERE id = ?`, [id], (err, request) => {
        if (err || !request) {
          return res.status(404).json({ error: 'Request not found' });
        }

        const newAcceptedUnits = request.accepted_units + 1;
        // Keep status as ACCEPTED, don't auto-complete
        const newStatus = request.status === 'PENDING' ? 'ACCEPTED' : request.status;

        // Update accepted units and status
        db.run(`
          UPDATE blood_requests 
          SET accepted_units = ?, status = ?, updated_at = ? 
          WHERE id = ?
        `, [newAcceptedUnits, newStatus, now, id], function(updateErr) {
          if (updateErr) {
            console.error('Error updating request:', updateErr);
            return res.status(500).json({ error: 'Failed to update request' });
          }

          // Get recipient mobile
          db.get(`
            SELECT mobile FROM recipient_profiles WHERE user_id = ?
          `, [request.recipient_id], (err, recipientProfile) => {
            // Create audit log for request acceptance
            createAuditLog({
              actorRole: 'donor',
              actorId: donorId,
              actorName: donorName,
              action: 'ACCEPT_BLOOD_REQUEST',
              entityType: 'BLOOD_REQUEST',
              entityId: id,
              details: {
                requestBloodGroup: request.blood_group,
                acceptedUnits: newAcceptedUnits,
                totalUnits: request.units,
                requestStatus: newStatus
              },
              ipAddress: req.ip || req.connection.remoteAddress
            });

            // Create notification for recipient (donor has accepted their request)
            createNotification(
              request.recipient_id,
              'REQUEST_ACCEPTED',
              'Donor Found!',
              `${donorName} has accepted your blood request for ${request.blood_group}. Check your active requests for details.`,
              { requestId: id, donorId, donorName, bloodGroup: request.blood_group }
            );

            console.log(`✅ Donor ${donorName} accepted request ${id} - ${newAcceptedUnits}/${request.units} units`);
            
            res.json({ 
              success: true, 
              message: 'Request accepted',
              acceptedAt: now * 1000,
              recipientMobile: recipientProfile ? recipientProfile.mobile : null,
              requestStatus: newStatus
            });
          });
        });
      });
    });
      }); // Close donor profile check
    }); // Close active donation check
  }); // Close account status check
});

/**
 * POST /api/blood-requests/:id/decline
 * Donor declines a blood request
 */
app.post('/api/blood-requests/:id/decline', (req, res) => {
  const { id } = req.params;
  const { donorId } = req.body;

  if (!donorId) {
    return res.status(400).json({ error: 'Donor ID is required' });
  }

  const now = Math.floor(Date.now() / 1000);

  db.run(`
    INSERT OR IGNORE INTO declined_donors (request_id, donor_id, declined_at)
    VALUES (?, ?, ?)
  `, [id, donorId, now], function(err) {
    if (err) {
      console.error('Error declining request:', err);
      return res.status(500).json({ error: 'Failed to decline request' });
    }

    console.log(`✅ Donor ${donorId} declined request ${id}`);
    res.json({ success: true, message: 'Request declined' });
  });
});

/**
 * GET /api/blood-requests/:id/accepted-donors
 * Get list of accepted donors for a request with full details
 */
app.get('/api/blood-requests/:id/accepted-donors', (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT 
      ad.donor_id,
      ad.donor_name,
      ad.accepted_at,
      ad.donor_completed,
      ad.donor_completed_at,
      ad.recipient_completed,
      ad.recipient_completed_at,
      ad.status,
      ad.donor_current_location,
      dp.mobile,
      dp.address,
      dp.city,
      dp.profile_image,
      rr.donor_rating,
      rr.donor_comment,
      rr.donor_rated_at,
      rr.recipient_rating,
      rr.recipient_comment,
      rr.recipient_rated_at
    FROM accepted_donors ad
    LEFT JOIN donor_profiles dp ON ad.donor_id = dp.user_id
    LEFT JOIN respect_ratings rr ON ad.request_id = rr.request_id AND ad.donor_id = rr.donor_id
    WHERE ad.request_id = ?
    ORDER BY ad.accepted_at DESC
  `, [id], (err, donors) => {
    if (err) {
      console.error('Error fetching accepted donors:', err);
      return res.status(500).json({ error: 'Failed to fetch accepted donors' });
    }

    // Debug log
    if (donors && donors.length > 0) {
      console.log(`📋 Fetched ${donors.length} accepted donors for request ${id}`);
      donors.forEach(d => {
        console.log(`  - ${d.donor_name}: profile_image=${d.profile_image ? 'EXISTS' : 'NULL'} (length: ${d.profile_image ? d.profile_image.length : 0})`);
      });
    }

    res.json({ 
      success: true, 
      donors: donors || [] 
    });
  });
});

/**
 * POST /api/blood-requests/:id/complete
 * Mark donation as completed by donor or recipient
 */
app.post('/api/blood-requests/:id/complete', (req, res) => {
  const { id } = req.params;
  const { userId, role, donorId } = req.body; // role: 'donor' or 'recipient'

  if (!userId || !role) {
    return res.status(400).json({ error: 'User ID and role are required' });
  }

  const now = Math.floor(Date.now() / 1000);
  const targetDonorId = role === 'donor' ? userId : donorId;

  if (!targetDonorId) {
    return res.status(400).json({ error: 'Donor ID is required' });
  }

  // When EITHER donor OR recipient marks as complete, the donation is COMPLETED immediately
  const updateField = role === 'donor' ? 'donor_completed' : 'recipient_completed';
  const updateTimeField = role === 'donor' ? 'donor_completed_at' : 'recipient_completed_at';

  console.log(`🎯 ${role} completing request ${id} for donor ${targetDonorId}`);

  // Update accepted_donors — core UPDATE only, optional columns done silently after
  db.run(`
    UPDATE accepted_donors SET accepted_at = accepted_at WHERE request_id = ? AND donor_id = ?
  `, [id, targetDonorId], function(err) {
    if (err) {
      console.error('❌ Error in accepted_donors touch:', err);
      return res.status(500).json({ error: 'Failed to mark as completed' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Accepted donation not found' });
    }

    // Silently set optional migration columns if they exist
    db.run(`UPDATE accepted_donors SET ${updateField} = 1, ${updateTimeField} = ?, status = 'COMPLETED' WHERE request_id = ? AND donor_id = ?`,
      [now, id, targetDonorId], () => {});

    // Update donor's last_donated date immediately (as Unix timestamp)
    db.run(`
      UPDATE donor_profiles 
      SET last_donated = ?
      WHERE user_id = ?
    `, [now, targetDonorId], (err) => {
      if (err) {
        console.error('❌ Error updating last_donated:', err);
      } else {
        const donationDate = new Date(now * 1000).toLocaleDateString();
        console.log(`✅ Updated last_donated for donor ${targetDonorId}: ${donationDate}`);
      }
    });

    // Update blood_requests status to COMPLETED
    db.run(`
      UPDATE blood_requests 
      SET status = 'COMPLETED', updated_at = ?
      WHERE id = ?
    `, [now, id], (err) => {
      if (err) {
        console.error('❌ Error updating request status:', err);
      } else {
        console.log(`✅ Request ${id} marked as COMPLETED by ${role}`);
        
        // Get user name for audit log
        db.get(`SELECT name FROM users WHERE id = ?`, [userId], (err, user) => {
          if (!err && user) {
            // Create audit log for request completion
            createAuditLog({
              actorRole: role === 'donor' ? 'donor' : 'user',
              actorId: userId,
              actorName: user.name,
              action: 'COMPLETE_BLOOD_REQUEST',
              entityType: 'BLOOD_REQUEST',
              entityId: id,
              details: {
                completedBy: role,
                donorId: targetDonorId
              },
              ipAddress: req.ip || req.connection.remoteAddress
            });
          }
        });
      }

      // Return success response
      res.json({ 
        success: true, 
        message: 'Donation completed successfully',
        status: 'COMPLETED',
        bothCompleted: true // Always true now since one completion = done
      });
    });
  });
});

/**
 * POST /api/respect-ratings
 * Submit respect rating from donor to recipient or vice versa
 */
app.post('/api/respect-ratings', (req, res) => {
  const { requestId, donorId, recipientId, rating, comment, raterRole } = req.body;

  console.log('📝 Rating submission received:', {
    requestId: requestId || 'MISSING',
    donorId: donorId || 'MISSING',
    recipientId: recipientId || 'MISSING',
    rating: rating || 'MISSING',
    raterRole: raterRole || 'MISSING',
    comment: comment ? 'PROVIDED' : 'NONE'
  });

  if (!requestId || !donorId || !recipientId || !rating || !raterRole) {
    console.error('❌ Missing required fields in rating submission');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const now = Math.floor(Date.now() / 1000);
  const ratingId = `rating_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Check if rating record exists
  db.get(`
    SELECT * FROM respect_ratings 
    WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
  `, [requestId, donorId, recipientId], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      // Update existing rating
      if (raterRole === 'donor') {
        db.run(`
          UPDATE respect_ratings 
          SET donor_rating = ?, donor_comment = ?, donor_rated_at = ?
          WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
        `, [rating, comment, now, requestId, donorId, recipientId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to update rating' });
          }
          console.log(`✅ Donor ${donorId} rated recipient ${recipientId}: ${rating}/5`);
          res.json({ success: true, message: 'Rating submitted' });
        });
      } else {
        db.run(`
          UPDATE respect_ratings 
          SET recipient_rating = ?, recipient_comment = ?, recipient_rated_at = ?
          WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
        `, [rating, comment, now, requestId, donorId, recipientId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to update rating' });
          }
          console.log(`✅ Recipient ${recipientId} rated donor ${donorId}: ${rating}/5`);
          res.json({ success: true, message: 'Rating submitted' });
        });
      }
    } else {
      // Create new rating record
      if (raterRole === 'donor') {
        db.run(`
          INSERT INTO respect_ratings (id, request_id, donor_id, recipient_id, donor_rating, donor_comment, donor_rated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [ratingId, requestId, donorId, recipientId, rating, comment, now], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to save rating' });
          }
          console.log(`✅ Donor ${donorId} rated recipient ${recipientId}: ${rating}/5`);
          res.json({ success: true, message: 'Rating submitted' });
        });
      } else {
        db.run(`
          INSERT INTO respect_ratings (id, request_id, donor_id, recipient_id, recipient_rating, recipient_comment, recipient_rated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [ratingId, requestId, donorId, recipientId, rating, comment, now], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to save rating' });
          }
          console.log(`✅ Recipient ${recipientId} rated donor ${donorId}: ${rating}/5`);
          res.json({ success: true, message: 'Rating submitted' });
        });
      }
    }
  });
});

/**
 * GET /api/respect-ratings/:userId
 * Get average respect rating for a user (donor or recipient)
 */
app.get('/api/respect-ratings/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(`
    SELECT 
      donor_rating, recipient_rating
    FROM respect_ratings
    WHERE donor_id = ? OR recipient_id = ?
  `, [userId, userId], (err, ratings) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch ratings' });
    }

    let totalRating = 0;
    let count = 0;

    ratings.forEach(r => {
      if (r.donor_rating) { totalRating += r.donor_rating; count++; }
      if (r.recipient_rating) { totalRating += r.recipient_rating; count++; }
    });

    const averageRating = count > 0 ? (totalRating / count).toFixed(1) : 0;

    res.json({ 
      success: true, 
      averageRating: parseFloat(averageRating),
      totalRatings: count
    });
  });
});

/**
 * GET /api/respect-ratings/check/:requestId/:donorId/:recipientId/:userRole
 * Check if user has already rated or skipped
 */
app.get('/api/respect-ratings/check/:requestId/:donorId/:recipientId/:userRole', (req, res) => {
  const { requestId, donorId, recipientId, userRole } = req.params;

  console.log('🔍 Checking rating status:', { requestId, donorId, recipientId, userRole });

  db.get(`
    SELECT * FROM respect_ratings 
    WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
  `, [requestId, donorId, recipientId], (err, rating) => {
    if (err) {
      console.error('❌ Error checking rating status:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!rating) {
      // No rating record exists
      return res.json({ 
        success: true, 
        hasRated: false, 
        hasSkipped: false,
        shouldShowRating: true 
      });
    }

    // Check based on user role
    if (userRole === 'donor') {
      const hasRated = rating.donor_rating !== null && rating.donor_rating !== undefined;
      const hasSkipped = rating.donor_skipped === 1;
      console.log(`✅ Donor status: rated=${hasRated}, skipped=${hasSkipped}`);
      return res.json({ 
        success: true, 
        hasRated, 
        hasSkipped,
        shouldShowRating: !hasRated && !hasSkipped
      });
    } else {
      const hasRated = rating.recipient_rating !== null && rating.recipient_rating !== undefined;
      const hasSkipped = rating.recipient_skipped === 1;
      console.log(`✅ Recipient status: rated=${hasRated}, skipped=${hasSkipped}`);
      return res.json({ 
        success: true, 
        hasRated, 
        hasSkipped,
        shouldShowRating: !hasRated && !hasSkipped
      });
    }
  });
});

/**
 * POST /api/respect-ratings/skip
 * Mark rating as skipped
 */
app.post('/api/respect-ratings/skip', (req, res) => {
  const { requestId, donorId, recipientId, raterRole } = req.body;

  console.log('⏭️ Skip rating request:', { requestId, donorId, recipientId, raterRole });

  if (!requestId || !donorId || !recipientId || !raterRole) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = Math.floor(Date.now() / 1000);
  const ratingId = `rating_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Check if rating record exists
  db.get(`
    SELECT * FROM respect_ratings 
    WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
  `, [requestId, donorId, recipientId], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      // Update existing record
      if (raterRole === 'donor') {
        db.run(`
          UPDATE respect_ratings 
          SET donor_skipped = 1, donor_skipped_at = ?
          WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
        `, [now, requestId, donorId, recipientId], function(err) {
          if (err) {
            console.error('❌ Error updating skip status:', err);
            return res.status(500).json({ error: 'Failed to skip rating' });
          }
          console.log(`⏭️ Donor ${donorId} skipped rating for request ${requestId}`);
          res.json({ success: true, message: 'Rating skipped' });
        });
      } else {
        db.run(`
          UPDATE respect_ratings 
          SET recipient_skipped = 1, recipient_skipped_at = ?
          WHERE request_id = ? AND donor_id = ? AND recipient_id = ?
        `, [now, requestId, donorId, recipientId], function(err) {
          if (err) {
            console.error('❌ Error updating skip status:', err);
            return res.status(500).json({ error: 'Failed to skip rating' });
          }
          console.log(`⏭️ Recipient ${recipientId} skipped rating for request ${requestId}`);
          res.json({ success: true, message: 'Rating skipped' });
        });
      }
    } else {
      // Create new record with skipped status
      if (raterRole === 'donor') {
        db.run(`
          INSERT INTO respect_ratings (id, request_id, donor_id, recipient_id, donor_skipped, donor_skipped_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `, [ratingId, requestId, donorId, recipientId, now], function(err) {
          if (err) {
            console.error('❌ Error creating skip record:', err);
            return res.status(500).json({ error: 'Failed to skip rating' });
          }
          console.log(`⏭️ Donor ${donorId} skipped rating for request ${requestId}`);
          res.json({ success: true, message: 'Rating skipped' });
        });
      } else {
        db.run(`
          INSERT INTO respect_ratings (id, request_id, donor_id, recipient_id, recipient_skipped, recipient_skipped_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `, [ratingId, requestId, donorId, recipientId, now], function(err) {
          if (err) {
            console.error('❌ Error creating skip record:', err);
            return res.status(500).json({ error: 'Failed to skip rating' });
          }
          console.log(`⏭️ Recipient ${recipientId} skipped rating for request ${requestId}`);
          res.json({ success: true, message: 'Rating skipped' });
        });
      }
    }
  });
});

/**
 * POST /api/blood-requests/:id/cancel
 * Cancel a blood request
 */
app.post('/api/blood-requests/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { userId, role, reason, donorId } = req.body; // role: 'donor' or 'recipient'

  console.log(`🚫 [Cancel] Request received - ID: ${id}, User: ${userId}, Role: ${role}, Reason: ${reason || 'N/A'}`);

  if (!userId || !role) {
    console.error('❌ [Cancel] Missing userId or role');
    return res.status(400).json({ success: false, error: 'User ID and role are required' });
  }

  const now = Math.floor(Date.now() / 1000);

  // First check the request status
  db.get(`SELECT * FROM blood_requests WHERE id = ?`, [id], (err, request) => {
    if (err) {
      console.error('❌ [Cancel] Database error:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (!request) {
      console.error('❌ [Cancel] Request not found:', id);
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    console.log(`📋 [Cancel] Current request status: ${request.status}`);

    // Check if reason is required (after acceptance)
    if (request.status === 'ACCEPTED' && !reason) {
      console.error('❌ [Cancel] Reason required for accepted request');
      return res.status(400).json({ success: false, error: 'Cancellation reason is required for accepted requests' });
    }

    // For pending requests, recipient can cancel without reason
    if (request.status === 'PENDING' && role === 'recipient') {
      db.run(`UPDATE blood_requests SET status = 'CANCELLED', updated_at = ? WHERE id = ?`,
        [now, id], function(err) {
        if (err) {
          console.error('❌ [Cancel] Failed to update request:', err);
          return res.status(500).json({ success: false, error: 'Failed to cancel request' });
        }
        // Silently try optional columns
        db.run(`UPDATE blood_requests SET cancelled_by = ?, cancellation_reason = ? WHERE id = ?`,
          [userId, reason || 'Cancelled by recipient', id], () => {});

        const cancellationId = `cancel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        db.run(`INSERT INTO request_cancellations (id, request_id, cancelled_by, cancelled_by_role, reason, cancelled_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [cancellationId, id, userId, role, reason || 'Cancelled by recipient', now], () => {});

        console.log(`✅ [Cancel] Request ${id} cancelled by recipient`);
        res.json({ success: true, message: 'Request cancelled' });
      });
    } else if (role === 'donor' && donorId) {
      // Donor cancelling - CANCEL the entire request
      console.log(`🚫 [Cancel] Donor ${donorId} cancelling - will CANCEL entire request`);

      // Silently update accepted_donors status (column may not exist in older DBs)
      db.run(`UPDATE accepted_donors SET status = 'CANCELLED' WHERE request_id = ? AND donor_id = ?`,
        [id, donorId], () => {});

      // Cancel the blood request - only use guaranteed columns
      db.run(`UPDATE blood_requests SET status = 'CANCELLED', updated_at = ? WHERE id = ?`,
        [now, id], function(err) {
          if (err) {
            console.error('❌ [Cancel] Failed to update request status:', err);
            return res.status(500).json({ success: false, error: 'Failed to cancel request' });
          }
          // Silently try optional columns
          db.run(`UPDATE blood_requests SET cancelled_by = ?, cancellation_reason = ? WHERE id = ?`,
            [donorId, reason || 'Cancelled by donor', id], () => {});

          const cancellationId = `cancel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          db.run(`INSERT INTO request_cancellations (id, request_id, cancelled_by, cancelled_by_role, reason, cancelled_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [cancellationId, id, donorId, 'donor', reason || 'Cancelled by donor', now], () => {});

          console.log(`✅ [Cancel] Request ${id} CANCELLED by donor ${donorId}`);
          res.json({ success: true, message: 'Request cancelled' });
        });
    } else if (role === 'recipient') {
      // Recipient cancelling accepted request
      console.log(`🚫 [Cancel] Recipient cancelling ACCEPTED request`);

      // Silently update accepted_donors status (column may not exist in older DBs)
      db.run(`UPDATE accepted_donors SET status = 'CANCELLED' WHERE request_id = ?`, [id], () => {});

      // Now cancel the blood request — only guaranteed columns first
      db.run(`UPDATE blood_requests SET status = 'CANCELLED', updated_at = ? WHERE id = ?`,
        [now, id], function(err) {
        if (err) {
          console.error('❌ [Cancel] Error updating blood_requests:', err);
          return res.status(500).json({ success: false, error: 'Failed to cancel request' });
        }

        // Silently try optional columns
        db.run(`UPDATE blood_requests SET cancelled_by = ?, cancellation_reason = ? WHERE id = ?`,
          [userId, reason || 'Cancelled by recipient', id], () => {});

        const cancellationId = `cancel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        db.run(`INSERT INTO request_cancellations (id, request_id, cancelled_by, cancelled_by_role, reason, cancelled_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [cancellationId, id, userId, role, reason || 'Cancelled by recipient', now], () => {});

        console.log(`✅ [Cancel] Request ${id} cancelled by recipient`);
        res.json({ success: true, message: 'Request cancelled' });
      });
    } else {
      console.error('❌ [Cancel] Invalid cancellation request - role:', role, 'donorId:', donorId);
      res.status(400).json({ success: false, error: 'Invalid cancellation request' });
    }
  });
});

/**
 * GET /api/donor-stats/:donorId
 * Get donor statistics (completed donations only)
 * Only counts as "donated" when both donor and recipient mark as complete
 */
app.get('/api/donor-stats/:donorId', (req, res) => {
  const { donorId } = req.params;

  db.get(`
    SELECT 
      (SELECT COUNT(*) FROM accepted_donors ad2
       JOIN blood_requests br2 ON ad2.request_id = br2.id
       WHERE ad2.donor_id = ? 
       AND br2.status = 'COMPLETED') as donated_count
  `, [donorId], (err, stats) => {
    if (err) {
      console.error('Error fetching donor stats:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      donatedCount: stats.donated_count || 0,
    });
  });
});

/**
 * GET /api/donor-accepted/:donorId
 * Get all accepted donations for a donor with full details
 */
app.get('/api/donor-accepted/:donorId', (req, res) => {
  const { donorId } = req.params;

  db.all(`
    SELECT 
      br.*,
      ad.accepted_at,
      ad.donor_completed,
      ad.donor_completed_at,
      ad.recipient_completed,
      ad.recipient_completed_at,
      ad.status as donation_status,
      rp.mobile as recipient_mobile,
      rc.cancelled_by,
      rc.cancelled_by_role,
      rc.reason as cancellation_reason,
      rc.cancelled_at,
      rr.donor_rating,
      rr.donor_comment,
      rr.donor_rated_at,
      rr.recipient_rating,
      rr.recipient_comment,
      rr.recipient_rated_at
    FROM accepted_donors ad
    INNER JOIN blood_requests br ON ad.request_id = br.id
    LEFT JOIN recipient_profiles rp ON br.recipient_id = rp.user_id
    LEFT JOIN request_cancellations rc ON br.id = rc.request_id
    LEFT JOIN respect_ratings rr ON br.id = rr.request_id AND ad.donor_id = rr.donor_id
    WHERE ad.donor_id = ?
    ORDER BY ad.accepted_at DESC
  `, [donorId], (err, donations) => {
    if (err) {
      console.error('Error fetching accepted donations:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const formattedDonations = donations.map(d => ({
      id: d.id,
      recipientId: d.recipient_id,
      recipientName: d.recipient_name,
      recipientMobile: d.recipient_mobile,
      bloodGroup: d.blood_group,
      units: d.units,
      acceptedUnits: d.accepted_units,
      urgencyLevel: d.urgency_level,
      location: d.location,
      notes: d.notes,
      status: d.donation_status || d.status,
      shareLocation: d.share_location || 0,
      createdAt: d.created_at * 1000,
      acceptedAt: d.accepted_at * 1000,
      donorCompleted: d.donor_completed || 0,
      donorCompletedAt: d.donor_completed_at ? d.donor_completed_at * 1000 : null,
      recipientCompleted: d.recipient_completed || 0,
      recipientCompletedAt: d.recipient_completed_at ? d.recipient_completed_at * 1000 : null,
      // Cancellation data
      cancelledBy: d.cancelled_by,
      cancelledByRole: d.cancelled_by_role,
      cancellationReason: d.cancellation_reason,
      cancelledAt: d.cancelled_at ? d.cancelled_at * 1000 : null,
      // Rating data
      donorRating: d.donor_rating,
      donorComment: d.donor_comment,
      donorRatedAt: d.donor_rated_at ? d.donor_rated_at * 1000 : null,
      recipientRating: d.recipient_rating,
      recipientComment: d.recipient_comment,
      recipientRatedAt: d.recipient_rated_at ? d.recipient_rated_at * 1000 : null,
    }));

    console.log(`📋 Fetched ${formattedDonations.length} donations for donor ${donorId}`);
    // Debug: log cancellation data for cancelled donations
    formattedDonations.forEach(d => {
      if (d.status === 'CANCELLED') {
        console.log(`  ❌ Cancelled donation ${d.id}: cancelledBy=${d.cancelledBy}, role=${d.cancelledByRole}, reason=${d.cancellationReason}`);
      }
    });
    res.json({ donations: formattedDonations });
  });
});

/**
 * POST /api/location/update
 * Update user's live location
 */
app.post('/api/location/update', (req, res) => {
  const { userId, requestId, latitude, longitude } = req.body;

  if (!userId || !requestId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = Math.floor(Date.now() / 1000);

  db.run(`
    INSERT OR REPLACE INTO live_locations (user_id, request_id, latitude, longitude, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, requestId, latitude, longitude, now], function(err) {
    if (err) {
      console.error('Error updating location:', err);
      return res.status(500).json({ error: 'Failed to update location' });
    }

    res.json({ success: true, message: 'Location updated' });
  });
});

/**
 * GET /api/location/:requestId
 * Get live locations for all parties involved in a request
 */
app.get('/api/location/:requestId', (req, res) => {
  const { requestId } = req.params;

  // Get donor and recipient locations
  db.all(`
    SELECT 
      ll.user_id,
      ll.latitude,
      ll.longitude,
      ll.updated_at,
      u.name as user_name,
      u.role as user_role
    FROM live_locations ll
    INNER JOIN users u ON ll.user_id = u.id
    WHERE ll.request_id = ?
  `, [requestId], (err, locations) => {
    if (err) {
      console.error('Error fetching locations:', err);
      return res.status(500).json({ error: 'Failed to fetch locations' });
    }

    // Also get request location sharing preference and recipient name
    // Use a try/fallback approach: if the optional location columns don't
    // exist yet on this database, fall back to a query without them instead
    // of crashing the whole endpoint.
    db.get(`
      SELECT 
        br.share_location, 
        br.recipient_latitude, 
        br.recipient_longitude, 
        br.recipient_location_updated_at,
        br.recipient_id,
        u.name as recipient_name
      FROM blood_requests br
      LEFT JOIN users u ON br.recipient_id = u.id
      WHERE br.id = ?
    `, [requestId], (err, request) => {
      if (err) {
        console.warn('⚠️ Optional location columns missing, falling back:', err.message);
        // Fallback query using only guaranteed columns
        db.get(`
          SELECT br.recipient_id, u.name as recipient_name
          FROM blood_requests br
          LEFT JOIN users u ON br.recipient_id = u.id
          WHERE br.id = ?
        `, [requestId], (fallbackErr, fallbackRequest) => {
          if (fallbackErr) {
            console.error('Error fetching request (fallback):', fallbackErr);
            return res.status(500).json({ error: 'Failed to fetch request' });
          }
          return res.json({
            success: true,
            locations: locations || [],
            shareLocation: 0,
            recipientName: fallbackRequest ? fallbackRequest.recipient_name : null,
            recipientStaticLocation: null
          });
        });
        return;
      }

      res.json({
        success: true,
        locations: locations || [],
        shareLocation: request ? request.share_location : 0,
        recipientName: request ? request.recipient_name : null,
        recipientStaticLocation: request && request.recipient_latitude && request.recipient_longitude ? {
          latitude: request.recipient_latitude,
          longitude: request.recipient_longitude,
          updatedAt: request.recipient_location_updated_at
        } : null
      });
    });
  });
});

/**
 * GET /api/route/:requestId
 * Calculate route from donor to recipient target location using OSRM
 */
app.get('/api/route/:requestId', (req, res) => {
  const { requestId } = req.params;
  const { donorId } = req.query;

  console.log('🛣️ [Route API] Request received - requestId:', requestId, 'donorId:', donorId);

  if (!donorId) {
    return res.status(400).json({ success: false, error: 'Donor ID is required' });
  }

  // Get donor's current location
  db.get(`
    SELECT latitude, longitude 
    FROM live_locations 
    WHERE request_id = ? AND user_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `, [requestId, donorId], (err, donorLocation) => {
    if (err) {
      console.error('❌ [Route API] Error fetching donor location:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch donor location' });
    }

    if (!donorLocation) {
      console.log('⚠️ [Route API] Donor location not found');
      return res.json({ 
        success: false, 
        error: 'Donor location not available',
        route: null 
      });
    }

    console.log('✅ [Route API] Donor location found:', donorLocation.latitude, donorLocation.longitude);

    // Get recipient's target location
    db.get(`
      SELECT recipient_latitude, recipient_longitude
      FROM blood_requests
      WHERE id = ?
    `, [requestId], (err, request) => {
      if (err) {
        console.error('❌ [Route API] Error fetching request:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch request' });
      }

      if (!request || !request.recipient_latitude || !request.recipient_longitude) {
        console.log('⚠️ [Route API] Target location not found');
        return res.json({ 
          success: false, 
          error: 'Target location not available',
          route: null 
        });
      }

      console.log('✅ [Route API] Target location found:', request.recipient_latitude, request.recipient_longitude);

      // Call OSRM for route calculation
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${donorLocation.longitude},${donorLocation.latitude};${request.recipient_longitude},${request.recipient_latitude}?overview=full&geometries=geojson`;

      console.log('🌐 [Route API] Calling OSRM:', osrmUrl);

      // Use https module for better compatibility
      const https = require('https');
      
      https.get(osrmUrl, (osrmResponse) => {
        let data = '';

        osrmResponse.on('data', (chunk) => {
          data += chunk;
        });

        osrmResponse.on('end', () => {
          try {
            const osrmData = JSON.parse(data);

            if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
              const route = osrmData.routes[0];
              
              // Convert GeoJSON coordinates [lon, lat] to {latitude, longitude}
              const coordinates = route.geometry.coordinates.map(coord => ({
                longitude: coord[0],
                latitude: coord[1],
              }));

              const distanceKm = (route.distance / 1000).toFixed(2);
              const durationMin = Math.round(route.duration / 60);

              console.log('✅ [Route API] Route calculated:', distanceKm, 'km,', durationMin, 'min,', coordinates.length, 'points');

              return res.json({
                success: true,
                route: {
                  coordinates,
                  distance: distanceKm,
                  duration: durationMin,
                  distanceMeters: route.distance,
                  durationSeconds: route.duration,
                }
              });
            } else {
              console.warn('⚠️ [Route API] No route found from OSRM:', osrmData.code);
              return res.json({ 
                success: false, 
                error: 'No route found',
                route: null 
              });
            }
          } catch (parseError) {
            console.error('❌ [Route API] JSON parse error:', parseError);
            return res.status(500).json({ 
              success: false,
              error: 'Failed to parse route data',
              route: null 
            });
          }
        });
      }).on('error', (fetchError) => {
        console.error('❌ [Route API] OSRM fetch error:', fetchError);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to calculate route',
          route: null 
        });
      });
    });
  });
});

// ============================================
// ACCOUNT MANAGEMENT & APPEALS API
// ============================================

/**
 * POST /api/admin/users/:userId/deactivate
 * Admin: Deactivate a user account
 */
app.post('/api/admin/users/:userId/deactivate', (req, res) => {
  const { userId } = req.params;
  const { reason, adminId } = req.body;

  console.log(`🚫 Deactivating user ${userId} by admin ${adminId}`);

  if (!reason || !adminId) {
    return res.status(400).json({ error: 'Reason and adminId are required' });
  }

  const now = Math.floor(Date.now() / 1000);

  db.run(`
    UPDATE users 
    SET account_status = 'deactivated',
        deactivation_reason = ?,
        deactivated_at = ?,
        deactivated_by = ?
    WHERE id = ?
  `, [reason, now, adminId, userId], function(err) {
    if (err) {
      console.error('❌ Error deactivating user:', err);
      return res.status(500).json({ error: 'Failed to deactivate user' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get admin and user names for audit log
    db.get(`SELECT name FROM users WHERE id = ?`, [adminId], (err, admin) => {
      db.get(`SELECT name FROM users WHERE id = ?`, [userId], (err, user) => {
        if (!err && admin && user) {
          // Create audit log for user deactivation
          createAuditLog({
            actorRole: 'admin',
            actorId: adminId,
            actorName: admin.name,
            action: 'DEACTIVATE_USER',
            entityType: 'USER',
            entityId: userId,
            details: {
              targetUserName: user.name,
              reason
            },
            ipAddress: req.ip || req.connection.remoteAddress
          });
        }
      });
    });

    // Create notification for the deactivated user
    createNotification(
      userId,
      'ACCOUNT_DEACTIVATED',
      'Account Deactivated',
      `Your account has been deactivated by the admin. Reason: ${reason}. You can submit an appeal if you believe this was a mistake.`,
      { reason, deactivatedAt: now }
    );

    console.log(`✅ User ${userId} deactivated successfully`);
    res.json({ 
      success: true, 
      message: 'User account deactivated',
      userId,
      deactivatedAt: now * 1000
    });
  });
});

/**
 * POST /api/admin/users/:userId/activate
 * Admin: Activate a user account
 */
app.post('/api/admin/users/:userId/activate', (req, res) => {
  const { userId } = req.params;

  console.log(`✅ Activating user ${userId}`);

  db.run(`
    UPDATE users 
    SET account_status = 'active',
        deactivation_reason = NULL,
        deactivated_at = NULL,
        deactivated_by = NULL
    WHERE id = ?
  `, [userId], function(err) {
    if (err) {
      console.error('❌ Error activating user:', err);
      return res.status(500).json({ error: 'Failed to activate user' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete any pending appeals for this user
    db.run(`
      UPDATE account_appeals 
      SET status = 'AUTO_RESOLVED'
      WHERE user_id = ? AND status = 'PENDING'
    `, [userId], (err) => {
      if (err) console.error('Error updating appeals:', err);
    });

    // Get admin and user names for audit log (admin ID from req.body)
    const adminId = req.body.adminId;
    if (adminId) {
      db.get(`SELECT name FROM users WHERE id = ?`, [adminId], (err, admin) => {
        db.get(`SELECT name FROM users WHERE id = ?`, [userId], (err, user) => {
          if (!err && admin && user) {
            // Create audit log for user activation
            createAuditLog({
              actorRole: 'admin',
              actorId: adminId,
              actorName: admin.name,
              action: 'ACTIVATE_USER',
              entityType: 'USER',
              entityId: userId,
              details: {
                targetUserName: user.name
              },
              ipAddress: req.ip || req.connection.remoteAddress
            });
          }
        });
      });
    }

    // Create notification for the activated user
    createNotification(
      userId,
      'ACCOUNT_ACTIVATED',
      'Account Activated',
      `Your account has been activated by the admin. You can now use all system features.`,
      { activatedAt: Math.floor(Date.now() / 1000) }
    );

    console.log(`✅ User ${userId} activated successfully`);
    res.json({ 
      success: true, 
      message: 'User account activated',
      userId
    });
  });
});

/**
 * POST /api/send-verification
 * Send verification code to email (for email update or password change)
 */
app.post('/api/send-verification', async (req, res) => {
  const { email, purpose } = req.body; // purpose: 'email_update' or 'password_change'

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store the code in memory (or use database for production)
    if (!global.verificationCodes) {
      global.verificationCodes = {};
    }
    
    global.verificationCodes[email] = {
      code: verificationCode,
      expiresAt,
      purpose,
    };

    // Send email using the existing transporter
    const subject = purpose === 'email_update' ? 'Email Update Verification Code' : 'Password Change Verification Code';
    const message = `Your verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.`;

await sendEmail(email, subject, `<p>${message}</p>`);
    console.log(`✅ Verification code sent to ${email} for ${purpose}`);
    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('❌ Error sending verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * PUT /api/admin/update-email
 * Admin: Update their email address
 */
app.put('/api/admin/update-email', (req, res) => {
  const { userId, newEmail } = req.body;

  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'userId and newEmail are required' });
  }

  // Check if email is already in use
  db.get(`SELECT id FROM users WHERE email = ? AND id != ?`, [newEmail, userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update email
    db.run(`
      UPDATE users 
      SET email = ?
      WHERE id = ?
    `, [newEmail, userId], function(err) {
      if (err) {
        console.error('❌ Error updating email:', err);
        return res.status(500).json({ error: 'Failed to update email' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`✅ Email updated for user ${userId}`);
      res.json({ 
        success: true, 
        message: 'Email updated successfully',
        userId,
        newEmail
      });
    });
  });
});

/**
 * PUT /api/auth/change-password
 * User: Change their password with current password verification
 */
app.put('/api/auth/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  console.log(`🔒 Password change request for user ${userId}`);

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'userId, currentPassword, and newPassword are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // Verify current password
  db.get(`SELECT password FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare current password (in production, use bcrypt.compare)
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update to new password (in production, hash with bcrypt)
    db.run(`
      UPDATE users 
      SET password = ?
      WHERE id = ?
    `, [newPassword, userId], function(err) {
      if (err) {
        console.error('❌ Error updating password:', err);
        return res.status(500).json({ error: 'Failed to update password' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`✅ Password updated for user ${userId}`);
      res.json({ 
        success: true, 
        message: 'Password updated successfully',
        userId
      });
    });
  });
});

/**
 * POST /api/appeals/submit
 * User: Submit an appeal against account deactivation
 */
app.post('/api/appeals/submit', (req, res) => {
  const { userId, appealMessage } = req.body;

  console.log(`📝 Appeal submitted by user ${userId}`);

  if (!userId || !appealMessage) {
    return res.status(400).json({ error: 'userId and appealMessage are required' });
  }

  // Check if user is actually deactivated
  db.get(`SELECT account_status FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.account_status !== 'deactivated') {
      return res.status(400).json({ error: 'Account is not deactivated' });
    }

    // Check if there's already a pending appeal
    db.get(`
      SELECT id FROM account_appeals 
      WHERE user_id = ? AND status = 'PENDING'
    `, [userId], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(400).json({ error: 'You already have a pending appeal' });
      }

      // Create new appeal
      const appealId = `appeal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = Math.floor(Date.now() / 1000);

      db.run(`
        INSERT INTO account_appeals (id, user_id, appeal_message, status, created_at)
        VALUES (?, ?, ?, 'PENDING', ?)
      `, [appealId, userId, appealMessage, now], function(err) {
        if (err) {
          console.error('❌ Error creating appeal:', err);
          return res.status(500).json({ error: 'Failed to submit appeal' });
        }

        console.log(`✅ Appeal ${appealId} submitted successfully`);
        res.json({ 
          success: true, 
          message: 'Appeal submitted successfully',
          appealId
        });
      });
    });
  });
});

/**
 * GET /api/admin/appeals
 * Admin: Get all pending appeals
 */
app.get('/api/admin/appeals', (req, res) => {
  db.all(`
    SELECT 
      aa.*,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role,
      u.deactivation_reason,
      u.deactivated_at
    FROM account_appeals aa
    JOIN users u ON aa.user_id = u.id
    WHERE aa.status = 'PENDING'
    ORDER BY aa.created_at DESC
  `, [], (err, appeals) => {
    if (err) {
      console.error('❌ Error fetching appeals:', err);
      return res.status(500).json({ error: 'Failed to fetch appeals' });
    }

    console.log(`✅ Fetched ${appeals?.length || 0} pending appeals`);
    res.json({ 
      success: true, 
      appeals: appeals || []
    });
  });
});

/**
 * POST /api/admin/appeals/:appealId/respond
 * Admin: Accept or reject an appeal
 */
app.post('/api/admin/appeals/:appealId/respond', (req, res) => {
  const { appealId } = req.params;
  const { decision, adminResponse, adminId } = req.body;

  console.log(`📋 Admin ${adminId} responding to appeal ${appealId}: ${decision}`);

  if (!decision || !adminId || !adminResponse) {
    return res.status(400).json({ error: 'decision, adminResponse, and adminId are required' });
  }

  if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
    return res.status(400).json({ error: 'decision must be ACCEPTED or REJECTED' });
  }

  const now = Math.floor(Date.now() / 1000);

  // Get appeal details first
  db.get(`SELECT user_id FROM account_appeals WHERE id = ?`, [appealId], (err, appeal) => {
    if (err || !appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }

    // Update appeal status
    db.run(`
      UPDATE account_appeals 
      SET status = ?,
          admin_response = ?,
          reviewed_by = ?,
          reviewed_at = ?
      WHERE id = ?
    `, [decision, adminResponse, adminId, now, appealId], function(err) {
      if (err) {
        console.error('❌ Error updating appeal:', err);
        return res.status(500).json({ error: 'Failed to update appeal' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Appeal not found' });
      }

      // If accepted, activate the user account and send notification
      if (decision === 'ACCEPTED') {
        db.run(`
          UPDATE users 
          SET account_status = 'active',
              deactivation_reason = NULL,
              deactivated_at = NULL,
              deactivated_by = NULL
          WHERE id = ?
        `, [appeal.user_id], (err) => {
          if (err) {
            console.error('❌ Error activating user:', err);
          } else {
            console.log(`✅ User ${appeal.user_id} activated via appeal acceptance`);
          }
        });

        // Create notification for appeal acceptance
        createNotification(
          appeal.user_id,
          'APPEAL_ACCEPTED',
          'Appeal Accepted',
          `Your account reactivation appeal has been accepted. Admin response: ${adminResponse}`,
          { appealId, adminResponse, decision }
        );
      } else {
        // Create notification for appeal rejection
        createNotification(
          appeal.user_id,
          'APPEAL_REJECTED',
          'Appeal Rejected',
          `Your account reactivation appeal has been rejected. Admin response: ${adminResponse}`,
          { appealId, adminResponse, decision }
        );
      }

      console.log(`✅ Appeal ${appealId} ${decision.toLowerCase()}`);
      res.json({ 
        success: true, 
        message: `Appeal ${decision.toLowerCase()} successfully`,
        decision
      });
    });
  });
});

/**
 * GET /api/user/:userId/appeal-status
 * Get user's appeal status
 */
app.get('/api/user/:userId/appeal-status', (req, res) => {
  const { userId } = req.params;

  db.get(`
    SELECT * FROM account_appeals 
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId], (err, appeal) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ 
      success: true, 
      appeal: appeal || null 
    });
  });
});

/**
 * GET /api/user/:userId/has-active-request
 * Check if user has an active request/donation
 */
app.get('/api/user/:userId/has-active-request', (req, res) => {
  const { userId } = req.params;
  const { role } = req.query;

  console.log(`🔍 Checking active requests for user ${userId} (${role})`);

  if (role === 'donor') {
    // Check if donor has any accepted donations that are not completed/cancelled
    db.get(`
      SELECT COUNT(*) as count
      FROM accepted_donors
      WHERE donor_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED')
    `, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const hasActive = result.count > 0;
      console.log(`✅ Donor ${userId} has active requests: ${hasActive}`);
      res.json({ 
        success: true, 
        hasActiveRequest: hasActive,
        count: result.count
      });
    });
  } else {
    // Check if recipient has any pending/accepted requests that are not completed/cancelled
    db.get(`
      SELECT COUNT(*) as count
      FROM blood_requests
      WHERE recipient_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED')
    `, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const hasActive = result.count > 0;
      console.log(`✅ Recipient ${userId} has active requests: ${hasActive}`);
      res.json({ 
        success: true, 
        hasActiveRequest: hasActive,
        count: result.count
      });
    });
  }
});

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

/**
 * Helper function to create notification
 */
function createNotification(userId, type, title, message, data = null) {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const dataJson = data ? JSON.stringify(data) : null;

  db.run(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [notifId, userId, type, title, message, dataJson], (err) => {
    if (err) {
      console.error('❌ Error creating notification:', err);
    } else {
      console.log(`🔔 Notification created for user ${userId}: ${title}`);
    }
  });
}

/**
 * POST /api/notifications
 * Create a new notification (for testing or manual triggers)
 */
app.post('/api/notifications', (req, res) => {
  const { userId, type, title, message, data } = req.body;

  if (!userId || !type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  createNotification(userId, type, title, message, data);
  res.json({ success: true, message: 'Notification created' });
});

/**
 * GET /api/notifications/:userId
 * Get all notifications for a user
 */
app.get('/api/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  const { unreadOnly } = req.query;

  let query = `SELECT * FROM notifications WHERE user_id = ?`;
  const params = [userId];

  if (unreadOnly === 'true') {
    query += ` AND is_read = 0`;
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;

  db.all(query, params, (err, notifications) => {
    if (err) {
      console.error('❌ Error fetching notifications:', err);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    console.log(`✅ Fetched ${notifications.length} notifications for user ${userId}`);
    res.json({ 
      success: true, 
      notifications 
    });
  });
});

/**
 * GET /api/notifications/:userId/unread-count
 * Get count of unread notifications for a user
 */
app.get('/api/notifications/:userId/unread-count', (req, res) => {
  const { userId } = req.params;

  db.get(`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `, [userId], (err, result) => {
    if (err) {
      console.error('❌ Error counting notifications:', err);
      return res.status(500).json({ error: 'Failed to count notifications' });
    }

    res.json({ 
      success: true, 
      count: result.count 
    });
  });
});

/**
 * PUT /api/notifications/:notificationId/read
 * Mark notification as read
 */
app.put('/api/notifications/:notificationId/read', (req, res) => {
  const { notificationId } = req.params;

  db.run(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE id = ?
  `, [notificationId], function(err) {
    if (err) {
      console.error('❌ Error marking notification as read:', err);
      return res.status(500).json({ error: 'Failed to update notification' });
    }

    console.log(`✅ Notification ${notificationId} marked as read`);
    res.json({ success: true });
  });
});

/**
 * PUT /api/notifications/:userId/mark-all-read
 * Mark all notifications as read for a user
 */
app.put('/api/notifications/:userId/mark-all-read', (req, res) => {
  const { userId } = req.params;

  db.run(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE user_id = ? AND is_read = 0
  `, [userId], function(err) {
    if (err) {
      console.error('❌ Error marking all notifications as read:', err);
      return res.status(500).json({ error: 'Failed to update notifications' });
    }

    console.log(`✅ Marked ${this.changes} notifications as read for user ${userId}`);
    res.json({ 
      success: true, 
      updated: this.changes 
    });
  });
});

/**
 * DELETE /api/notifications/:notificationId
 * Delete a notification
 */
app.delete('/api/notifications/:notificationId', (req, res) => {
  const { notificationId } = req.params;

  db.run(`
    DELETE FROM notifications WHERE id = ?
  `, [notificationId], function(err) {
    if (err) {
      console.error('❌ Error deleting notification:', err);
      return res.status(500).json({ error: 'Failed to delete notification' });
    }

    console.log(`✅ Notification ${notificationId} deleted`);
    res.json({ success: true });
  });
});

/**
 * GET /api/admin/user/:userId/details
 * Admin: Get detailed user information including status
 */
app.get('/api/admin/user/:userId/details', (req, res) => {
  const { userId } = req.params;

  db.get(`
    SELECT 
      u.*,
      dp.blood_group as donor_blood_group,
      dp.city as donor_city,
      dp.mobile as donor_mobile,
      dp.address as donor_address,
      dp.age as donor_age,
      dp.weight as donor_weight,
      dp.approval_status as donor_approval_status,
      rp.city as recipient_city,
      rp.mobile as recipient_mobile,
      rp.address as recipient_address,
      rp.cnic as recipient_cnic,
      rp.approval_status as recipient_approval_status
    FROM users u
    LEFT JOIN donor_profiles dp ON u.id = dp.user_id
    LEFT JOIN recipient_profiles rp ON u.id = rp.user_id
    WHERE u.id = ?
  `, [userId], (err, user) => {
    if (err) {
      console.error('❌ Error fetching user details:', err);
      return res.status(500).json({ error: 'Failed to fetch user details' });
    }

    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Fetched details for user ${userId}:`, {
      name: user.name,
      role: user.role,
      account_status: user.account_status
    });
    
    res.json({ 
      success: true, 
      user 
    });
  });
});

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

/**
 * Audit Log System
 * 
 * These endpoints manage the audit trail for the system.
 * Audit logs provide accountability, traceability, and security monitoring.
 * They help administrators:
 * - Track who did what and when
 * - Investigate security incidents
 * - Demonstrate compliance with regulations
 * - Monitor system usage patterns
 */

/**
 * POST /api/audit-logs
 * Create a new audit log entry
 * 
 * Body:
 * {
 *   actorRole: 'admin' | 'donor' | 'user',
 *   actorId: string,
 *   actorName: string,
 *   action: string,
 *   entityType?: string,
 *   entityId?: string,
 *   details?: object,
 *   ipAddress?: string
 * }
 */
app.post('/api/audit-logs', (req, res) => {
  const { actorRole, actorId, actorName, action, entityType, entityId, details, ipAddress } = req.body;

  // Validate required fields
  if (!actorRole || !actorId || !action) {
    return res.status(400).json({ 
      error: 'Missing required fields: actorRole, actorId, action' 
    });
  }

  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const detailsJson = details ? JSON.stringify(details) : null;

  db.run(`
    INSERT INTO audit_logs (
      id, timestamp, actor_role, actor_id, actor_name, 
      action, entity_type, entity_id, details, ip_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    logId, timestamp, actorRole, actorId, actorName,
    action, entityType, entityId, detailsJson, ipAddress
  ], (err) => {
    if (err) {
      console.error('❌ Error creating audit log:', err);
      return res.status(500).json({ error: 'Failed to create audit log' });
    }

    console.log(`✅ Audit log created: ${action} by ${actorRole} ${actorName} (${actorId})`);
    res.json({ 
      success: true, 
      logId,
      message: 'Audit log created successfully' 
    });
  });
});

/**
 * GET /api/admin/audit-logs
 * Admin: Fetch audit logs with optional filtering
 * 
 * Query params:
 * - limit: number (default 100, max 1000)
 * - offset: number (default 0)
 * - action: filter by action type
 * - actorRole: filter by actor role
 * - startDate: filter by start timestamp
 * - endDate: filter by end timestamp
 */
app.get('/api/admin/audit-logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const offset = parseInt(req.query.offset) || 0;
  const { action, actorRole, startDate, endDate } = req.query;

  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];

  // Apply filters
  if (action) {
    query += ` AND action = ?`;
    params.push(action);
  }

  if (actorRole) {
    query += ` AND actor_role = ?`;
    params.push(actorRole);
  }

  if (startDate) {
    query += ` AND timestamp >= ?`;
    params.push(parseInt(startDate));
  }

  if (endDate) {
    query += ` AND timestamp <= ?`;
    params.push(parseInt(endDate));
  }

  // Order by timestamp descending (newest first)
  query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.all(query, params, (err, logs) => {
    if (err) {
      console.error('❌ Error fetching audit logs:', err);
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
    const countParams = [];

    if (action) {
      countQuery += ` AND action = ?`;
      countParams.push(action);
    }

    if (actorRole) {
      countQuery += ` AND actor_role = ?`;
      countParams.push(actorRole);
    }

    if (startDate) {
      countQuery += ` AND timestamp >= ?`;
      countParams.push(parseInt(startDate));
    }

    if (endDate) {
      countQuery += ` AND timestamp <= ?`;
      countParams.push(parseInt(endDate));
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('❌ Error counting audit logs:', err);
        return res.status(500).json({ error: 'Failed to count audit logs' });
      }

      console.log(`✅ Fetched ${logs.length} audit logs (total: ${countResult.total})`);
      res.json({ 
        success: true, 
        logs,
        pagination: {
          total: countResult.total,
          limit,
          offset,
          hasMore: offset + limit < countResult.total
        }
      });
    });
  });
});

/**
 * GET /api/admin/audit-logs/actions
 * Admin: Get list of all unique actions for filtering
 */
app.get('/api/admin/audit-logs/actions', (req, res) => {
  db.all(`
    SELECT DISTINCT action 
    FROM audit_logs 
    ORDER BY action ASC
  `, [], (err, actions) => {
    if (err) {
      console.error('❌ Error fetching audit log actions:', err);
      return res.status(500).json({ error: 'Failed to fetch actions' });
    }

    console.log(`✅ Fetched ${actions.length} unique audit log actions`);
    res.json({ 
      success: true, 
      actions: actions.map(a => a.action)
    });
  });
});

/**
 * GET /api/donor/:donorId/details
 * Donor: Get donor details including blood group, last donation, and eligibility
 */
app.get('/api/donor/:donorId/details', (req, res) => {
  const { donorId } = req.params;

  // Get donor profile
  db.get(`
    SELECT blood_group, last_donated 
    FROM donor_profiles 
    WHERE user_id = ?
  `, [donorId], (err, profile) => {
    if (err) {
      console.error('❌ Error fetching donor profile:', err);
      return res.status(500).json({ error: 'Failed to fetch donor profile' });
    }

    if (!profile) {
      return res.json({
        success: true,
        bloodGroup: null,
        lastDonation: null,
        nextEligible: null,
        daysUntilEligible: null,
        isEligible: false
      });
    }

    // Calculate eligibility (3 months = 90 days after last donation)
    let lastDonation = null;
    let nextEligible = null;
    let daysUntilEligible = null;
    let isEligible = false;

    if (profile.last_donated) {
      try {
        // Parse the date - it can be either ISO string or Unix timestamp
        let lastDonationDate;
        
        if (typeof profile.last_donated === 'string') {
          // It's an ISO date string
          lastDonationDate = new Date(profile.last_donated);
        } else if (typeof profile.last_donated === 'number') {
          // It's a Unix timestamp (seconds)
          lastDonationDate = new Date(profile.last_donated * 1000);
        } else {
          throw new Error('Invalid date format');
        }

        // Validate the date is valid
        if (isNaN(lastDonationDate.getTime())) {
          throw new Error('Invalid date value');
        }

        // Validate date is reasonable (not in future, not before 2000)
        const minDate = new Date('2000-01-01');
        const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Allow 1 day in future
        
        if (lastDonationDate < minDate || lastDonationDate > maxDate) {
          throw new Error('Date out of valid range');
        }

        // Calculate next eligible date (90 days after last donation)
        const nextEligibleDate = new Date(lastDonationDate);
        nextEligibleDate.setDate(nextEligibleDate.getDate() + 90);

        // Format dates for display
        lastDonation = lastDonationDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        nextEligible = nextEligibleDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        // Calculate days until eligible
        const now = new Date();
        const diffTime = nextEligibleDate - now;
        daysUntilEligible = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isEligible = daysUntilEligible <= 0;
        
        console.log(`✅ Eligibility calculated - Last: ${lastDonation}, Next: ${nextEligible}, Days: ${daysUntilEligible}, Eligible: ${isEligible}`);
      } catch (error) {
        // Invalid date, treat as no previous donation
        console.warn(`⚠️ Error parsing last_donated for donor ${donorId}:`, error.message);
        isEligible = true;
        daysUntilEligible = 0;
      }
    } else {
      // No previous donation, eligible to donate
      console.log(`ℹ️ No last_donated for donor ${donorId}, marking as eligible`);
      isEligible = true;
      daysUntilEligible = 0;
    }

    console.log(`✅ Fetched donor details for ${donorId}`);
    res.json({
      success: true,
      bloodGroup: profile.blood_group,
      lastDonation,
      nextEligible,
      daysUntilEligible,
      isEligible
    });
  });
});

/**
 * GET /api/donor/:donorId/recent-donations
 * Donor: Get recent completed donations
 */
app.get('/api/donor/:donorId/recent-donations', (req, res) => {
  const { donorId } = req.params;
  const limit = parseInt(req.query.limit) || 5;

  db.all(`
    SELECT 
      br.blood_group,
      br.location,
      br.updated_at as completed_at,
      br.units,
      br.id as request_id
    FROM accepted_donors ad
    JOIN blood_requests br ON ad.request_id = br.id
    WHERE ad.donor_id = ? AND br.status = 'COMPLETED'
    ORDER BY br.updated_at DESC
    LIMIT ?
  `, [donorId, limit], (err, donations) => {
    if (err) {
      console.error('❌ Error fetching recent donations:', err);
      return res.status(500).json({ error: 'Failed to fetch donations' });
    }

    const formattedDonations = donations.map(d => ({
      date: new Date(d.completed_at * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      location: d.location,
      units: d.units || 1,
      bloodGroup: d.blood_group
    }));

    console.log(`✅ Fetched ${formattedDonations.length} recent donations for donor ${donorId}`);
    res.json({
      success: true,
      donations: formattedDonations
    });
  });
});

/**
 * GET /api/admin/recent-activities
 * Admin: Get recent system activities for dashboard
 * Returns combined data from audit logs and blood requests
 */
app.get('/api/admin/recent-activities', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  // Get recent audit logs and blood requests
  const activitiesQuery = `
    SELECT 
      'AUDIT' as type,
      action,
      actor_name,
      actor_role,
      timestamp,
      details
    FROM audit_logs
    WHERE timestamp >= strftime('%s', 'now', '-7 days')
    
    UNION ALL
    
    SELECT 
      'REQUEST' as type,
      'NEW_REQUEST' as action,
      '' as actor_name,
      'recipient' as actor_role,
      created_at as timestamp,
      json_object('blood_group', blood_group, 'urgency', urgency_level, 'status', status) as details
    FROM blood_requests
    WHERE created_at >= strftime('%s', 'now', '-7 days')
    
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  db.all(activitiesQuery, [limit], (err, activities) => {
    if (err) {
      console.error('❌ Error fetching recent activities:', err);
      return res.status(500).json({ error: 'Failed to fetch recent activities' });
    }

    // Format activities for display
    const formattedActivities = activities.map(activity => {
      let title = '';
      let color = '#2196F3';
      
      if (activity.type === 'AUDIT') {
        switch (activity.action) {
          case 'LOGIN':
            title = `${activity.actor_name} logged in`;
            color = '#4CAF50';
            break;
          case 'LOGOUT':
            title = `${activity.actor_name} logged out`;
            color = '#999';
            break;
          case 'CREATE_REQUEST':
            title = `New blood request created`;
            color = '#DC143C';
            break;
          case 'ACCEPT_REQUEST':
            title = `Blood request accepted by donor`;
            color = '#FF9800';
            break;
          case 'COMPLETE_REQUEST':
            title = `Blood donation completed`;
            color = '#4CAF50';
            break;
          case 'ACTIVATE_USER':
            title = `User account activated`;
            color = '#4CAF50';
            break;
          case 'DEACTIVATE_USER':
            title = `User account deactivated`;
            color = '#F44336';
            break;
          case 'APPROVE_PROFILE':
            title = `Profile approved`;
            color = '#4CAF50';
            break;
          case 'REJECT_PROFILE':
            title = `Profile rejected`;
            color = '#F44336';
            break;
          default:
            title = activity.action.replace(/_/g, ' ').toLowerCase();
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
      } else if (activity.type === 'REQUEST') {
        try {
          const details = JSON.parse(activity.details);
          title = `New ${details.blood_group} blood request (${details.urgency || 'normal'} priority)`;
          color = '#DC143C';
        } catch (e) {
          title = 'New blood request';
          color = '#DC143C';
        }
      }

      // Calculate time ago
      const now = Math.floor(Date.now() / 1000);
      const diff = now - activity.timestamp;
      let timeAgo = '';
      
      if (diff < 60) {
        timeAgo = 'Just now';
      } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diff / 86400);
        timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
      }

      return {
        title,
        timeAgo,
        color,
        timestamp: activity.timestamp
      };
    });

    console.log(`✅ Fetched ${formattedActivities.length} recent activities`);
    res.json({ 
      success: true, 
      activities: formattedActivities
    });
  });
});

// Global error handler — catches body-parser (e.g. payload too large) and other middleware errors
// so they return a clean JSON response instead of crashing with a raw stack trace
app.use((err, req, res, next) => {
  if (err) {
    console.error('❌ [Global Error Handler]', err.message);
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({ error: 'Upload too large. Please use a smaller image.' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid request format.' });
    }
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
  next();
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Email service running on port ${PORT}`);
  console.log(`📧 Ready to send verification emails`);
  console.log(`💾 Using SQLite database: ${dbPath}`);
  console.log(`🌐 Accessible at: http://localhost:${PORT}`);
  
  // Show network IP address
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`🌍 Network access: http://${iface.address}:${PORT}`);
      }
    });
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  });
});


