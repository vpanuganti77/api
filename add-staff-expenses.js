const Database = require('./database');

const addStaffAndExpenses = async () => {
  try {
    const hostelId = 'demo-hostel-001';
    const currentDate = new Date().toISOString();

    // Create Demo Staff
    const demoStaff = [
      { name: 'Robert Johnson', role: 'Manager', phone: '+1001001001', salary: 45000 },
      { name: 'Maria Garcia', role: 'Cleaner', phone: '+1002002002', salary: 25000 },
      { name: 'James Wilson', role: 'Security Guard', phone: '+1003003003', salary: 30000 },
      { name: 'Linda Brown', role: 'Cook', phone: '+1004004004', salary: 35000 },
      { name: 'Michael Davis', role: 'Maintenance', phone: '+1005005005', salary: 32000 }
    ].map((staff, index) => ({
      id: `demo-staff-${String(index + 1).padStart(3, '0')}`,
      ...staff,
      hostelId,
      status: 'active',
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // Create Demo Expenses
    const demoExpenses = [
      { title: 'Electricity Bill', amount: 15000, category: 'utilities', date: '2025-10-01' },
      { title: 'Water Bill', amount: 8000, category: 'utilities', date: '2025-10-02' },
      { title: 'Internet Bill', amount: 5000, category: 'utilities', date: '2025-10-03' },
      { title: 'Cleaning Supplies', amount: 3500, category: 'maintenance', date: '2025-10-05' },
      { title: 'Kitchen Equipment', amount: 12000, category: 'equipment', date: '2025-10-07' },
      { title: 'Security System Maintenance', amount: 7500, category: 'maintenance', date: '2025-10-10' },
      { title: 'Staff Salaries', amount: 167000, category: 'salaries', date: '2025-10-01' },
      { title: 'Furniture Repair', amount: 4500, category: 'maintenance', date: '2025-10-12' }
    ].map((expense, index) => ({
      id: `demo-expense-${String(index + 1).padStart(3, '0')}`,
      ...expense,
      hostelId,
      createdAt: currentDate,
      updatedAt: currentDate
    }));

    // Insert staff data
    for (const staff of demoStaff) {
      try {
        await Database.create('staff', staff);
        console.log(`✅ Created staff: ${staff.name}`);
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          console.log(`⚠️ Staff ${staff.name} already exists`);
        } else {
          console.error(`❌ Error creating staff ${staff.name}:`, error.message);
        }
      }
    }

    // Insert expenses data
    for (const expense of demoExpenses) {
      try {
        await Database.create('expenses', expense);
        console.log(`✅ Created expense: ${expense.title}`);
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          console.log(`⚠️ Expense ${expense.title} already exists`);
        } else {
          console.error(`❌ Error creating expense ${expense.title}:`, error.message);
        }
      }
    }

    console.log('\n✅ Staff and expenses data added successfully!');
    console.log('📊 Added: 5 staff members, 8 expenses');

  } catch (error) {
    console.error('❌ Error adding staff and expenses:', error);
  }
};

addStaffAndExpenses();