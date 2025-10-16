const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

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
      hostelRequests: []
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
    const requiredKeys = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests'];
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
      hostelRequests: []
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

// Generic routes for all entities
const entities = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests'];

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
      
      data[entity].push(newItem);
      
      // Wait for write to complete
      await writeData(data);
      
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
      
      const updatedItem = { 
        ...data[entity][index], 
        ...req.body, 
        id: req.params.id,
        updatedAt: new Date().toISOString()
      };
      
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server is running on port ${PORT}`);
  });
});