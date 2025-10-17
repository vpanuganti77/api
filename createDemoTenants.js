const Database = require('./database');

const createDemoTenants = async () => {
  const db = new Database();
  const hostelId = 'demo-hostel-001';
  
  // Sample Aadhar card data (base64 encoded placeholder)
  const aadharFrontSample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  const aadharBackSample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

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
      aadharFront: aadharFrontSample,
      aadharBack: aadharBackSample,
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
      aadharFront: aadharFrontSample,
      aadharBack: aadharBackSample,
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
      aadharFront: aadharFrontSample,
      aadharBack: aadharBackSample,
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
      aadharFront: aadharFrontSample,
      aadharBack: aadharBackSample,
      pendingDues: 5000
    }
  ];

  try {
    for (const tenant of tenants) {
      await db.create('tenants', {
        ...tenant,
        hostelId: hostelId,
        lastModifiedBy: 'Demo Admin',
        lastModifiedDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }
    console.log('Demo tenants created successfully!');
  } catch (error) {
    console.error('Error creating demo tenants:', error);
  }
};

module.exports = createDemoTenants;

if (require.main === module) {
  createDemoTenants();
}