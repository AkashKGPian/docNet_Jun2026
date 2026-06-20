require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Store = require('../modules/auth/models/Store');
const doctorService = require('../modules/auth/services/doctorManagement.service');

/**
 * Seed a demo doctor for a specific hospital (by name).
 *
 * Usage:
 *   HOSPITAL_NAME="Apollo City Hospital" \
 *   DOCTOR_EMAIL="doctor@apollo.com" \
 *   DOCTOR_NAME="Dr. Sharma" \
 *   DOCTOR_PASSWORD="password123" \
 *   DOCTOR_DEPARTMENT="General Medicine" \
 *   node scripts/createDoctorForHospital.js
 */
const createDoctorForHospital = async () => {
  const hospitalName = process.env.HOSPITAL_NAME || process.argv[2];
  const template = {
    name: process.env.DOCTOR_NAME || 'Dr. Demo',
    email: (process.env.DOCTOR_EMAIL || process.argv[3] || 'demo.doctor@docnet.com').toLowerCase(),
    password: process.env.DOCTOR_PASSWORD || 'password123',
    phone: process.env.DOCTOR_PHONE || '9868543210',
    department: process.env.DOCTOR_DEPARTMENT || 'General Medicine',
    specialization: process.env.DOCTOR_SPECIALIZATION || 'General Physician',
    dailyPatientLimit: Number(process.env.DOCTOR_DAILY_LIMIT || 50),
  };

  if (!hospitalName) {
    console.error('❌ HOSPITAL_NAME is required.');
    console.log('  HOSPITAL_NAME="My Hospital" node scripts/createDoctorForHospital.js');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/docnet_mvp';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    const store = await Store.findOne({ name: hospitalName, type: 'HOSPITAL' });
    if (!store) {
      console.error(`❌ Hospital not found: "${hospitalName}"`);
      console.log('   Create it first with createHospitalStaff.js');
      process.exit(1);
    }

    const { doctor } = await doctorService.seedDemoDoctor(store._id, template);

    console.log('👨‍⚕️ Created Doctor Profile!');
    console.log('-----------------------------------');
    console.log(`Hospital:  ${store.name}`);
    console.log(`Email:     ${template.email}`);
    console.log(`Password:  ${template.password}`);
    console.log(`Doctor ID: ${doctor._id}`);
    console.log('-----------------------------------');
  } catch (error) {
    if (error.existing) {
      console.log('⚠️ Doctor already exists:', error.message);
    } else {
      console.error('❌ Script Error:', error.message || error);
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

createDoctorForHospital();
