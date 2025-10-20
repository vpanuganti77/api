const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Generic routes for all entities
const entities = ['hostels', 'tenants', 'rooms', 'payments', 'complaints', 'users', 'expenses', 'staff', 'hostelRequests', 'notices'];

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