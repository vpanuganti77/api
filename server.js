const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const webpush = require('web-push');

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@hostelpro.com',
  'BFgRKVi9ta3rYS9-EgATV6OsyqoTclh9e9LDfeZARRk4w7yj1GGeWqmWaMj2oLbPYpBN8eTBc9m2_Oo1pkmXZZA',
  'GWzRHPXFADsT0MZkFqGYwK4BEUZwoXW7F4FwK3Px9Iw'
);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Store connected users and push subscriptions
const connectedUsers = new Map();
const pushSubscriptions = new Map(); // userId -> subscription

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'join') {
        connectedUsers.set(ws, data.data);
        console.log('User joined:', data.data);
        console.log('Total connected users:', connectedUsers.size);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    connectedUsers.delete(ws);
    console.log('User disconnected. Total connected users:', connectedUsers.size);
  });
});

// Helper function to send notifications
const sendNotification = async (notification, targetRole, hostelId = null) => {
  console.log(`Sending notification to role: ${targetRole}, hostelId: ${hostelId}`);
  console.log('Notification:', notification);
  
  let sentCount = 0;
  let pushCount = 0;
  
  // Send WebSocket notifications to connected users
  connectedUsers.forEach((userData, ws) => {
    if (ws.readyState === WebSocket.OPEN && userData.role === targetRole && 
        (hostelId === null || userData.hostelId === hostelId || userData.hostelId === String(hostelId))) {
      ws.send(JSON.stringify({ type: 'notification', payload: notification }));
      sentCount++;
      console.log(`WebSocket notification sent to: ${userData.name}`);
    }
  });
  
  // Send push notifications to subscribed users
  for (const [userId, subData] of pushSubscriptions.entries()) {
    if (subData.userRole === targetRole && 
        (hostelId === null || subData.hostelId === hostelId || subData.hostelId === String(hostelId))) {
      try {
        await webpush.sendNotification(
          subData.subscription,
          JSON.stringify({
            title: notification.title,
            body: notification.message,
            data: notification
          })
        );
        pushCount++;
        console.log(`Push notification sent to user: ${userId}`);
      } catch (error) {
        console.error(`Failed to send push to user ${userId}:`, error);
        // Remove invalid subscription
        if (error.statusCode === 410) {
          pushSubscriptions.delete(userId);
        }
      }
    }
  }
  
  console.log(`Total WebSocket notifications: ${sentCount}, Push notifications: ${pushCount}`);
};

