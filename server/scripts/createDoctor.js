require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Store = require('../modules/auth/models/Store');
const doctorService = require('../modules/auth/services/doctorManagement.service');

/**
 * Run: node scripts/createDoctor.js
 * Creates a Doctor account linked to DocNet Central Hospital.
 * Uses the same logic as POST /api/auth/staff/doctors/seed from the staff dashboard.
 */
const createDoctor = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/docnet_mvp';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    const store = await Store.findOne({ name: 'DocNet Central Hospital', type: 'HOSPITAL' });
    if (!store) {
      console.error('❌ Hospital not found! Run createStaff.js first.');
      process.exit(1);
    }

    const { doctor, template } = await doctorService.seedDemoDoctor(store._id);

    console.log('👨‍⚕️ Created Doctor Profile!');
    console.log('-----------------------------------');
    console.log(`Email:    ${template.email}`);
    console.log(`Password: ${template.password}`);
    console.log(`Hospital: ${store.name}`);
    console.log(`Doctor ID: ${doctor._id}`);
    console.log('-----------------------------------');
  } catch (error) {
    if (error.existing) {
      console.log('⚠️ Doctor already exists:', error.message);
    } else {
      console.error('❌ Script Error:', error.message || error);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

createDoctor();
