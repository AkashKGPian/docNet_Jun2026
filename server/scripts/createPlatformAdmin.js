require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../modules/auth/models/User');
const { hashPassword } = require('../modules/auth/helpers/auth.helpers');

/**
 * Create the DocNet platform admin account (manages all hospitals).
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL="admin@docnet.com" \
 *   PLATFORM_ADMIN_PASSWORD="ChangeMe123!" \
 *   PLATFORM_ADMIN_NAME="DocNet Platform Admin" \
 *   node scripts/createPlatformAdmin.js
 */
const createPlatformAdmin = async () => {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || process.argv[2] || 'platform@docnet.com').toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || process.argv[3] || 'password123';
  const name = process.env.PLATFORM_ADMIN_NAME || 'DocNet Platform Admin';

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/docnet_mvp';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    let user = await User.findOne({ email });
    if (user && user.role !== 'PLATFORM_ADMIN') {
      console.error(`❌ Email ${email} is already used by a ${user.role} account.`);
      process.exit(1);
    }

    const hashedPassword = await hashPassword(password);

    if (!user) {
      user = new User({
        name,
        email,
        passwordHash: hashedPassword,
        role: 'PLATFORM_ADMIN',
      });
      await user.save();
      console.log('🛡️ Created Platform Admin!');
    } else {
      user.name = name;
      user.passwordHash = hashedPassword;
      await user.save();
      console.log('🛡️ Updated Platform Admin password.');
    }

    console.log('-----------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('Login at /login → Platform Admin tab → /platform');
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

createPlatformAdmin();
