const User = require('../models/User');
const Doctor = require('../../prescription/models/Doctor');
const Store = require('../models/Store');
const { verifyPassword } = require('../helpers/auth.helpers');
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
 * DOCTOR AUTHENTICATION CONTROLLER — DocNet MVP
 *
 * Handles doctor login and logout.
 * Doctors cannot sign up themselves — they are created by hospital staff.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR LOGIN
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

    // 2. Ensure role is DOCTOR
    if (user.role !== 'DOCTOR') {
      return res.status(403).json({ error: 'Doctor access only.' });
    }

    // 3. Verify password
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Fetch the Doctor professional profile (adds department, limit, etc.)
    const doctorProfile = await Doctor.findOne({ userId: user._id });
    if (!doctorProfile) {
      // Failsafe: Should never happen if creation was handled by staff controller properly
      return res.status(500).json({ error: 'Account configuration error. Professional profile missing.' });
    }

    // 5. Check if hospital itself is active
    const store = await Store.findById(user.storeId);
    if (!store || !store.isActive) {
      return res.status(403).json({ error: 'Your hospital account is currently suspended.' });
    }

    // 6. Issue JWT
    const token = signToken(user);

    // 7. Set httpOnly cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions());

    // 8. Return rich user object (combines User + Doctor info)
    const userToReturn = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      department: doctorProfile.department,
      specialization: doctorProfile.specialization,
      isAvailable: doctorProfile.isAvailable,      // AVAILABLE, PAUSED, ABSENT
    };

    return res.status(200).json({
      message: 'Doctor login successful',
      user: userToReturn,
    });
  } catch (error) {
    console.error('Doctor Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT DOCTOR PROFILE (Session Check)
// ─────────────────────────────────────────────────────────────────────────────
exports.getCurrentDoctor = async (req, res) => {
  try {
    // req.user has been attached by isAuthenticated middleware
    const doctorProfile = await Doctor.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found.' });
    }

    const mergedUser = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      department: doctorProfile.department,
      specialization: doctorProfile.specialization,
      isAvailable: doctorProfile.isAvailable,
      dailyPatientLimit: doctorProfile.dailyPatientLimit,
    };

    return res.status(200).json({ user: mergedUser });
  } catch (error) {
    console.error('Get Current Doctor Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearCsrfCookieOptions());
  return res.status(200).json({ message: 'Logged out successfully' });
};
