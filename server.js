const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const webpush = require('web-push');
const multer = require('multer');

// Configure multer for file uploadss
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/complaints/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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
    console.log(`Checking user: ${userData.name}, role: ${userData.role}, hostelId: ${userData.hostelId}`);
    console.log(`Target role: ${targetRole}, target hostelId: ${hostelId}`);
    
    const roleMatches = userData.role === targetRole;
    const hostelMatches = hostelId === null || userData.hostelId === hostelId || userData.hostelId === String(hostelId);
    
    console.log(`Role matches: ${roleMatches}, Hostel matches: ${hostelMatches}`);
    
    if (ws.readyState === WebSocket.OPEN && roleMatches && hostelMatches) {
      ws.send(JSON.stringify({ type: 'notification', payload: notification }));
      sentCount++;
      console.log(`WebSocket notification sent to: ${userData.name}`);
    } else {
      console.log(`Skipping user ${userData.name}: role match=${roleMatches}, hostel match=${hostelMatches}`);
    }
  });
  
  // Send push notifications to subscribed users
  for (const [userId, subData] of pushSubscriptions.entries()) {
    const roleMatches = subData.userRole === targetRole;
    
    // Handle hostel matching logic
    let hostelMatches = false;
    if (hostelId === null) {
      // Global notifications (like master_admin notifications) - send to all users of that role
      hostelMatches = true;
    } else {
      // Hostel-specific notifications - match exact hostel
      hostelMatches = subData.hostelId === hostelId || subData.hostelId === String(hostelId);
    }
    
    if (roleMatches && hostelMatches) {
      try {
        console.log(`Sending push notification to user ${userId} with role ${subData.userRole}, hostelId: ${subData.hostelId}`);
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
    } else {
      console.log(`Skipping user ${userId}: role match=${roleMatches}, hostel match=${hostelMatches} (target: ${targetRole}, hostel: ${hostelId})`);
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
      notices: [],
      checkoutRequests: [],
      hostelSettings: [],
      supportTickets: []
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
    const requiredKeys = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests', 'notices', 'checkoutRequests', 'hostelSettings', 'supportTickets'];
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
      notices: [],
      checkoutRequests: [],
      hostelSettings: []
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
    
    // For non-master admin users, validate hostel domain (skip for pending approval)
    if (user.role !== 'master_admin' && user.status !== 'pending_approval') {
      const hostel = data.hostels.find(h => h.id === user.hostelId);
      if (!hostel) {
        return res.status(401).json({ message: 'Hostel not found. Please contact administrator.' });
      }
      
      // Check if email matches hostel domain using contactEmail or allowedDomains
      const emailDomain = email.split('@')[1];
      let isValidDomain = false;
      
      // Check against hostel's contactEmail domain
      if (hostel.contactEmail) {
        const hostelContactDomain = hostel.contactEmail.split('@')[1];
        if (emailDomain === hostelContactDomain) {
          isValidDomain = true;
        }
      }
      
      // Check against allowedDomains array
      if (!isValidDomain && hostel.allowedDomains && Array.isArray(hostel.allowedDomains)) {
        isValidDomain = hostel.allowedDomains.includes(emailDomain);
      }
      
      // Fallback to generated domain from hostel name
      if (!isValidDomain) {
        const cleanHostelName = (hostel.displayName || hostel.name).replace(/_\d+$/, '').replace(/[^a-zA-Z]/g, '');
        const expectedDomain = cleanHostelName.toLowerCase() + '.com';
        isValidDomain = emailDomain === expectedDomain;
      }
      
      if (!isValidDomain) {
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
          hostelName: hostel.displayName || hostel.name,
          hostelAddress: hostel.address
        };
      } else if (user.status === 'pending_approval' && user.hostelName) {
        // For pending approval users, use hostelName from user record
        hostelInfo = {
          hostelId: user.hostelId,
          hostelName: user.hostelName,
          hostelAddress: null
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
              hostelName: hostel.displayName || hostel.name,
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

// Notification tracking
const notificationLog = new Map(); // Track last notification times

// Payment reminder system
const checkPaymentReminders = async () => {
  try {
    const data = await readData();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (const tenant of data.tenants) {
      if (tenant.status !== 'active' || !tenant.nextDueDate) continue;
      
      const dueDate = new Date(tenant.nextDueDate);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // Check if payment was made this month
      const lastPayment = data.payments
        .filter(p => p.tenantId === tenant.id && p.type === 'rent')
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
      
      const hasPaymentThisMonth = lastPayment && 
        new Date(lastPayment.paymentDate).getMonth() === now.getMonth() &&
        new Date(lastPayment.paymentDate).getFullYear() === now.getFullYear();
      
      if (!hasPaymentThisMonth) {
        const notificationKey = `payment_${tenant.id}_${dueDateStr}`;
        const lastNotification = notificationLog.get(notificationKey);
        
        // Send reminder 1 day before due date (once per day)
        if (dueDateStr === tomorrowStr) {
          if (!lastNotification || (now.getTime() - lastNotification) >= 24 * 60 * 60 * 1000) {
            // Send payment reminder to tenant by email
            const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant');
            if (tenantUser) {
              const paymentNotification = {
                type: 'payment',
                title: 'Payment Reminder',
                message: `Your rent payment of ₹${tenant.rent} is due tomorrow (${dueDate.toLocaleDateString()}). Please make the payment to avoid late fees.`,
                priority: 'high',
                createdAt: now.toISOString(),
                tenantId: tenant.id
              };
              
              connectedUsers.forEach((userData, ws) => {
                if (ws.readyState === WebSocket.OPEN && userData.email === tenantUser.email) {
                  ws.send(JSON.stringify({ type: 'notification', payload: paymentNotification }));
                  console.log(`Payment reminder sent to: ${userData.name} (${userData.email})`);
                }
              });
            }
            notificationLog.set(notificationKey, now.getTime());
          }
        }
        
        // Send overdue notification after due date (every 12 hours)
        if (dueDate < now) {
          const overdueKey = `overdue_${tenant.id}_${dueDateStr}`;
          const lastOverdueNotification = notificationLog.get(overdueKey);
          
          if (!lastOverdueNotification || (now.getTime() - lastOverdueNotification) >= 12 * 60 * 60 * 1000) {
            const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            // Send overdue payment notification to tenant by email
            const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant');
            if (tenantUser) {
              const overdueNotification = {
                type: 'payment',
                title: 'Payment Overdue',
                message: `Your rent payment of ₹${tenant.rent} is ${daysOverdue} day(s) overdue. Please make the payment immediately to avoid penalties.`,
                priority: 'high',
                createdAt: now.toISOString(),
                tenantId: tenant.id
              };
              
              connectedUsers.forEach((userData, ws) => {
                if (ws.readyState === WebSocket.OPEN && userData.email === tenantUser.email) {
                  ws.send(JSON.stringify({ type: 'notification', payload: overdueNotification }));
                  console.log(`Overdue payment notification sent to: ${userData.name} (${userData.email})`);
                }
              });
            }
            notificationLog.set(overdueKey, now.getTime());
          }
        }
      }
    }
  } catch (error) {
    console.error('Payment reminder check error:', error);
  }
};

// Complaint reminder system
const checkComplaintReminders = async () => {
  try {
    const data = await readData();
    const now = new Date();
    
    for (const complaint of data.complaints) {
      const complaintKey = `complaint_${complaint.id}`;
      
      // Only send reminders for open or reopened complaints
      if (complaint.status === 'open' || complaint.status === 'reopen') {
        const lastNotification = notificationLog.get(complaintKey);
        
        // Send reminder every 4 hours for open/reopened complaints
        if (!lastNotification || (now.getTime() - lastNotification) >= 4 * 60 * 60 * 1000) {
          const createdDate = new Date(complaint.createdAt);
          const hoursOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
          
          sendNotification({
            type: 'complaint',
            title: 'Pending Complaint Reminder',
            message: `Complaint "${complaint.title}" by ${complaint.tenantName} has been ${complaint.status} for ${hoursOpen} hours. Please review and take action.`,
            priority: 'medium',
            createdAt: now.toISOString(),
            complaintId: complaint.id
          }, 'admin', complaint.hostelId);
          
          sendNotification({
            type: 'complaint',
            title: 'Pending Complaint Reminder',
            message: `Complaint "${complaint.title}" by ${complaint.tenantName} has been ${complaint.status} for ${hoursOpen} hours. Please review and take action.`,
            priority: 'medium',
            createdAt: now.toISOString(),
            complaintId: complaint.id
          }, 'receptionist', complaint.hostelId);
          
          notificationLog.set(complaintKey, now.getTime());
        }
      } else if (complaint.status === 'in-progress' || complaint.status === 'resolved') {
        // Clear notification tracking when complaint is in-progress or resolved
        notificationLog.delete(complaintKey);
      }
    }
  } catch (error) {
    console.error('Complaint reminder check error:', error);
  }
};

// Run payment reminder check every hour
setInterval(checkPaymentReminders, 60 * 60 * 1000);

// Run complaint reminder check every hour
setInterval(checkComplaintReminders, 60 * 60 * 1000);

// Push notification endpoint
app.post('/api/push-notification', async (req, res) => {
  try {
    const { targetRole, targetEmail, title, message, type } = req.body;
    
    if (targetRole) {
      // Send to all users with specific role
      sendNotification({
        type: type || 'general',
        title,
        message,
        priority: 'high',
        createdAt: new Date().toISOString()
      }, targetRole, null);
      
      res.json({ message: `Notification sent to all ${targetRole} users` });
    } else if (targetEmail) {
      // Send to specific user by email
      const data = await readData();
      const user = data.users.find(u => u.email === targetEmail);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Send to specific user
      let sent = false;
      connectedUsers.forEach((userData, ws) => {
        if (ws.readyState === WebSocket.OPEN && userData.email === targetEmail) {
          ws.send(JSON.stringify({ 
            type: 'notification', 
            payload: {
              type: type || 'general',
              title,
              message,
              priority: 'high',
              createdAt: new Date().toISOString()
            }
          }));
          sent = true;
        }
      });
      
      // Send push notification if user has subscription
      for (const [userId, subData] of pushSubscriptions.entries()) {
        if (subData.userRole === user.role && subData.hostelId === user.hostelId) {
          try {
            await webpush.sendNotification(
              subData.subscription,
              JSON.stringify({ title, body: message, data: { type } })
            );
            sent = true;
          } catch (error) {
            console.error(`Failed to send push to user ${userId}:`, error);
          }
        }
      }
      
      res.json({ message: `Notification sent to ${targetEmail}`, delivered: sent });
    } else {
      res.status(400).json({ error: 'Either targetRole or targetEmail is required' });
    }
  } catch (error) {
    console.error('Push notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test notification endpoint
app.post('/api/test-notification', async (req, res) => {
  try {
    const { targetRole, hostelId, message } = req.body;
    
    console.log('Test notification request:', { targetRole, hostelId, message });
    console.log('Connected users:', connectedUsers.size);
    
    // List all connected users
    connectedUsers.forEach((userData, ws) => {
      console.log('Connected user:', userData);
    });
    
    const notification = {
      type: 'test',
      title: 'Test Notification',
      message: message || 'This is a test notification',
      priority: 'medium',
      createdAt: new Date().toISOString()
    };
    
    await sendNotification(notification, targetRole, hostelId);
    
    res.json({ 
      message: 'Test notification sent', 
      connectedUsers: connectedUsers.size,
      notification 
    });
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
      const commentHostel = data.hostels.find(h => h.id === complaint.hostelId);
      if (commentHostel && commentHostel.contactEmail) {
        const commentNotification = {
          type: 'complaint_comment',
          title: 'New Comment on Complaint',
          message: `${author} added a comment to complaint "${complaint.title}"`,
          priority: 'medium',
          createdAt: newComment.createdAt,
          complaintId: complaint.id,
          url: `/admin/complaints?complaintId=${complaint.id}&openComments=true`
        };
        
        connectedUsers.forEach((userData, ws) => {
          if (ws.readyState === WebSocket.OPEN && 
              userData.email === commentHostel.contactEmail && 
              (userData.role === 'admin' || userData.role === 'receptionist')) {
            ws.send(JSON.stringify({ type: 'notification', payload: commentNotification }));
            console.log(`Comment notification sent to: ${userData.name} (${userData.email})`);
          }
        });
      }
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
      displayName: updatedItem.hostelName,
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
    const cleanHostelName = updatedItem.hostelName.replace(/_\d+$/, '').replace(/[^a-zA-Z]/g, '');
    const hostelDomain = cleanHostelName.toLowerCase() + '.com';
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

// Serve uploaded files
app.get('/api/uploads/complaints/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', 'complaints', filename);
  res.sendFile(filePath);
});

// Special route for complaints with file uploads
app.post('/api/complaints', upload.array('attachments', 5), async (req, res) => {
  try {
    console.log('Creating complaint with data:', req.body);
    console.log('Files:', req.files);
    
    const data = await readData();
    
    if (!Array.isArray(data.complaints)) {
      data.complaints = [];
    }
    
    // Process uploaded files
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/api/uploads/complaints/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    const newItem = { 
      ...req.body, 
      id: Date.now().toString(),
      attachments: attachments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('New complaint item:', newItem);
    
    data.complaints.push(newItem);
    await writeData(data);
    
    // Initialize comments array
    newItem.comments = [];
    
    // Send complaint notification directly to hostel contact email
    const complaintHostel = data.hostels.find(h => h.id === newItem.hostelId);
    if (complaintHostel && complaintHostel.contactEmail) {
      const complaintNotification = {
        type: 'complaint',
        title: 'New Complaint',
        message: `${newItem.title} - ${newItem.tenantName}`,
        priority: newItem.priority || 'medium',
        createdAt: newItem.createdAt,
        complaintId: newItem.id
      };
      
      connectedUsers.forEach((userData, ws) => {
        if (ws.readyState === WebSocket.OPEN && 
            userData.email === complaintHostel.contactEmail && 
            (userData.role === 'admin' || userData.role === 'receptionist')) {
          ws.send(JSON.stringify({ type: 'notification', payload: complaintNotification }));
          console.log(`Complaint notification sent to: ${userData.name} (${userData.email})`);
        }
      });
    }
    
    console.log('Created complaint:', newItem.id);
    res.json(newItem);
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: `Failed to create complaint: ${error.message}` });
  }
});

// Generic routes for all entities (excluding complaints which has special handling above)
const entities = ['hostels', 'tenants', 'rooms', 'payments', 'users', 'expenses', 'staff', 'hostelRequests', 'notices', 'checkoutRequests', 'hostelSettings', 'notifications', 'supportTickets'];

// Add complaints GET, PUT, DELETE routes separately
app.get('/api/complaints', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.complaints || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/complaints/:id', async (req, res) => {
  try {
    const data = await readData();
    
    if (!Array.isArray(data.complaints)) {
      data.complaints = [];
    }
    
    const index = data.complaints.findIndex(item => item.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    const originalItem = data.complaints[index];
    const updatedItem = { 
      ...originalItem, 
      ...req.body, 
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };
    
    // Enhanced complaint status validation
    if (originalItem.status === 'in-progress' && updatedItem.status === 'open') {
      return res.status(400).json({ 
        error: 'Cannot revert complaint status from in-progress back to open' 
      });
    }
    
    if (originalItem.status === 'resolved' && updatedItem.status === 'open') {
      return res.status(400).json({ 
        error: 'Cannot revert complaint status from resolved back to open. Use reopen instead.' 
      });
    }
    
    if (originalItem.status === 'reopen' && updatedItem.status === 'open') {
      return res.status(400).json({ 
        error: 'Cannot revert complaint status from reopen back to open' 
      });
    }
    
    // Add automatic comment when admin marks complaint as resolved
    if (originalItem.status !== updatedItem.status && updatedItem.status === 'resolved' && !updatedItem.reopenedBy) {
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
    
    data.complaints[index] = updatedItem;
    await writeData(data);
    
    // Send notification for status updates
    if (originalItem.status !== updatedItem.status) {
      const tenant = data.tenants.find(t => t.name === updatedItem.tenantName && t.hostelId === updatedItem.hostelId);
      if (tenant) {
        const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant' && u.hostelId === updatedItem.hostelId);
        if (tenantUser) {
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
            }
          });
        }
      }
    }
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: `Failed to update complaint: ${error.message}` });
  }
});

app.delete('/api/complaints/:id', async (req, res) => {
  try {
    const data = await readData();
    
    if (!Array.isArray(data.complaints)) {
      data.complaints = [];
    }
    
    if (req.query.masterAdminCleanup !== 'true') {
      return res.status(400).json({ 
        error: 'Complaints cannot be deleted once raised' 
      });
    }
    
    const index = data.complaints.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Item not found' });
    
    data.complaints.splice(index, 1);
    await writeData(data);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

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
          const cleanHostelName = (hostel.displayName || hostel.name).replace(/_\d+$/, '').replace(/[^a-zA-Z]/g, '');
          const hostelDomain = cleanHostelName.toLowerCase() + '.com';
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
          // Clean hostel name - remove timestamp and special characters
          let cleanHostelName = (hostel.displayName || hostel.name).replace(/_\d+$/, '').replace(/[^a-zA-Z]/g, '');
          const hostelDomain = cleanHostelName.toLowerCase() + '.com';
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
            hostelName: hostel.displayName || hostel.name,
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
        
        // Calculate next due date based on joining date (monthly cycle)
        if (newItem.joiningDate) {
          const joiningDate = new Date(newItem.joiningDate);
          const today = new Date();
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          
          // Calculate next due date on the same day of month as joining date
          let nextDueDate = new Date(currentYear, currentMonth, joiningDate.getDate());
          
          // If this month's due date has passed, move to next month
          if (nextDueDate <= today) {
            nextDueDate = new Date(currentYear, currentMonth + 1, joiningDate.getDate());
          }
          
          newItem.nextDueDate = nextDueDate.toISOString().split('T')[0];
        }
        
        // Send notification to admin when new tenant is added
        const tenantHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (tenantHostel && tenantHostel.contactEmail) {
          const tenantNotification = {
            type: 'tenant',
            title: 'New Tenant Joined',
            message: `${newItem.name} has joined the hostel in room ${newItem.room}. Welcome the new tenant!`,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            tenantId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === tenantHostel.contactEmail && 
                (userData.role === 'admin' || userData.role === 'receptionist')) {
              ws.send(JSON.stringify({ type: 'notification', payload: tenantNotification }));
              console.log(`Tenant notification sent to: ${userData.name} (${userData.email})`);
            }
          });
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
      
      if (entity === 'hostelRequests') {
        // Notify master admin of new hostel requests
        const masterAdminNotification = {
          type: 'hostelRequest',
          title: 'New Hostel Request',
          message: `${newItem.hostelName} - ${newItem.name}`,
          priority: 'medium',
          createdAt: newItem.createdAt,
          requestId: newItem.id
        };
        
        connectedUsers.forEach((userData, ws) => {
          if (ws.readyState === WebSocket.OPEN && userData.role === 'master_admin') {
            ws.send(JSON.stringify({ type: 'notification', payload: masterAdminNotification }));
            console.log(`Hostel request notification sent to: ${userData.name}`);
          }
        });
      } else if (entity === 'supportTickets') {
        // Notify master admin of new support tickets
        const supportNotification = {
          type: 'support',
          title: 'New Support Ticket',
          message: `${newItem.subject} - ${newItem.submittedBy}`,
          priority: newItem.priority || 'medium',
          createdAt: newItem.createdAt,
          ticketId: newItem.id
        };
        
        connectedUsers.forEach((userData, ws) => {
          if (ws.readyState === WebSocket.OPEN && userData.role === 'master_admin') {
            ws.send(JSON.stringify({ type: 'notification', payload: supportNotification }));
            console.log(`Support ticket notification sent to: ${userData.name}`);
          }
        });
      } else if (entity === 'rooms') {
        // Notify hostel admin when new room is added
        const roomHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (roomHostel && roomHostel.contactEmail) {
          const roomNotification = {
            type: 'new_room',
            title: 'New Room Added',
            message: `Room ${newItem.roomNumber} has been added to the hostel.`,
            priority: 'low',
            createdAt: new Date().toISOString(),
            roomId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === roomHostel.contactEmail && 
                userData.role === 'admin') {
              ws.send(JSON.stringify({ type: 'notification', payload: roomNotification }));
              console.log(`Room notification sent to: ${userData.name}`);
            }
          });
        }
      } else if (entity === 'checkoutRequests') {
        // Send checkout request notification to admin
        const checkoutHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (checkoutHostel && checkoutHostel.contactEmail) {
          const checkoutNotification = {
            type: 'checkout',
            title: 'Checkout Request',
            message: `${newItem.tenantName} has requested to checkout from room ${newItem.roomNumber}. Please review the request.`,
            priority: 'high',
            createdAt: newItem.createdAt,
            checkoutId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === checkoutHostel.contactEmail && 
                (userData.role === 'admin' || userData.role === 'receptionist')) {
              ws.send(JSON.stringify({ type: 'notification', payload: checkoutNotification }));
              console.log(`Checkout notification sent to: ${userData.name} (${userData.email})`);
            }
          });
        }
      } else if (entity === 'notices') {
        // Notify all users in the hostel when new notice is posted
        const noticeHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (noticeHostel && noticeHostel.contactEmail) {
          const noticeNotification = {
            type: 'new_notice',
            title: 'New Notice Posted',
            message: `New notice: ${newItem.title}`,
            priority: newItem.priority || 'medium',
            createdAt: new Date().toISOString(),
            noticeId: newItem.id
          };
          
          // Notify all users in this hostel
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                (userData.hostelId === newItem.hostelId || userData.email === noticeHostel.contactEmail)) {
              ws.send(JSON.stringify({ type: 'notification', payload: noticeNotification }));
              console.log(`Notice notification sent to: ${userData.name}`);
            }
          });
        }
      } else if (entity === 'staff') {
        // Notify hostel admin when new staff is added
        const staffHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (staffHostel && staffHostel.contactEmail) {
          const staffNotification = {
            type: 'new_staff',
            title: 'New Staff Added',
            message: `${newItem.name} has been added as ${newItem.position || 'staff member'}.`,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            staffId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === staffHostel.contactEmail && 
                userData.role === 'admin') {
              ws.send(JSON.stringify({ type: 'notification', payload: staffNotification }));
              console.log(`Staff notification sent to: ${userData.name}`);
            }
          });
        }
      } else if (entity === 'expenses') {
        // Notify hostel admin when new expense is added
        const expenseHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (expenseHostel && expenseHostel.contactEmail) {
          const expenseNotification = {
            type: 'new_expense',
            title: 'New Expense Added',
            message: `New expense: ${newItem.description} - ₹${newItem.amount}`,
            priority: 'low',
            createdAt: new Date().toISOString(),
            expenseId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === expenseHostel.contactEmail && 
                userData.role === 'admin') {
              ws.send(JSON.stringify({ type: 'notification', payload: expenseNotification }));
              console.log(`Expense notification sent to: ${userData.name}`);
            }
          });
        }
      } else if (entity === 'payments') {
        // Notify hostel admin when payment is added
        const paymentHostel = data.hostels.find(h => h.id === newItem.hostelId);
        if (paymentHostel && paymentHostel.contactEmail) {
          const paymentNotification = {
            type: 'payment_added',
            title: 'New Payment Added',
            message: `Payment of ₹${newItem.amount} has been added for ${newItem.tenantName || 'tenant'}.`,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            paymentId: newItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === paymentHostel.contactEmail && 
                (userData.role === 'admin' || userData.role === 'receptionist')) {
              ws.send(JSON.stringify({ type: 'notification', payload: paymentNotification }));
              console.log(`Payment notification sent to: ${userData.name} (${userData.email})`);
            }
          });
        }
        
        // Update tenant's next due date when rent is paid
        if (newItem.type === 'rent') {
          const tenantIndex = data.tenants.findIndex(t => t.id === newItem.tenantId);
          if (tenantIndex !== -1) {
            const tenant = data.tenants[tenantIndex];
            const joiningDate = new Date(tenant.joiningDate);
            const paymentDate = new Date(newItem.paymentDate);
            
            // Calculate next due date on same day of next month as joining date
            let nextDueDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, joiningDate.getDate());
            
            tenant.nextDueDate = nextDueDate.toISOString().split('T')[0];
            tenant.lastPaymentDate = newItem.paymentDate;
            await writeData(data);
          }
        }
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
      console.log(`UPDATE REQUEST: ${entity}/${req.params.id}`);
      console.log('Request body:', req.body);
      
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
      console.log('Original item:', originalItem);
      
      const updatedItem = { 
        ...originalItem, 
        ...req.body, 
        id: req.params.id,
        updatedAt: new Date().toISOString()
      };
      
      console.log('Updated item:', updatedItem);
      
      // Send notifications for payment approval
      if (entity === 'payments' && originalItem.status !== updatedItem.status && updatedItem.status === 'approved') {
        console.log(`PAYMENT APPROVED: ${updatedItem.id}`);
        
        // Notify receptionist
        const paymentHostel = data.hostels.find(h => h.id === updatedItem.hostelId);
        if (paymentHostel && paymentHostel.contactEmail) {
          const approvalNotification = {
            type: 'payment_approved',
            title: 'Payment Approved',
            message: `Payment of ₹${updatedItem.amount} for ${updatedItem.tenantName || 'tenant'} has been approved.`,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            paymentId: updatedItem.id
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && 
                userData.email === paymentHostel.contactEmail && 
                userData.role === 'receptionist') {
              ws.send(JSON.stringify({ type: 'notification', payload: approvalNotification }));
              console.log(`Payment approval notification sent to receptionist: ${userData.name}`);
            }
          });
        }
        
        // Notify tenant
        const tenant = data.tenants.find(t => t.id === updatedItem.tenantId);
        if (tenant) {
          const tenantUser = data.users.find(u => u.name === tenant.name && u.role === 'tenant');
          if (tenantUser) {
            const tenantApprovalNotification = {
              type: 'payment_approved',
              title: 'Payment Approved',
              message: `Your payment of ₹${updatedItem.amount} has been approved. Thank you!`,
              priority: 'medium',
              createdAt: new Date().toISOString(),
              paymentId: updatedItem.id
            };
            
            connectedUsers.forEach((userData, ws) => {
              if (ws.readyState === WebSocket.OPEN && userData.email === tenantUser.email) {
                ws.send(JSON.stringify({ type: 'notification', payload: tenantApprovalNotification }));
                console.log(`Payment approval notification sent to tenant: ${userData.name}`);
              }
            });
          }
        }
      }
      
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
      
      // Send notifications for hostel status changes
      if (entity === 'hostels' && originalItem.status !== updatedItem.status) {
        console.log(`HOSTEL STATUS CHANGED: ${originalItem.status} -> ${updatedItem.status} for hostel ${updatedItem.id}`);
        
        const statusChangeNotification = {
          type: 'hostel_status_change',
          title: updatedItem.status === 'active' ? 'Hostel Activated' : 'Hostel Deactivated',
          message: `Your hostel "${updatedItem.displayName || updatedItem.name}" has been ${updatedItem.status === 'active' ? 'activated' : 'deactivated'} by Master Admin.`,
          priority: 'high',
          createdAt: new Date().toISOString(),
          hostelId: updatedItem.id
        };
        
        console.log('Sending notification to hostel contact:', updatedItem.contactEmail);
        
        // Send directly to hostel contact email instead of using hostelId matching
        connectedUsers.forEach((userData, ws) => {
          if (ws.readyState === WebSocket.OPEN && 
              userData.email === updatedItem.contactEmail && 
              (userData.role === 'admin' || userData.role === 'receptionist')) {
            ws.send(JSON.stringify({ type: 'notification', payload: statusChangeNotification }));
            console.log(`Direct notification sent to: ${userData.name} (${userData.email})`);
          }
        });
        
        console.log('Notifications sent for hostel status change');
      }
      
      // Send notifications for user status changes (activation/deactivation)
      if (entity === 'users' && originalItem.status !== updatedItem.status && updatedItem.role !== 'master_admin') {
        const userStatusNotification = {
          type: 'user_status_change',
          title: updatedItem.status === 'active' ? 'Account Activated' : 'Account Deactivated',
          message: updatedItem.status === 'active' 
            ? 'Your account has been activated. You can now access the system.'
            : 'Your account has been deactivated. Please contact administrator.',
          priority: 'high',
          createdAt: new Date().toISOString()
        };
        
        connectedUsers.forEach((userData, ws) => {
          if (ws.readyState === WebSocket.OPEN && userData.email === updatedItem.email) {
            ws.send(JSON.stringify({ type: 'notification', payload: userStatusNotification }));
            console.log(`User status notification sent to: ${userData.name}`);
          }
        });
      }
      
      // Send notifications for tenant status changes
      if (entity === 'tenants' && originalItem.status !== updatedItem.status) {
        const tenantUser = data.users.find(u => u.name === updatedItem.name && u.role === 'tenant');
        if (tenantUser) {
          const tenantStatusNotification = {
            type: 'tenant_status_change',
            title: 'Tenant Status Updated',
            message: `Your tenant status has been updated to ${updatedItem.status}.`,
            priority: 'medium',
            createdAt: new Date().toISOString()
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && userData.email === tenantUser.email) {
              ws.send(JSON.stringify({ type: 'notification', payload: tenantStatusNotification }));
              console.log(`Tenant status notification sent to: ${userData.name}`);
            }
          });
        }
      }
      
      // Send notifications for room assignments/changes
      if (entity === 'tenants' && originalItem.room !== updatedItem.room) {
        const tenantUser = data.users.find(u => u.name === updatedItem.name && u.role === 'tenant');
        if (tenantUser) {
          const roomChangeNotification = {
            type: 'room_change',
            title: 'Room Assignment Updated',
            message: `Your room has been changed from ${originalItem.room || 'unassigned'} to ${updatedItem.room}.`,
            priority: 'medium',
            createdAt: new Date().toISOString()
          };
          
          connectedUsers.forEach((userData, ws) => {
            if (ws.readyState === WebSocket.OPEN && userData.email === tenantUser.email) {
              ws.send(JSON.stringify({ type: 'notification', payload: roomChangeNotification }));
              console.log(`Room change notification sent to: ${userData.name}`);
            }
          });
        }
      }
      
      data[entity][index] = updatedItem;
      
      // Wait for write to complete
      await writeData(data);
      

      
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