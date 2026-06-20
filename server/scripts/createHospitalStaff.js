require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../modules/auth/models/User');
const Store = require('../modules/auth/models/Store');

/**
 * Create an additional hospital + staff account (keeps existing hospitals untouched).
 *
 * Usage:
 *   HOSPITAL_NAME="Apollo City Hospital" \
 *   STAFF_EMAIL="apollo.admin@docnet.com" \
 *   STAFF_NAME="Apollo Reception" \
 *   STAFF_PASSWORD="password123" \
 *   node scripts/createHospitalStaff.js
 *
 * Or positional args:
 *   node scripts/createHospitalStaff.js "Apollo City Hospital" "apollo.admin@docnet.com"
 */
const createHospitalStaff = async () => {
  const hospitalName = process.env.HOSPITAL_NAME || process.argv[2];
  const staffEmail = (process.env.STAFF_EMAIL || process.argv[3] || '').toLowerCase();
  const staffName = process.env.STAFF_NAME || 'Hospital Admin';
  const staffPassword = process.env.STAFF_PASSWORD || 'password123';
  const staffPhone = process.env.STAFF_PHONE || '9876543210';
  const address = process.env.HOSPITAL_ADDRESS || 'Address not set';
  const departments = (process.env.HOSPITAL_DEPARTMENTS || 'General Medicine,Cardiology,Orthopedics,Pediatrics')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  const hasDispensary = process.env.HOSPITAL_HAS_DISPENSARY !== 'false';

  if (!hospitalName || !staffEmail) {
    console.error('❌ Missing required values.');
    console.log('');
    console.log('Usage (env vars):');
    console.log('  HOSPITAL_NAME="My New Hospital" STAFF_EMAIL="staff@hospital.com" node scripts/createHospitalStaff.js');
    console.log('');
    console.log('Usage (args):');
    console.log('  node scripts/createHospitalStaff.js "My New Hospital" "staff@hospital.com"');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/docnet_mvp';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    let store = await Store.findOne({ name: hospitalName, type: 'HOSPITAL' });
    if (!store) {
      store = new Store({
        name: hospitalName,
        type: 'HOSPITAL',
        address,
        departments,
        hasDispensary,
      });
      await store.save();
      console.log('🏥 Created Hospital:', store.name);
    } else {
      console.log('🏥 Found existing Hospital:', store.name);
    }

    let user = await User.findOne({ email: staffEmail });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(staffPassword, salt);

      user = new User({
        name: staffName,
        email: staffEmail,
        passwordHash: hashedPassword,
        phone: staffPhone,
        role: 'STAFF',
        storeId: store._id,
      });
      await user.save();
      console.log('👩‍💼 Created Staff User!');
    } else if (user.role !== 'STAFF') {
      console.error(`❌ Email ${staffEmail} is already used by a ${user.role} account.`);
      process.exit(1);
    } else if (user.storeId?.toString() !== store._id.toString()) {
      console.error(`❌ Staff ${staffEmail} already belongs to another hospital. Use a different STAFF_EMAIL.`);
      process.exit(1);
    } else {
      console.log('⚠️ Staff user already exists for this hospital:', staffEmail);
    }

    console.log('-----------------------------------');
    console.log(`Hospital: ${store.name}`);
    console.log(`Store ID: ${store._id}`);
    console.log(`Email:    ${staffEmail}`);
    console.log(`Password: ${staffPassword}`);
    console.log('-----------------------------------');
  } catch (error) {
    console.error('❌ Script Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

createHospitalStaff();
