const Database = require('./database');

const createDemoData = async () => {
  const db = new Database();
  
  try {
    console.log('Creating demo data...');
    
    // Demo hostel
    const hostelId = 'demo-hostel-001';
    await db.create('hostels', {
      id: hostelId,
      name: 'Demo Hostel',
      address: '123 Demo Street, Demo City, Demo State 12345',
      planType: 'premium',
      status: 'active',
      trialExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: ['tenant_management', 'room_management', 'payment_tracking', 'complaint_system'],
      createdAt: new Date().toISOString()
    });

    // Demo admin user
    await db.create('users', {
      id: 'demo-user-001',
      name: 'Demo Admin',
      email: 'demo@gmail.com',
      password: 'demo',
      phone: '9876543210',
      role: 'admin',
      hostelId: hostelId,
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // Demo rooms
    const rooms = [
      { id: 'room-001', roomNumber: 'R001', type: 'single', capacity: 1, rent: 8000, floor: 1, status: 'occupied', occupancy: 1 },
      { id: 'room-002', roomNumber: 'R002', type: 'double', capacity: 2, rent: 6000, floor: 1, status: 'occupied', occupancy: 2 },
      { id: 'room-003', roomNumber: 'R003', type: 'single', capacity: 1, rent: 8000, floor: 1, status: 'available', occupancy: 0 },
      { id: 'room-004', roomNumber: 'R004', type: 'triple', capacity: 3, rent: 5000, floor: 2, status: 'occupied', occupancy: 1 },
      { id: 'room-005', roomNumber: 'R005', type: 'double', capacity: 2, rent: 6000, floor: 2, status: 'available', occupancy: 0 }
    ];

    for (const room of rooms) {
      await db.create('rooms', {
        ...room,
        hostelId: hostelId,
        amenities: ['WiFi', 'AC', 'Attached Bathroom'],
        lastModifiedBy: 'Demo Admin',
        lastModifiedDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    console.log('Demo data created successfully!');
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
};

module.exports = createDemoData;

if (require.main === module) {
  createDemoData();
}