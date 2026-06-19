require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../modules/auth/models/User');
const Store = require('../modules/auth/models/Store');

/**
 * Run: node scripts/createStaff.js
 * Creates a master Hospital and a Staff (Receptionist) account.
 */
const createStaff = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/docnet_mvp';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    // 1. Ensure a Store (Hospital) exists
    let store = await Store.findOne({ name: 'DocNet Central Hospital', type: 'HOSPITAL' });
    if (!store) {
      store = new Store({
        name: 'DocNet Central Hospital',
        type: 'HOSPITAL',
        address: '123 Innovation Drive, Tech City',
        departments: ['Cardiology', 'General Medicine', 'Orthopedics', 'Pediatrics'],
        hasDispensary: true,
      });
      await store.save();
      console.log('🏥 Created Hospital:', store.name);
    } else {
      console.log('🏥 Found existing Hospital:', store.name);
    }

    // 2. Create the Staff User (Receptionist)
    const staffEmail = 'admin@docnet.com';
    let user = await User.findOne({ email: staffEmail });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      user = new User({
        name: 'Sarah (Admin)',
        email: staffEmail,
        passwordHash: hashedPassword,
        phone: '9876543210',
        role: 'STAFF',
        storeId: store._id,
      });
      await user.save();
      console.log('👩‍💼 Created Staff User!');
      console.log('-----------------------------------');
      console.log(`Email:    ${staffEmail}`);
      console.log(`Password: password123`);
      console.log(`Store ID: ${store._id}`);
      console.log('-----------------------------------');
    } else {
      console.log('⚠️ Staff user already exists:', staffEmail);
    }

  } catch (error) {
    console.error('❌ Script Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

createStaff();
