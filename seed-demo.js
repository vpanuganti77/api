const Database = require('./database');

const seedDemo = async () => {
  try {
    const hostelId = 'demo-hostel-001';
    const currentDate = new Date().toISOString();

    // 1. Create Demo Hostel
    const demoHostel = {
      id: hostelId,
      name: 'Demo Hostel',
      address: '123 Demo Street, Demo City',
      planType: 'premium',
      planStatus: 'active',
      trialExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      adminName: 'Demo Admin',
      adminEmail: 'demo@gmail.com',
      adminPhone: '+1234567890',
      status: 'active',
      totalRooms: 10,
      occupiedRooms: 6,
      createdAt: currentDate,
      updatedAt: currentDate
    };

    // 2. Create Demo Admin User
    const demoUser = {
      id: 'demo-user-001',
      name: 'Demo Admin',
      email: 'demo@gmail.com',
      phone: '+1234567890',
      role: 'admin',
      password: 'demo',
      hostelId: hostelId,
      hostelName: 'Demo Hostel',
      status: 'active',
      createdAt: currentDate,
      updatedAt: currentDate
    };

    // 3. Create Demo Rooms
    const demoRooms = [
      { roomNumber: '101', type: 'single', capacity: 1, rent: 25000, occupancy: 1, status: 'occupied', floor: 1, amenities: ['Wifi', 'AC', 'TV'] },
      { roomNumber: '102', type: 'single', capacity: 1, rent: 25000, occupancy: 0, status: 'available', floor: 1, amenities: ['Wifi', 'AC'] },
      { roomNumber: '103', type: 'double', capacity: 2, rent: 35000, occupancy: 2, status: 'occupied', floor: 1, amenities: ['Wifi', 'AC', 'TV'] },
      { roomNumber: '201', type: 'double', capacity: 2, rent: 35000, occupancy: 1, status: 'occupied', floor: 2, amenities: ['Wifi', 'AC'] },
      { roomNumber: '202', type: 'triple', capacity: 3, rent: 45000, occupancy: 3, status: 'occupied', floor: 2, amenities: ['Wifi', 'AC', 'TV', 'Fridge'] },
      { roomNumber: '203', type: 'triple', capacity: 3, rent: 45000, occupancy: 0, status: 'available', floor: 2, amenities: ['Wifi', 'AC'] },
      { roomNumber: '301', type: 'quad', capacity: 4, rent: 55000, occupancy: 4, status: 'occupied', floor: 3, amenities: ['Wifi', 'AC', 'TV'] },
      { roomNumber: '302', type: 'quad', capacity: 4, rent: 55000, occupancy: 0, status: 'available', floor: 3, amenities: ['Wifi', 'AC'] },
      { roomNumber: '303', type: 'dormitory', capacity: 6, rent: 75000, occupancy: 6, status: 'occupied', floor: 3, amenities: ['Wifi', 'AC', 'TV', 'Fridge'] },
      { roomNumber: '304', type: 'single', capacity: 1, rent: 25000, occupancy: 0, status: 'maintenance', floor: 3, amenities: ['Wifi', 'AC'] }
    ].map((room, index) => ({
      id: `demo-room-${String(index + 1).padStart(3, '0')}`,
      ...room,
      hostelId,
      lastModifiedBy: 'Demo Admin',
      lastModifiedDate: currentDate,
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // 4. Create Demo Tenants
    const demoTenants = [
      { name: 'John Doe', email: 'john@example.com', phone: '+1111111111', roomId: 'demo-room-001' },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '+2222222222', roomId: 'demo-room-003' },
      { name: 'Mike Johnson', email: 'mike@example.com', phone: '+3333333333', roomId: 'demo-room-003' },
      { name: 'Sarah Wilson', email: 'sarah@example.com', phone: '+4444444444', roomId: 'demo-room-004' },
      { name: 'David Brown', email: 'david@example.com', phone: '+5555555555', roomId: 'demo-room-005' },
      { name: 'Lisa Davis', email: 'lisa@example.com', phone: '+6666666666', roomId: 'demo-room-005' },
      { name: 'Tom Miller', email: 'tom@example.com', phone: '+7777777777', roomId: 'demo-room-005' },
      { name: 'Amy Garcia', email: 'amy@example.com', phone: '+8888888888', roomId: 'demo-room-007' },
      { name: 'Chris Martinez', email: 'chris@example.com', phone: '+9999999999', roomId: 'demo-room-007' }
    ].map((tenant, index) => ({
      id: `demo-tenant-${String(index + 1).padStart(3, '0')}`,
      ...tenant,
      hostelId,
      status: 'active',
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // 5. Create Demo Payments
    const demoPayments = [
      { tenantId: 'demo-tenant-001', amount: 25000, month: 'October', year: 2025, status: 'paid' },
      { tenantId: 'demo-tenant-002', amount: 17500, month: 'October', year: 2025, status: 'paid' },
      { tenantId: 'demo-tenant-003', amount: 17500, month: 'October', year: 2025, status: 'pending' },
      { tenantId: 'demo-tenant-004', amount: 35000, month: 'October', year: 2025, status: 'paid' },
      { tenantId: 'demo-tenant-005', amount: 15000, month: 'October', year: 2025, status: 'pending' }
    ].map((payment, index) => ({
      id: `demo-payment-${String(index + 1).padStart(3, '0')}`,
      ...payment,
      hostelId,
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // 6. Create Demo Complaints
    const demoComplaints = [
      { title: 'AC not working', description: 'Air conditioner in room 101 is not cooling properly', category: 'maintenance', priority: 'high', status: 'open', tenantId: 'demo-tenant-001' },
      { title: 'Wifi connectivity issue', description: 'Internet connection is very slow in room 201', category: 'technical', priority: 'medium', status: 'in_progress', tenantId: 'demo-tenant-004' },
      { title: 'Noise complaint', description: 'Too much noise from neighboring room during night hours', category: 'behavioral', priority: 'medium', status: 'resolved', tenantId: 'demo-tenant-002' }
    ].map((complaint, index) => ({
      id: `demo-complaint-${String(index + 1).padStart(3, '0')}`,
      ...complaint,
      hostelId,
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // Insert all data
    await Database.create('hostels', demoHostel);
    await Database.create('users', demoUser);
    
    for (const room of demoRooms) {
      await Database.create('rooms', room);
    }
    
    for (const tenant of demoTenants) {
      await Database.create('tenants', tenant);
    }
    
    for (const payment of demoPayments) {
      await Database.create('payments', payment);
    }
    
    for (const complaint of demoComplaints) {
      await Database.create('complaints', complaint);
    }

    console.log('✅ Demo data created successfully!');
    console.log('📧 Login with: demo@gmail.com');
    console.log('🔑 Password: demo');
    console.log('🏨 Hostel: Demo Hostel');
    console.log('📊 Data: 10 rooms, 9 tenants, 5 payments, 3 complaints');

  } catch (error) {
    console.error('❌ Error creating demo data:', error);
  }
};

seedDemo();