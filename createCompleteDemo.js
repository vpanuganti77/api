const Database = require('./database');

const createCompleteDemo = async () => {
  const db = new Database();
  const hostelId = 'demo-hostel-001';
  
  try {
    console.log('Creating complete demo data...');
    
    // Clear existing data
    await db.deleteAll('hostels');
    await db.deleteAll('users');
    await db.deleteAll('rooms');
    await db.deleteAll('tenants');
    await db.deleteAll('payments');
    await db.deleteAll('complaints');
    await db.deleteAll('staff');
    await db.deleteAll('expenses');
    await db.deleteAll('notices');

    // Sample Aadhar card data
    const aadharSample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    // 1. Create hostel
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

    // 2. Create admin user
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

    // 3. Create rooms
    const rooms = [
      { id: 'room-001', roomNumber: 'R001', type: 'single', capacity: 1, rent: 8000, floor: 1, status: 'occupied', occupancy: 1 },
      { id: 'room-002', roomNumber: 'R002', type: 'double', capacity: 2, rent: 6000, floor: 1, status: 'occupied', occupancy: 2 },
      { id: 'room-003', roomNumber: 'R003', type: 'single', capacity: 1, rent: 8000, floor: 1, status: 'available', occupancy: 0 },
      { id: 'room-004', roomNumber: 'R004', type: 'triple', capacity: 3, rent: 5000, floor: 2, status: 'occupied', occupancy: 1 },
      { id: 'room-005', roomNumber: 'R005', type: 'double', capacity: 2, rent: 6000, floor: 2, status: 'available', occupancy: 0 },
      { id: 'room-006', roomNumber: 'R006', type: 'single', capacity: 1, rent: 8000, floor: 2, status: 'available', occupancy: 0 }
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

    // 4. Create tenants with complete data
    const tenants = [
      {
        id: 'tenant-001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '9876543210',
        gender: 'male',
        room: 'R001',
        rent: 8000,
        deposit: 16000,
        status: 'active',
        joiningDate: '2024-01-15',
        aadharNumber: '123456789012',
        aadharFront: aadharSample,
        aadharBack: aadharSample,
        pendingDues: 0
      },
      {
        id: 'tenant-002',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '9876543211',
        gender: 'female',
        room: 'R002',
        rent: 6000,
        deposit: 12000,
        status: 'active',
        joiningDate: '2024-02-01',
        aadharNumber: '123456789013',
        aadharFront: aadharSample,
        aadharBack: aadharSample,
        pendingDues: 6000
      },
      {
        id: 'tenant-003',
        name: 'Mike Wilson',
        email: 'mike.wilson@example.com',
        phone: '9876543212',
        gender: 'male',
        room: 'R002',
        rent: 6000,
        deposit: 12000,
        status: 'active',
        joiningDate: '2024-02-01',
        aadharNumber: '123456789014',
        aadharFront: aadharSample,
        aadharBack: aadharSample,
        pendingDues: 0
      },
      {
        id: 'tenant-004',
        name: 'Sarah Brown',
        email: 'sarah.brown@example.com',
        phone: '9876543213',
        gender: 'female',
        room: 'R004',
        rent: 5000,
        deposit: 10000,
        status: 'active',
        joiningDate: '2024-03-01',
        aadharNumber: '123456789015',
        aadharFront: aadharSample,
        aadharBack: aadharSample,
        pendingDues: 5000
      }
    ];

    for (const tenant of tenants) {
      await db.create('tenants', {
        ...tenant,
        hostelId: hostelId,
        lastModifiedBy: 'Demo Admin',
        lastModifiedDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    // 5. Create payments
    const payments = [
      {
        id: 'payment-001',
        tenantId: 'tenant-001',
        amount: 8000,
        month: 3,
        year: 2024,
        status: 'paid',
        paymentDate: '2024-03-05',
        paymentMethod: 'online',
        transactionId: 'TXN001'
      },
      {
        id: 'payment-002',
        tenantId: 'tenant-002',
        amount: 6000,
        month: 3,
        year: 2024,
        status: 'pending',
        paymentDate: null,
        paymentMethod: null,
        transactionId: null
      },
      {
        id: 'payment-003',
        tenantId: 'tenant-003',
        amount: 6000,
        month: 3,
        year: 2024,
        status: 'paid',
        paymentDate: '2024-03-10',
        paymentMethod: 'cash',
        transactionId: 'CASH001'
      },
      {
        id: 'payment-004',
        tenantId: 'tenant-004',
        amount: 5000,
        month: 3,
        year: 2024,
        status: 'overdue',
        paymentDate: null,
        paymentMethod: null,
        transactionId: null
      }
    ];

    for (const payment of payments) {
      await db.create('payments', {
        ...payment,
        hostelId: hostelId,
        createdAt: new Date().toISOString()
      });
    }

    // 6. Create complaints
    const complaints = [
      {
        id: 'complaint-001',
        title: 'AC not working',
        description: 'The air conditioner in room R001 is not cooling properly.',
        category: 'maintenance',
        priority: 'high',
        status: 'open',
        tenantId: 'tenant-001',
        room: 'R001',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'complaint-002',
        title: 'Water leakage',
        description: 'There is water leakage in the bathroom ceiling.',
        category: 'maintenance',
        priority: 'medium',
        status: 'in-progress',
        tenantId: 'tenant-002',
        room: 'R002',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const complaint of complaints) {
      await db.create('complaints', {
        ...complaint,
        hostelId: hostelId
      });
    }

    // 7. Create staff
    const staff = [
      {
        id: 'staff-001',
        name: 'Ram Kumar',
        role: 'Security Guard',
        phone: '9876543220',
        email: 'ram.kumar@demo.com',
        salary: 15000,
        joiningDate: '2024-01-01',
        shift: 'night',
        status: 'active',
        emergencyContact: '9876543221',
        address: '456 Staff Colony, Demo City'
      },
      {
        id: 'staff-002',
        name: 'Priya Sharma',
        role: 'Housekeeping',
        phone: '9876543222',
        email: 'priya.sharma@demo.com',
        salary: 12000,
        joiningDate: '2024-01-15',
        shift: 'day',
        status: 'active',
        emergencyContact: '9876543223',
        address: '789 Staff Colony, Demo City'
      }
    ];

    for (const member of staff) {
      await db.create('staff', {
        ...member,
        hostelId: hostelId,
        lastModifiedBy: 'Demo Admin',
        lastModifiedDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    // 8. Create expenses
    const expenses = [
      {
        id: 'expense-001',
        title: 'Electricity Bill',
        category: 'Utilities',
        amount: 5000,
        date: '2024-03-01',
        description: 'Monthly electricity bill'
      },
      {
        id: 'expense-002',
        title: 'AC Repair',
        category: 'Maintenance',
        amount: 2500,
        date: '2024-03-10',
        description: 'AC repair for room R001'
      },
      {
        id: 'expense-003',
        title: 'Cleaning Supplies',
        category: 'Supplies',
        amount: 1200,
        date: '2024-03-05',
        description: 'Monthly cleaning supplies'
      }
    ];

    for (const expense of expenses) {
      await db.create('expenses', {
        ...expense,
        hostelId: hostelId,
        addedBy: { name: 'Demo Admin' },
        createdAt: new Date().toISOString()
      });
    }

    // 9. Create notices
    const notices = [
      {
        id: 'notice-001',
        title: 'Monthly Maintenance',
        message: 'Monthly maintenance will be conducted on Sunday from 10 AM to 2 PM. Please cooperate.',
        priority: 'normal',
        createdBy: 'Demo Admin',
        status: 'active',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'notice-002',
        title: 'Rent Due Reminder',
        message: 'This is a reminder that rent for March 2024 is due. Please pay by 10th of the month.',
        priority: 'high',
        createdBy: 'Demo Admin',
        status: 'active',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const notice of notices) {
      await db.create('notices', {
        ...notice,
        hostelId: hostelId
      });
    }

    console.log('Complete demo data created successfully!');
    console.log('Demo credentials: demo@gmail.com / demo');
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
};

module.exports = createCompleteDemo;

if (require.main === module) {
  createCompleteDemo();
}