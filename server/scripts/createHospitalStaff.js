require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const platformAdminService = require('../modules/platform/services/platformAdmin.service');

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

    const result = await platformAdminService.createHospitalWithStaff({
      hospitalName,
      staffEmail,
      staffName: process.env.STAFF_NAME || 'Hospital Admin',
      staffPassword: process.env.STAFF_PASSWORD || 'password123',
      staffPhone: process.env.STAFF_PHONE || '9876543210',
      address: process.env.HOSPITAL_ADDRESS || 'Address not set',
      departments: (process.env.HOSPITAL_DEPARTMENTS || 'General Medicine,Cardiology,Orthopedics,Pediatrics')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      hasDispensary: process.env.HOSPITAL_HAS_DISPENSARY !== 'false',
    });

    if (result.storeCreated) {
      console.log('🏥 Created Hospital:', result.store.name);
    } else {
      console.log('🏥 Found existing Hospital:', result.store.name);
    }

    if (result.staffCreated) {
      console.log('👩‍💼 Created Staff User!');
    } else {
      console.log('⚠️ Staff user already exists for this hospital:', staffEmail);
    }

    console.log('-----------------------------------');
    console.log(`Hospital: ${result.store.name}`);
    console.log(`Store ID: ${result.store._id}`);
    console.log(`Email:    ${staffEmail}`);
    console.log(`Password: ${process.env.STAFF_PASSWORD || 'password123'}`);
    console.log('-----------------------------------');
  } catch (error) {
    console.error('❌ Script Error:', error.message || error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

createHospitalStaff();
