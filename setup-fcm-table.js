const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create FCM tokens table
const dbPath = path.join(__dirname, 'hostel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      token TEXT NOT NULL,
      hostelId TEXT NOT NULL,
      userType TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating fcm_tokens table:', err);
    } else {
      console.log('✅ FCM tokens table created successfully');
    }
  });
});

db.close();