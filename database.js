const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'hostel.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.init();
  }

  init() {
    // Create tables
    this.db.serialize(() => {
      // Hostels table
      this.db.run(`CREATE TABLE IF NOT EXISTS hostels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        planType TEXT DEFAULT 'free_trial',
        planStatus TEXT DEFAULT 'trial',
        trialExpiryDate TEXT,
        adminName TEXT,
        adminEmail TEXT,
        adminPhone TEXT,
        status TEXT DEFAULT 'active',
        totalRooms INTEGER DEFAULT 0,
        occupiedRooms INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      // Users table
      this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        role TEXT,
        password TEXT,
        hostelId TEXT,
        hostelName TEXT,
        status TEXT DEFAULT 'active',
        createdAt TEXT,
        updatedAt TEXT
      )`);

      // Hostel requests table
      this.db.run(`CREATE TABLE IF NOT EXISTS hostelRequests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        hostelName TEXT,
        address TEXT,
        planType TEXT DEFAULT 'free_trial',
        message TEXT,
        status TEXT DEFAULT 'pending',
        isRead INTEGER DEFAULT 0,
        submittedAt TEXT,
        processedAt TEXT,
        notes TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      // Other tables
      this.db.run(`CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        gender TEXT,
        room TEXT,
        rent REAL,
        deposit REAL,
        status TEXT DEFAULT 'active',
        joiningDate TEXT,
        aadharNumber TEXT,
        aadharFront TEXT,
        aadharBack TEXT,
        pendingDues REAL DEFAULT 0,
        hostelId TEXT,
        lastModifiedBy TEXT,
        lastModifiedDate TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        roomNumber TEXT,
        type TEXT,
        capacity INTEGER,
        rent REAL,
        occupancy INTEGER DEFAULT 0,
        status TEXT DEFAULT 'available',
        floor INTEGER,
        amenities TEXT,
        lastModifiedBy TEXT,
        lastModifiedDate TEXT,
        hostelId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tenantId TEXT,
        amount REAL,
        month INTEGER,
        year INTEGER,
        status TEXT DEFAULT 'pending',
        paymentDate TEXT,
        paymentMethod TEXT,
        transactionId TEXT,
        hostelId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        tenantId TEXT,
        room TEXT,
        hostelId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT,
        amount REAL,
        category TEXT,
        date TEXT,
        description TEXT,
        addedBy TEXT,
        hostelId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        phone TEXT,
        email TEXT,
        salary REAL,
        joiningDate TEXT,
        shift TEXT,
        status TEXT DEFAULT 'active',
        emergencyContact TEXT,
        address TEXT,
        hostelId TEXT,
        lastModifiedBy TEXT,
        lastModifiedDate TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        hostelId TEXT,
        createdBy TEXT,
        status TEXT DEFAULT 'active',
        createdAt TEXT,
        updatedAt TEXT
      )`);
      
      // Run schema updates after table creation
      this.updateSchema();
    });
  }

  updateSchema() {
    // Add missing columns to existing tables
    const alterQueries = [
      // Tenants table - all possible fields
      'ALTER TABLE tenants ADD COLUMN gender TEXT',
      'ALTER TABLE tenants ADD COLUMN room TEXT',
      'ALTER TABLE tenants ADD COLUMN roomId TEXT',
      'ALTER TABLE tenants ADD COLUMN roomType TEXT',
      'ALTER TABLE tenants ADD COLUMN rent REAL',
      'ALTER TABLE tenants ADD COLUMN deposit REAL',
      'ALTER TABLE tenants ADD COLUMN joiningDate TEXT',
      'ALTER TABLE tenants ADD COLUMN aadharNumber TEXT',
      'ALTER TABLE tenants ADD COLUMN aadharFront TEXT',
      'ALTER TABLE tenants ADD COLUMN aadharBack TEXT',
      'ALTER TABLE tenants ADD COLUMN pendingDues REAL DEFAULT 0',
      'ALTER TABLE tenants ADD COLUMN lastModifiedBy TEXT',
      'ALTER TABLE tenants ADD COLUMN lastModifiedDate TEXT',
      
      // Payments table
      'ALTER TABLE payments ADD COLUMN paymentDate TEXT',
      'ALTER TABLE payments ADD COLUMN paymentMethod TEXT',
      'ALTER TABLE payments ADD COLUMN transactionId TEXT',
      'ALTER TABLE payments ADD COLUMN type TEXT',
      'ALTER TABLE payments ADD COLUMN notes TEXT',
      'ALTER TABLE payments ADD COLUMN tenantName TEXT',
      'ALTER TABLE payments ADD COLUMN lastModifiedBy TEXT',
      'ALTER TABLE payments ADD COLUMN lastModifiedDate TEXT',
      
      // Complaints table
      'ALTER TABLE complaints ADD COLUMN room TEXT',
      'ALTER TABLE complaints ADD COLUMN tenantName TEXT',
      'ALTER TABLE complaints ADD COLUMN tenantPhone TEXT',
      'ALTER TABLE complaints ADD COLUMN hostel TEXT',
      'ALTER TABLE complaints ADD COLUMN assignedTo TEXT',
      'ALTER TABLE complaints ADD COLUMN adminNotes TEXT',
      'ALTER TABLE complaints ADD COLUMN resolvedAt TEXT',
      'ALTER TABLE complaints ADD COLUMN resolvedBy TEXT',
      'ALTER TABLE complaints ADD COLUMN images TEXT',
      'ALTER TABLE complaints ADD COLUMN urgency TEXT',
      'ALTER TABLE complaints ADD COLUMN resolutionNotes TEXT',
      'ALTER TABLE complaints ADD COLUMN lastModifiedBy TEXT',
      'ALTER TABLE complaints ADD COLUMN lastModifiedDate TEXT',
      'ALTER TABLE complaints ADD COLUMN photos TEXT',
      'ALTER TABLE complaints ADD COLUMN attachments TEXT',
      'ALTER TABLE complaints ADD COLUMN submittedBy TEXT',
      'ALTER TABLE complaints ADD COLUMN estimatedCost REAL',
      'ALTER TABLE complaints ADD COLUMN actualCost REAL',
      'ALTER TABLE complaints ADD COLUMN isOverdue INTEGER DEFAULT 0',
      
      // Expenses table
      'ALTER TABLE expenses ADD COLUMN description TEXT',
      'ALTER TABLE expenses ADD COLUMN addedBy TEXT',
      
      // Staff table
      'ALTER TABLE staff ADD COLUMN email TEXT',
      'ALTER TABLE staff ADD COLUMN joiningDate TEXT',
      'ALTER TABLE staff ADD COLUMN shift TEXT',
      'ALTER TABLE staff ADD COLUMN emergencyContact TEXT',
      'ALTER TABLE staff ADD COLUMN address TEXT',
      'ALTER TABLE staff ADD COLUMN lastModifiedBy TEXT',
      'ALTER TABLE staff ADD COLUMN lastModifiedDate TEXT',
      
      // Hostels table
      'ALTER TABLE hostels ADD COLUMN features TEXT',
      
      // Users table - account locking fields
      'ALTER TABLE users ADD COLUMN failedLoginAttempts INTEGER DEFAULT 0',
      'ALTER TABLE users ADD COLUMN isLocked INTEGER DEFAULT 0',
      'ALTER TABLE users ADD COLUMN lockedAt TEXT',
      'ALTER TABLE users ADD COLUMN lockedBy TEXT'
    ];
    
    alterQueries.forEach(query => {
      this.db.run(query, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log('Schema update note:', err.message);
        }
      });
    });
  }

  // Generic CRUD operations
  getAll(table) {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) reject(err);
        else {
          // Parse JSON strings back to arrays
          const processedRows = (rows || []).map(row => {
            const processedRow = { ...row };
            Object.keys(processedRow).forEach(key => {
              if (typeof processedRow[key] === 'string' && processedRow[key].startsWith('[')) {
                try {
                  processedRow[key] = JSON.parse(processedRow[key]);
                } catch {}
              }
            });
            return processedRow;
          });
          resolve(processedRows);
        }
      });
    });
  }

  create(table, data) {
    return new Promise(async (resolve, reject) => {
      const now = new Date().toISOString();
      
      // Clean data - remove unwanted fields and handle special cases
      const cleanData = { ...data };
      delete cleanData._id; // Remove MongoDB-style _id
      
      // Handle arrays (convert to JSON string for SQLite)
      Object.keys(cleanData).forEach(key => {
        if (Array.isArray(cleanData[key])) {
          cleanData[key] = JSON.stringify(cleanData[key]);
        }
      });
      
      const item = { 
        id: cleanData.id || Date.now().toString(),
        ...cleanData, 
        createdAt: cleanData.createdAt || now, 
        updatedAt: cleanData.updatedAt || now 
      };
      
      // Check for unique constraints
      try {
        const uniqueFields = this.getUniqueFields(table);
        for (const field of uniqueFields) {
          if (item[field]) {
            const existing = await this.findByField(table, field, item[field]);
            if (existing) {
              reject(new Error(`${field} '${item[field]}' already exists`));
              return;
            }
          }
        }
      } catch (uniqueError) {
        reject(uniqueError);
        return;
      }
      
      console.log(`Creating ${table} with data:`, item);
      
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map(() => '?').join(',');
      
      const query = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
      console.log('SQL Query:', query);
      console.log('Values:', values);
      
      this.db.run(query, values, function(err) {
        if (err) {
          console.error(`SQLite error creating ${table}:`, err);
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Record with this information already exists'));
          } else {
            reject(err);
          }
        } else {
          console.log(`Successfully created ${table} with id:`, item.id);
          // Parse arrays back for response
          const responseItem = { ...item };
          Object.keys(responseItem).forEach(key => {
            if (typeof responseItem[key] === 'string' && responseItem[key].startsWith('[')) {
              try {
                responseItem[key] = JSON.parse(responseItem[key]);
              } catch {}
            }
          });
          resolve(responseItem);
        }
      });
    });
  }

  update(table, id, data) {
    return new Promise((resolve, reject) => {
      const updates = { ...data, updatedAt: new Date().toISOString() };
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map(key => `${key} = ?`).join(',');
      
      this.db.run(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        [...values, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...updates });
        }
      );
    });
  }

  delete(table, id) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }

  deleteAll(table) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM ${table}`, function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes });
      });
    });
  }

  findById(table, id) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  findByField(table, field, value) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM ${table} WHERE ${field} = ?`, [value], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getUniqueFields(table) {
    const uniqueConstraints = {
      users: ['email'],
      tenants: ['email', 'phone'],
      rooms: ['roomNumber'],
      staff: ['phone'],
      hostelRequests: ['email']
    };
    return uniqueConstraints[table] || [];
  }
}

module.exports = new Database();