const express = require('express');
const cors = require('cors');
const db = require('./database');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Login endpoint without domain validation
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await db.getAll('users');
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ message: 'User account not found. Please check your email or contact administrator.' });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    
    if (user.status === 'inactive') {
      return res.status(401).json({ message: 'Account is deactivated. Please contact your administrator.' });
    }
    
    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login successful',
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
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
    
    // Process uploaded files
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/api/uploads/complaints/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    const complaintData = {
      ...req.body,
      attachments: JSON.stringify(attachments) // Store as JSON string in SQLite
    };
    
    const newItem = await db.create('complaints', complaintData);
    console.log('Created complaint:', newItem.id);
    res.json(newItem);
  } catch (error) {
    console.error('Error creating complaint:', error);
    if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Generic routes for all entities (excluding complaints which has special handling above)
const entities = ['hostels', 'tenants', 'rooms', 'payments', 'users', 'expenses', 'staff', 'hostelRequests', 'notices', 'supportTickets'];

entities.forEach(entity => {
  // GET all
  app.get(`/api/${entity}`, async (req, res) => {
    try {
      const data = await db.getAll(entity);
      res.json(data);
    } catch (error) {
      console.error(`Error fetching ${entity}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST create
  app.post(`/api/${entity}`, async (req, res) => {
    try {
      const newItem = await db.create(entity, req.body);
      console.log(`Created ${entity}:`, newItem.id);
      res.json(newItem);
    } catch (error) {
      console.error(`Error creating ${entity}:`, error);
      if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // PUT update
  app.put(`/api/${entity}/:id`, async (req, res) => {
    try {
      const updatedItem = await db.update(entity, req.params.id, req.body);
      console.log(`Updated ${entity}:`, req.params.id);
      res.json(updatedItem);
    } catch (error) {
      console.error(`Error updating ${entity}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE
  app.delete(`/api/${entity}/:id`, async (req, res) => {
    try {
      const result = await db.delete(entity, req.params.id);
      if (result.deleted) {
        console.log(`Deleted ${entity}:`, req.params.id);
        res.json({ message: 'Item deleted' });
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } catch (error) {
      console.error(`Error deleting ${entity}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET by ID
  app.get(`/api/${entity}/:id`, async (req, res) => {
    try {
      const item = await db.findById(entity, req.params.id);
      if (item) {
        res.json(item);
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } catch (error) {
      console.error(`Error fetching ${entity}:`, error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Add complaints GET, PUT, DELETE routes separately
app.get('/api/complaints', async (req, res) => {
  try {
    const data = await db.getAll('complaints');
    res.json(data);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/complaints/:id', async (req, res) => {
  try {
    const updatedItem = await db.update('complaints', req.params.id, req.body);
    console.log('Updated complaint:', req.params.id);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/complaints/:id', async (req, res) => {
  try {
    const result = await db.delete('complaints', req.params.id);
    if (result.deleted) {
      console.log('Deleted complaint:', req.params.id);
      res.json({ message: 'Item deleted' });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/complaints/:id', async (req, res) => {
  try {
    const item = await db.findById('complaints', req.params.id);
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-create demo data on startup
const initializeDemoData = async () => {
  try {
    console.log('Refreshing demo data on startup...');
    const createCompleteDemo = require('./createCompleteDemo');
    await createCompleteDemo();
    console.log('Demo data refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing demo data:', error);
  }
};


app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server is running on port ${PORT}`);
    // Initialize demo data
  await initializeDemoData();
});

module.exports = app;