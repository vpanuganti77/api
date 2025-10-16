const Database = require('./database');

const addDemoUsers = async () => {
  try {
    const hostelId = 'demo-hostel-001';
    const currentDate = new Date().toISOString();

    // Create additional demo users for the demo hostel
    const demoUsers = [
      {
        id: 'demo-user-002',
        name: 'John Manager',
        email: 'manager@demo.com',
        phone: '+1111111111',
        role: 'admin',
        password: 'manager123',
        hostelId: hostelId,
        hostelName: 'Demo Hostel',
        status: 'active',
        createdAt: currentDate,
        updatedAt: currentDate
      },
      {
        id: 'demo-user-003',
        name: 'Sarah Receptionist',
        email: 'reception@demo.com',
        phone: '+2222222222',
        role: 'receptionist',
        password: 'reception123',
        hostelId: hostelId,
        hostelName: 'Demo Hostel',
        status: 'active',
        createdAt: currentDate,
        updatedAt: currentDate
      },
      {
        id: 'demo-user-004',
        name: 'Mike Staff',
        email: 'staff@demo.com',
        phone: '+3333333333',
        role: 'staff',
        password: 'staff123',
        hostelId: hostelId,
        hostelName: 'Demo Hostel',
        status: 'active',
        createdAt: currentDate,
        updatedAt: currentDate
      },
      {
        id: 'demo-user-005',
        name: 'Lisa Assistant',
        email: 'assistant@demo.com',
        phone: '+4444444444',
        role: 'admin',
        password: 'assistant123',
        hostelId: hostelId,
        hostelName: 'Demo Hostel',
        status: 'inactive',
        createdAt: currentDate,
        updatedAt: currentDate
      }
    ];

    // Insert demo users
    for (const user of demoUsers) {
      try {
        await Database.create('users', user);
        console.log(`✅ Created user: ${user.name} (${user.email})`);
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          console.log(`⚠️ User ${user.email} already exists`);
        } else {
          console.error(`❌ Error creating user ${user.email}:`, error.message);
        }
      }
    }

    console.log('\n✅ Demo users added successfully!');
    console.log('📊 Added: 4 additional users for Demo Hostel');

  } catch (error) {
    console.error('❌ Error adding demo users:', error);
  }
};

addDemoUsers();