// Configure CORS
app.use(cors({
  origin: [
    'https://pgflow.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
      return res.status(404).json({ message: 'User account not found. Please check your email or contact administrator.' });
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
    
    // Check if account is inactive or deleted
    if (user.status === 'inactive') {
      return res.status(401).json({ message: 'Account is deactivated. Please contact your administrator.' });
    }
    
    if (user.status === 'deleted') {
      return res.status(404).json({ message: 'User account has been deleted. Please contact administrator.' });
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
    
    // For tenant users, also get tenant data to ensure hostelId and room are available
    if (user.role === 'tenant') {
      const tenant = data.tenants.find(t => t.email === user.email || t.name === user.name);
      if (tenant) {
        if (tenant.hostelId && !user.hostelId) {
          const hostel = data.hostels.find(h => h.id === tenant.hostelId);
          if (hostel) {
            hostelInfo = {
              hostelId: hostel.id,
              hostelName: hostel.name,
              hostelAddress: hostel.address
            };
          }
        }
        // Add room information from tenant data
        if (tenant.room) {
          hostelInfo = {
            ...hostelInfo,
            room: tenant.room
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

// Push subscription endpoint
app.post('/api/push-subscription', async (req, res) => {
  try {
    const { subscription, userId, userRole, hostelId } = req.body;
    
    // Store subscription
    pushSubscriptions.set(userId, {
      subscription,
      userRole,
      hostelId,
      createdAt: new Date().toISOString()
    });
    
    console.log(`Push subscription stored for user: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate current password endpoint
app.post('/api/auth/validate-password', async (req, res) => {
  try {
    const { userId, currentPassword } = req.body;
    const data = await readData();
    
    const user = data.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.password !== currentPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    res.json({ message: 'Password validated' });
  } catch (error) {
    console.error('Password validation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password endpoint
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const data = await readData();
    
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    data.users[userIndex].password = newPassword;
    data.users[userIndex].firstLogin = false;
    data.users[userIndex].updatedAt = new Date().toISOString();
    
    await writeData(data);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test notification endpoint
app.post('/api/test-notification', async (req, res) => {
  try {
    const { targetRole, hostelId, message } = req.body;
    
    sendNotification({
      type: 'test',
      title: 'Test Notification',
      message: message || 'This is a test notification',
      priority: 'medium',
      createdAt: new Date().toISOString()
    }, targetRole, hostelId);
    
    res.json({ message: 'Test notification sent', connectedUsers: connectedUsers.size });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add comment to complaint endpoint
app.post('/api/complaints/:id/comments', async (req, res) => {
  try {
    const { comment, author, role } = req.body;
    
    if (!comment || !author || !role) {
      return res.status(400).json({ error: 'Comment, author, and role are required' });
    }
    
    const data = await readData();
    const complaintIndex = data.complaints.findIndex(c => c.id === req.params.id);
    
    if (complaintIndex === -1) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    const complaint = data.complaints[complaintIndex];
    
    // Initialize comments array if it doesn't exist
    if (!complaint.comments) {
      complaint.comments = [];
    }
    
    // Add new comment
    const newComment = {
      id: Date.now().toString(),
      comment,
      author,
      role,
      createdAt: new Date().toISOString()
    };
    
    complaint.comments.push(newComment);
    complaint.updatedAt = new Date().toISOString();
    
    await writeData(data);
    
    // Send notification to the other party
    const targetRole = role === 'tenant' ? 'admin' : 'tenant';
    const targetHostelId = role === 'tenant' ? complaint.hostelId : null;
    
    if (role === 'admin') {
      // Admin commented, notify the specific tenant
      const tenant = data.tenants.find(t => t.name === complaint.tenantName && t.hostelId === complaint.hostelId);
      if (tenant) {
        const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant' && u.hostelId === complaint.hostelId);
        if (tenantUser) {
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.role === 'tenant' && 
                userData.hostelId === complaint.hostelId &&
                userData.name === tenantUser.name) {
              ws.send(JSON.stringify({ 
                type: 'notification', 
                payload: {
                  type: 'complaint_comment',
                  title: 'New Comment on Your Complaint',
                  message: `Admin added a comment to your complaint "${complaint.title}"`,
                  priority: 'medium',
                  createdAt: newComment.createdAt,
                  complaintId: complaint.id,
                  url: `/tenant/complaints?complaintId=${complaint.id}&openComments=true`
                }
              }));
            }
          });
        }
      }
    } else {
      // Tenant commented, notify admin
      sendNotification({
        type: 'complaint_comment',
        title: 'New Comment on Complaint',
        message: `${author} added a comment to complaint "${complaint.title}"`,
        priority: 'medium',
        createdAt: newComment.createdAt,
        complaintId: complaint.id,
        url: `/admin/complaints?complaintId=${complaint.id}&openComments=true`
      }, 'admin', complaint.hostelId);
    }
    
    res.json({ comment: newComment, complaint });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Approve hostel request endpoint
app.post('/api/hostelRequests/:id/approve', async (req, res) => {
  try {
    const data = await readData();
    const index = data.hostelRequests.findIndex(item => item.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Hostel request not found' });
    }
    
    const originalItem = data.hostelRequests[index];
    const updatedItem = { 
      ...originalItem, 
      status: 'approved',
      updatedAt: new Date().toISOString()
    };
    
    // Create hostel entry
    const newHostel = {
      id: Date.now().toString(),
      name: updatedItem.hostelName,
      address: updatedItem.address,
      phone: updatedItem.phone,
      email: updatedItem.email,
      status: 'active',
      planType: updatedItem.planType || 'free_trial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.hostels.push(newHostel);
    
    // Create admin user for the hostel
    const hostelDomain = updatedItem.hostelName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    const username = updatedItem.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const password = 'admin' + Math.random().toString(36).substring(2, 8);
    
    const adminUser = {
      id: (Date.now() + 1).toString(),
      name: updatedItem.name,
      email: `${username}@${hostelDomain}`,
      phone: updatedItem.phone,
      role: 'admin',
      password: password,
      hostelId: newHostel.id,
      hostelName: newHostel.name,
      status: 'active',
      firstLogin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.users.push(adminUser);
    
    // Add login credentials to the hostel request
    updatedItem.userCredentials = {
      email: adminUser.email,
      password: password,
      loginUrl: `https://pgflow.netlify.app/login?email=${encodeURIComponent(adminUser.email)}&password=${encodeURIComponent(password)}`
    };
    updatedItem.hostelId = newHostel.id;
    
    data.hostelRequests[index] = updatedItem;
    await writeData(data);
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Approve hostel request error:', error);
    res.status(500).json({ error: 'Failed to approve hostel request' });
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
          
          // Generate login credentials for user
          if (!newItem.password) {
            newItem.password = newItem.role + Math.random().toString(36).substring(2, 8);
          }
          newItem.userCredentials = {
            email: newItem.email,
            password: newItem.password,
            loginUrl: `https://pgflow.netlify.app/login?email=${encodeURIComponent(newItem.email)}&password=${encodeURIComponent(newItem.password)}`
          };
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
            firstLogin: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          console.log('Creating tenant user with hostelId:', tenantUser.hostelId);
          data.users.push(tenantUser);
          newItem.userCredentials = {
            email: tenantUser.email,
            password: password,
            loginUrl: `https://pgflow.netlify.app/login?email=${encodeURIComponent(tenantUser.email)}&password=${encodeURIComponent(password)}`
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
      
      // Initialize comments array for complaints
      if (entity === 'complaints') {
        newItem.comments = [];
        
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
          createdAt: newItem.createdAt,
          requestId: newItem.id
        }, 'master_admin', null);
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
      
      // Enhanced complaint status validation
      if (entity === 'complaints') {
        // Prevent deletion of complaints
        if (req.method === 'DELETE') {
          return res.status(400).json({ 
            error: 'Complaints cannot be deleted once raised' 
          });
        }
        
        // Prevent reverting from in-progress to open
        if (originalItem.status === 'in-progress' && updatedItem.status === 'open') {
          return res.status(400).json({ 
            error: 'Cannot revert complaint status from in-progress back to open' 
          });
        }
        
        // Prevent reverting from resolved to open (except through reopen)
        if (originalItem.status === 'resolved' && updatedItem.status === 'open') {
          return res.status(400).json({ 
            error: 'Cannot revert complaint status from resolved back to open. Use reopen instead.' 
          });
        }
        
        // Prevent reverting from reopen to open
        if (originalItem.status === 'reopen' && updatedItem.status === 'open') {
          return res.status(400).json({ 
            error: 'Cannot revert complaint status from reopen back to open' 
          });
        }
        
        // Allow reopen status for resolved complaints
        if (originalItem.status === 'resolved' && updatedItem.status === 'reopen') {
          // This is valid - tenant reopening a resolved complaint
        }
      }
      
      // Handle hostel request approval
      if (entity === 'hostelRequests' && originalItem.status !== 'approved' && updatedItem.status === 'approved') {
        // Create hostel entry
        const newHostel = {
          id: Date.now().toString(),
          name: updatedItem.hostelName,
          address: updatedItem.address,
          phone: updatedItem.phone,
          email: updatedItem.email,
          status: 'active',
          planType: updatedItem.planType || 'free_trial',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.hostels.push(newHostel);
        
        // Create admin user for the hostel
        const hostelDomain = updatedItem.hostelName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
        const username = updatedItem.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const password = 'admin' + Math.random().toString(36).substring(2, 8);
        
        const adminUser = {
          id: (Date.now() + 1).toString(),
          name: updatedItem.name,
          email: `${username}@${hostelDomain}`,
          phone: updatedItem.phone,
          role: 'admin',
          password: password,
          hostelId: newHostel.id,
          hostelName: newHostel.name,
          status: 'active',
          firstLogin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.users.push(adminUser);
        
        // Add login credentials to the hostel request
        updatedItem.userCredentials = {
          email: adminUser.email,
          password: password,
          loginUrl: `https://pgflow.netlify.app/login?email=${encodeURIComponent(adminUser.email)}&password=${encodeURIComponent(password)}`
        };
        updatedItem.hostelId = newHostel.id;
      }
      
      // Add automatic comment when admin marks complaint as resolved (before saving)
      if (entity === 'complaints' && originalItem.status !== updatedItem.status) {
        if (updatedItem.status === 'resolved' && !updatedItem.reopenedBy) {
          if (!updatedItem.comments) {
            updatedItem.comments = [];
          }
          
          const resolvedComment = {
            id: Date.now().toString(),
            comment: 'Complaint has been marked as resolved by admin.',
            author: 'Admin',
            role: 'admin',
            createdAt: new Date().toISOString()
          };
          
          updatedItem.comments.push(resolvedComment);
        }
      }
      
      data[entity][index] = updatedItem;
      
      // Wait for write to complete
      await writeData(data);
      
      // Send real-time notifications for complaint updates
      if (entity === 'complaints' && originalItem.status !== updatedItem.status) {
        
        // Find the tenant who created this complaint
        const tenant = data.tenants.find(t => t.name === updatedItem.tenantName && t.hostelId === updatedItem.hostelId);
        if (tenant) {
          // Find the tenant's user account
          const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant' && u.hostelId === updatedItem.hostelId);
          if (tenantUser) {
            // Send notification to specific tenant user
            connectedUsers.forEach((userData, ws) => {
              if (ws.readyState === WebSocket.OPEN && 
                  userData.role === 'tenant' && 
                  userData.hostelId === updatedItem.hostelId &&
                  userData.name === tenantUser.name) {
                ws.send(JSON.stringify({ 
                  type: 'notification', 
                  payload: {
                    type: 'complaint_update',
                    title: 'Complaint Status Updated',
                    message: `Your complaint "${updatedItem.title}" status has been updated to ${updatedItem.status.replace('-', ' ')}`,
                    priority: 'medium',
                    createdAt: updatedItem.updatedAt,
                    complaintId: updatedItem.id
                  }
                }));
                console.log(`Complaint update notification sent to: ${userData.name}`);
              }
            });
          }
        }
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
      
      // Prevent deletion of complaints (except for master admin cleanup)
      if (entity === 'complaints' && req.query.masterAdminCleanup !== 'true') {
        return res.status(400).json({ 
          error: 'Complaints cannot be deleted once raised' 
        });
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