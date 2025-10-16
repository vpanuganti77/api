const Database = require('./database');

const seedRooms = async () => {
  try {
    // Get current user's hostelId (you'll need to replace this with actual hostelId)
    const hostels = await Database.getAll('hostels');
    const hostelId = hostels.length > 0 ? hostels[0].id : '1';
    
    const sampleRooms = [
      {
        roomNumber: '101',
        type: 'single',
        capacity: 1,
        rent: 25000,
        occupancy: 0,
        status: 'available',
        floor: 1,
        amenities: ['Wifi', 'AC', 'TV'],
        lastModifiedBy: 'Admin',
        lastModifiedDate: new Date().toISOString(),
        hostelId
      },
      {
        roomNumber: '102',
        type: 'double',
        capacity: 2,
        rent: 35000,
        occupancy: 1,
        status: 'occupied',
        floor: 1,
        amenities: ['Wifi', 'AC'],
        lastModifiedBy: 'Admin',
        lastModifiedDate: new Date().toISOString(),
        hostelId
      },
      {
        roomNumber: '201',
        type: 'triple',
        capacity: 3,
        rent: 45000,
        occupancy: 0,
        status: 'available',
        floor: 2,
        amenities: ['Wifi'],
        lastModifiedBy: 'Admin',
        lastModifiedDate: new Date().toISOString(),
        hostelId
      }
    ];

    for (const room of sampleRooms) {
      await Database.create('rooms', room);
      console.log(`Created room ${room.roomNumber}`);
    }

    console.log('Sample rooms created successfully!');
  } catch (error) {
    console.error('Error seeding rooms:', error);
  }
};

seedRooms();