const User = require('../models/User');
const Doctor = require('../../prescription/models/Doctor');
const Store = require('../models/Store');
const { hashPassword, verifyPassword } = require('../helpers/auth.helpers');
const { signToken } = require('../helpers/jwt.helper');
const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
  getCsrfCookieOptions,
  getClearCsrfCookieOptions,
} = require('../helpers/cookie.helper');
const { generateCsrfToken } = require('../helpers/csrf.helper');

/**
 * STAFF AUTHENTICATION & DOCTOR CREATION CONTROLLER — DocNet MVP
 *
 * Handles staff login/logout and the creation of doctors.
 * Note: Staff accounts cannot be self-registered. They are created by
 * a system admin script (`server/scripts/createStaff.js`).
 */

// ─────────────────────────────────────────────────────────────────────────────
// STAFF LOGIN
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // 1. Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 2. Ensure role is STAFF
    if (user.role !== 'STAFF') {
      return res.status(403).json({ error: 'Staff access only.' });
    }

    // 3. Verify password
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Check if their store is active (system admin level check)
    if (user.storeId) {
      const store = await Store.findById(user.storeId);
      if (!store || !store.isActive) {
        return res.status(403).json({ error: 'Your hospital account is currently suspended.' });
      }
    } else {
      // Failsafe: STAFF should always have a storeId
      return res.status(500).json({ error: 'Account configuration error. No store assigned.' });
    }

    // 5. Issue JWT
    const token = signToken(user);

    // 6. Set httpOnly cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions());

    const userToReturn = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };

    return res.status(200).json({
      message: 'Staff login successful',
      user: userToReturn,
    });
  } catch (error) {
    console.error('Staff Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF CREATES DOCTOR (The "Two-Document" Transaction)
// ─────────────────────────────────────────────────────────────────────────────
exports.createDoctor = async (req, res) => {
  try {
    // req.user is guaranteed to be STAFF because of requireStaff middleware
    // req.user.storeId is guaranteed to exist
    const staffStoreId = req.user.storeId;

    const { name, email, password, department, specialization, dailyPatientLimit } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({ error: 'Name, email, password, and department are required.' });
    }

    // 1. Verify the department exists in the Store's departments array
    const store = await Store.findById(staffStoreId);
    if (!store.departments.includes(department)) {
      return res.status(400).json({
        error: `Department '${department}' does not exist in this hospital. Please create it first.`,
      });
    }

    // 2. Check if email exists internally (User collection)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    // 3. Hash password
    const hashedPassword = await hashPassword(password);

    // 4. Create User document (Auth Identity)
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      role: 'DOCTOR',
      storeId: staffStoreId, // CRITICAL: Derived from Staff, NOT req.body
    });

    // We don't save newUser yet — we want to try saving both or neither (pseudo-transaction)
    // In a real production app with replicas, we'd use mongoose.startSession()
    // For MVP on free tier (often single node), we do sequential saves with manual rollback

    try {
      await newUser.save();

      // 5. Create Doctor document (Professional Profile)
      const newDoctor = new Doctor({
        userId: newUser._id,
        storeId: staffStoreId, // CRITICAL: Must match User.storeId perfectly
        department,
        specialization: specialization || '',
        dailyPatientLimit: dailyPatientLimit || 30,
        isAvailable: 'AVAILABLE',
      });

      await newDoctor.save();

      return res.status(201).json({
        message: 'Doctor created successfully',
        doctor: {
          _id: newDoctor._id,
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          department: newDoctor.department,
          specialization: newDoctor.specialization,
          dailyPatientLimit: newDoctor.dailyPatientLimit,
        },
      });
    } catch (saveError) {
      // Rollback: if Doctor failed to save, delete the User we just created
      if (newUser._id) {
        await User.findByIdAndDelete(newUser._id);
      }
      throw saveError; // pass to outer catch
    }
  } catch (error) {
    console.error('Create Doctor Error:', error);
    return res.status(500).json({ error: 'Internal server error while creating doctor.' });
  }
};

exports.getCurrentStaff = (req, res) => {
  return res.status(200).json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
    },
  });
};

exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearCsrfCookieOptions());
  return res.status(200).json({ message: 'Logged out successfully' });
};
