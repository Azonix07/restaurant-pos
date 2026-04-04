const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

const seedData = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB for seeding');

    // Seed admin user if none exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        name: 'Admin',
        email: 'admin@restaurant.com',
        password: 'admin123',
        role: 'admin',
        phone: '9999999999',
      });
      console.log('Admin user created: admin@restaurant.com / admin123');
    }

    // Seed sample users
    const usersToSeed = [
      { name: 'Manager', email: 'manager@restaurant.com', password: 'manager123', role: 'manager' },
      { name: 'Cashier', email: 'cashier@restaurant.com', password: 'cashier123', role: 'cashier' },
      { name: 'Waiter 1', email: 'waiter1@restaurant.com', password: 'waiter123', role: 'waiter' },
      { name: 'Waiter 2', email: 'waiter2@restaurant.com', password: 'waiter123', role: 'waiter' },
    ];

    for (const u of usersToSeed) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) await User.create(u);
    }
    console.log('Users seeded');

    // Seed tables
    const tableCount = await Table.countDocuments();
    if (tableCount === 0) {
      const tables = [];
      for (let i = 1; i <= 15; i++) {
        tables.push({
          number: i,
          name: `Table ${i}`,
          capacity: i <= 5 ? 2 : i <= 10 ? 4 : 6,
          section: i <= 5 ? 'Indoor' : i <= 10 ? 'Outdoor' : 'Private',
        });
      }
      await Table.insertMany(tables);
      console.log('Tables seeded');
    }

    // Seed menu items
    const menuCount = await MenuItem.countDocuments();
    if (menuCount === 0) {
      const menuItems = [
        // Starters
        { name: 'Paneer Tikka', category: 'Starters', price: 280, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 15, tags: ['popular'] },
        { name: 'Chicken 65', category: 'Starters', price: 320, isVeg: false, gstCategory: 'food_non_ac', preparationTime: 15, tags: ['spicy'] },
        { name: 'Veg Spring Roll', category: 'Starters', price: 200, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 10 },
        { name: 'Fish Fry', category: 'Starters', price: 350, isVeg: false, gstCategory: 'food_non_ac', preparationTime: 20 },
        { name: 'Gobi Manchurian', category: 'Starters', price: 220, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 12 },
        // Main Course
        { name: 'Butter Chicken', category: 'Main Course', price: 350, isVeg: false, gstCategory: 'food_non_ac', preparationTime: 20, tags: ['popular', 'bestseller'] },
        { name: 'Dal Makhani', category: 'Main Course', price: 250, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 20, tags: ['popular'] },
        { name: 'Palak Paneer', category: 'Main Course', price: 280, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 18 },
        { name: 'Chicken Biryani', category: 'Main Course', price: 320, isVeg: false, gstCategory: 'food_non_ac', preparationTime: 25, tags: ['popular', 'bestseller'] },
        { name: 'Veg Biryani', category: 'Main Course', price: 250, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 25 },
        { name: 'Mutton Rogan Josh', category: 'Main Course', price: 450, isVeg: false, gstCategory: 'food_non_ac', preparationTime: 30 },
        { name: 'Chole Bhature', category: 'Main Course', price: 200, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 15 },
        // Breads
        { name: 'Naan', category: 'Breads', price: 60, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 5 },
        { name: 'Butter Naan', category: 'Breads', price: 70, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 5 },
        { name: 'Garlic Naan', category: 'Breads', price: 80, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 5 },
        { name: 'Roti', category: 'Breads', price: 40, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 3 },
        // Beverages
        { name: 'Sweet Lassi', category: 'Beverages', price: 100, isVeg: true, gstCategory: 'beverage', preparationTime: 5 },
        { name: 'Masala Chai', category: 'Beverages', price: 50, isVeg: true, gstCategory: 'beverage', preparationTime: 5 },
        { name: 'Fresh Lime Soda', category: 'Beverages', price: 80, isVeg: true, gstCategory: 'beverage', preparationTime: 3 },
        { name: 'Cold Coffee', category: 'Beverages', price: 120, isVeg: true, gstCategory: 'beverage', preparationTime: 5 },
        // Desserts
        { name: 'Gulab Jamun', category: 'Desserts', price: 120, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 5 },
        { name: 'Rasmalai', category: 'Desserts', price: 150, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 5 },
        { name: 'Kulfi', category: 'Desserts', price: 100, isVeg: true, gstCategory: 'food_non_ac', preparationTime: 3 },
      ];
      await MenuItem.insertMany(menuItems);
      console.log('Menu items seeded');
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
