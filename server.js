const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Store connected users
const connectedUsers = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'join') {
        connectedUsers.set(ws, data.data);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    connectedUsers.delete(ws);
  });
});

// Helper function to send notifications
const sendNotification = (notification, targetRole, hostelId = null) => {
  connectedUsers.forEach((userData, ws) => {
    if (ws.readyState === WebSocket.OPEN && userData.role === targetRole && 
        (hostelId === null || userData.hostelId === hostelId || userData.hostelId === String(hostelId))) {
      ws.send(JSON.stringify({ type: 'notification', payload: notification }));
    }
  });
};

app.use(cors());
app.use(express.json());

// Initialize data file
const initializeData = async () => {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialData = {
      hostels: [],
      tenants: [],
      rooms: [],
      payments: [],
      complaints: [],
      users: [],
      expenses: [],
      staff: [],
      hostelRequests: [],
      notices: []
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
};

// Robust read operations with corruption handling
const readData = async () => {
  try {
    let rawData = await fs.readFile(DATA_FILE, 'utf8');
    
    // Fix common corruption patterns
    if (rawData.includes('}   "')) {
      console.warn('Fixing corrupted JSON...');
      const firstCloseBrace = rawData.indexOf('}');
      rawData = rawData.substring(0, firstCloseBrace + 1);
    }
    
    // Remove any trailing garbage
    rawData = rawData.trim();
    if (!rawData.endsWith('}')) {
      const lastBrace = rawData.lastIndexOf('}');
      if (lastBrace > 0) {
        rawData = rawData.substring(0, lastBrace + 1);
      }
    }
    
    const parsed = JSON.parse(rawData);
    
    // Ensure all required arrays exist
    const requiredKeys = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests', 'notices'];
    let needsUpdate = false;
    
    for (const key of requiredKeys) {
      if (!Array.isArray(parsed[key])) {
        parsed[key] = [];
        needsUpdate = true;
      }
    }
    
    // Write back if we fixed anything
    if (needsUpdate) {
      await fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    }
    
    return parsed;
  } catch (error) {
    console.error('Read error, creating fresh file:', error);
    
    // Create fresh file with default structure
    const defaultData = {
      hostels: [],
      tenants: [],
      rooms: [],
      payments: [],
      complaints: [],
      users: [],
      expenses: [],
      staff: [],
      hostelRequests: [],
      notices: []
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
};

// Robust file operations with proper locking
let isWriting = false;
const writeQueue = [];

const writeData = async (data) => {
  return new Promise((resolve, reject) => {
    writeQueue.push({ data, resolve, reject });
    processQueue();
  });
};

const processQueue = async () => {
  if (isWriting || writeQueue.length === 0) return;
  
  isWriting = true;
  const { data, resolve, reject } = writeQueue.shift();
  
  try {
    // Validate data structure first
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data structure');
    }
    
    const jsonString = JSON.stringify(data, null, 2);
    
    // Double-check JSON is valid
    JSON.parse(jsonString);
    
    // Write directly without temp files to avoid rename issues
    await fs.writeFile(DATA_FILE, jsonString, { encoding: 'utf8', flag: 'w' });
    
    resolve();
  } catch (error) {
    console.error('Write operation failed:', error);
    reject(error);
  } finally {
    isWriting = false;
    // Process next item
    setTimeout(processQueue, 10);
  }
};

// Login endpoint with account locking and hostel validation
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await readData();
    
    const user = data.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // For non-master admin users, validate hostel domain
    if (user.role !== 'master_admin') {
      const hostel = data.hostels.find(h => h.id === user.hostelId);
      if (!hostel) {
        return res.status(401).json({ message: 'Hostel not found. Please contact administrator.' });
      }
      
      // Check if email matches hostel domain
      const expectedDomain = hostel.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      const emailDomain = email.split('@')[1];
      if (emailDomain !== expectedDomain) {
        return res.status(401).json({ message: 'Invalid email domain for this hostel.' });
      }
    }
    
    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        message: 'Account is locked due to multiple failed login attempts. Please contact your administrator to unlock your account.',
        isLocked: true
      });
    }
    
    // Check if account is inactive
    if (user.status === 'inactive') {
      return res.status(401).json({ message: 'Account is deactivated. Please contact your administrator.' });
    }
    
    // Check password
    if (user.password !== password) {
      // Increment failed attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      // Lock account after 3 failed attempts
      if (user.failedLoginAttempts >= 3) {
        user.isLocked = true;
        user.lockedAt = new Date().toISOString();
        await writeData(data);
        
        return res.status(423).json({ 
          message: 'Account has been locked due to multiple failed login attempts. Please contact your administrator to unlock your account.',
          isLocked: true
        });
      }
      
      await writeData(data);
      return res.status(401).json({ 
        message: `Invalid credentials. ${3 - user.failedLoginAttempts} attempts remaining before account lock.`,
        attemptsRemaining: 3 - user.failedLoginAttempts
      });
    }
    
    // Successful login - reset failed attempts
    user.failedLoginAttempts = 0;
    await writeData(data);
    
    // Return user data (excluding password) with hostel info
    const { password: _, ...userWithoutPassword } = user;
    let hostelInfo = null;
    
    if (user.hostelId) {
      const hostel = data.hostels.find(h => h.id === user.hostelId);
      if (hostel) {
        hostelInfo = {
          hostelId: hostel.id,
          hostelName: hostel.name,
          hostelAddress: hostel.address
        };
      }
    }
    
    // For tenant users, also get tenant data to ensure hostelId is available
    if (user.role === 'tenant') {
      const tenant = data.tenants.find(t => t.email === user.email || t.name === user.name);
      if (tenant && tenant.hostelId && !user.hostelId) {
        const hostel = data.hostels.find(h => h.id === tenant.hostelId);
        if (hostel) {
          hostelInfo = {
            hostelId: hostel.id,
            hostelName: hostel.name,
            hostelAddress: hostel.address
          };
        }
      }
    }
    
    res.json({
      message: 'Login successful',
      user: { ...userWithoutPassword, ...hostelInfo }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generic routes for all entities
const entities = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests', 'notices'];

entities.forEach(entity => {
  // GET all
  app.get(`/api/${entity}`, async (req, res) => {
    try {
      const data = await readData();
      res.json(data[entity] || []);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

    // POST create
  app.post(`/api/${entity}`, async (req, res) => {
    try {
      console.log(`Creating ${entity} with data:`, req.body);
      const data = await readData();
      
      // Ensure entity array exists
      if (!Array.isArray(data[entity])) {
        data[entity] = [];
      }
      
      const newItem = { 
        ...req.body, 
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log(`New ${entity} item:`, newItem);
      
      // Auto-generate hostel-scoped email for users
      if (entity === 'users' && newItem.role !== 'master_admin') {
        const hostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (hostel) {
          const hostelDomain = hostel.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
          const username = newItem.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          newItem.email = `${username}@${hostelDomain}`;
        }
      }
      
      // Auto-create user account for tenants
      if (entity === 'tenants') {
        const hostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (hostel) {
          const hostelDomain = hostel.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
          const username = newItem.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const password = 'tenant' + Math.random().toString(36).substring(2, 8);
          
          const tenantUser = {
            id: (Date.now() + 1).toString(),
            name: newItem.name,
            email: `${username}@${hostelDomain}`,
            phone: newItem.phone,
            role: 'tenant',
            password: password,
            hostelId: newItem.hostelId,
            hostelName: hostel.name,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          console.log('Creating tenant user with hostelId:', tenantUser.hostelId);
          data.users.push(tenantUser);
          newItem.userCredentials = {
            email: tenantUser.email,
            password: password,
            loginUrl: `${req.protocol}://${req.get('host')}/auth/login?email=${encodeURIComponent(tenantUser.email)}&password=${encodeURIComponent(password)}`
          };
        }
      }
      
      // Check unique constraints within hostel scope
      const uniqueFields = {
        tenants: ['email', 'phone', 'aadharNumber'],
        rooms: ['roomNumber'],
        users: ['email'], // Global for users
        staff: ['phone', 'email'],
        hostels: ['name'] // Global for hostels
      };
      
      const fieldsToCheck = uniqueFields[entity] || [];
      for (const field of fieldsToCheck) {
        if (newItem[field]) {
          const existing = data[entity].find(item => {
            // For global entities (users, hostels), check globally
            if (['users', 'hostels'].includes(entity)) {
              return item[field]?.toLowerCase() === newItem[field]?.toLowerCase();
            }
            // For hostel-scoped entities, check within same hostel
            return item[field]?.toLowerCase() === newItem[field]?.toLowerCase() && 
                   item.hostelId === newItem.hostelId;
          });
          
          if (existing) {
            const scope = ['users', 'hostels'].includes(entity) ? '' : ' in this hostel';
            return res.status(400).json({ 
              error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists${scope}` 
            });
          }
        }
      }
      
      data[entity].push(newItem);
      
      // Wait for write to complete
      await writeData(data);
      
      // Send real-time notifications
      if (entity === 'complaints') {
        sendNotification({
          type: 'complaint',
          title: 'New Complaint',
          message: `${newItem.title} - ${newItem.tenantName}`,
          priority: newItem.priority || 'medium',
          createdAt: newItem.createdAt,
          complaintId: newItem.id
        }, 'admin', newItem.hostelId);
      } else if (entity === 'hostelRequests') {
        sendNotification({
          type: 'hostelRequest',
          title: 'New Hostel Request',
          message: `${newItem.hostelName} - ${newItem.name}`,
          priority: 'medium',
          createdAt: newItem.createdAt
        }, 'master_admin');
      }
      
      console.log(`Created ${entity}:`, newItem.id);
      res.json(newItem);
    } catch (error) {
      console.error(`Error creating ${entity}:`, error);
      res.status(500).json({ error: `Failed to create ${entity}: ${error.message}` });
    }
  });

  // PUT update
  app.put(`/api/${entity}/:id`, async (req, res) => {
    try {
      const data = await readData();
      
      // Ensure entity array exists
      if (!Array.isArray(data[entity])) {
        data[entity] = [];
      }
      
      const index = data[entity].findIndex(item => item.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: `${entity} not found` });
      }
      
      const originalItem = data[entity][index];
      const updatedItem = { 
        ...originalItem, 
        ...req.body, 
        id: req.params.id,
        updatedAt: new Date().toISOString()
      };
      
      // Check unique constraints within hostel scope (excluding current item)
      const uniqueFields = {
        tenants: ['email', 'phone', 'aadharNumber'],
        rooms: ['roomNumber'],
        users: ['email'], // Global for users
        staff: ['phone', 'email'],
        hostels: ['name'] // Global for hostels
      };
      
      const fieldsToCheck = uniqueFields[entity] || [];
      for (const field of fieldsToCheck) {
        if (updatedItem[field]) {
          const existing = data[entity].find(item => {
            // Skip current item
            if (item.id === req.params.id) return false;
            
            // For global entities (users, hostels), check globally
            if (['users', 'hostels'].includes(entity)) {
              return item[field]?.toLowerCase() === updatedItem[field]?.toLowerCase();
            }
            // For hostel-scoped entities, check within same hostel
            return item[field]?.toLowerCase() === updatedItem[field]?.toLowerCase() && 
                   item.hostelId === updatedItem.hostelId;
          });
          
          if (existing) {
            const scope = ['users', 'hostels'].includes(entity) ? '' : ' in this hostel';
            return res.status(400).json({ 
              error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists${scope}` 
            });
          }
        }
      }
      
      data[entity][index] = updatedItem;
      
      // Wait for write to complete
      await writeData(data);
      
      // Send real-time notifications for complaint updates
      if (entity === 'complaints' && originalItem.status !== updatedItem.status) {
        sendNotification({
          type: 'complaint_update',
          title: 'Complaint Status Updated',
          message: `Your complaint "${updatedItem.title}" status has been updated to ${updatedItem.status.replace('-', ' ')}`,
          priority: 'medium',
          createdAt: updatedItem.updatedAt,
          complaintId: updatedItem.id
        }, 'tenant', updatedItem.hostelId);
      }
      
      console.log(`Updated ${entity}:`, req.params.id);
      res.json(updatedItem);
    } catch (error) {
      console.error(`Error updating ${entity}:`, error);
      res.status(500).json({ error: `Failed to update ${entity}: ${error.message}` });
    }
  });

  // DELETE
  app.delete(`/api/${entity}/:id`, async (req, res) => {
    try {
      const data = await readData();
      
      // Ensure entity array exists
      if (!Array.isArray(data[entity])) {
        data[entity] = [];
      }
      
      const index = data[entity].findIndex(item => item.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Item not found' });
      
      // Check for room deletion with associated tenants
      if (entity === 'rooms') {
        const room = data[entity][index];
        const associatedTenants = data.tenants.filter(tenant => 
          tenant.room === room.roomNumber || tenant.roomId === room.id
        );
        
        if (associatedTenants.length > 0) {
          return res.status(400).json({ 
            error: `Cannot delete room ${room.roomNumber}. ${associatedTenants.length} tenant(s) are currently assigned to this room.` 
          });
        }
      }
      
      data[entity].splice(index, 1);
      await writeData(data);
      res.json({ message: 'Item deleted' });
    } catch (error) {
      console.error(`Error deleting ${entity}:`, error);
      res.status(500).json({ error: error.message });
    }
  });
});

initializeData().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
});

module.exports = app;