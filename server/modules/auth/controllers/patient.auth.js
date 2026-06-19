const User = require('../models/User');
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
const {
  isS3Configured,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadProfilePhotoLocal,
  deleteProfilePhotoLocal,
} = require('../../shared/s3.service');

function serializePatient(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    age: user.age ?? null,
    gender: user.gender || '',
    bloodGroup: user.bloodGroup || '',
    allergies: Array.isArray(user.allergies) ? user.allergies : [],
    address: user.address || '',
    profilePicture: user.profilePicture || null,
  };
}

function parseAllergies(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function removePreviousProfilePhoto(previousPhoto) {
  if (!previousPhoto) return;

  if (isS3Configured()) {
    await deleteProfilePhoto(previousPhoto);
    return;
  }

  deleteProfilePhotoLocal(previousPhoto);
}

/**
 * PATIENT AUTHENTICATION CONTROLLER — DocNet MVP
 *
 * Handles signup, login, and logout for PATIENT role.
 *
 * Security assumptions:
 * - Patients self-register via the app/web frontend.
 * - Patients are NOT scoped to a single store (storeId = null).
 * - Passwords are hashed before saving.
 * - JWT is issued via httpOnly cookie (resilient against XSS).
 */

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT SIGNUP
// ─────────────────────────────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, age, gender, bloodGroup, allergies, address } = req.body;

    // 1. Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // 2. Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    // 3. Hash password
    const hashedPassword = await hashPassword(password);

    // 4. Create user
    // Note: Mongoose pre-save hook ensures storeId is null for PATIENTS
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: hashedPassword,
      role: 'PATIENT',
      age,
      gender,
      bloodGroup,
      allergies,
      address,
    });

    await newUser.save();

    // 5. Issue JWT (auto-login after signup)
    const token = signToken(newUser);

    // 6. Set httpOnly cookie
    // secure: true in production requires HTTPS
    // sameSite: 'strict' or 'lax' prevents CSRF
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions());

    // 7. Return user (omit passwordHash)
    const userToReturn = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    return res.status(201).json({
      message: 'Signup successful',
      user: userToReturn,
    });
  } catch (error) {
    console.error('Patient Signup Error:', error);
    return res.status(500).json({ error: 'Internal server error during signup.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT LOGIN
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

    // 2. Ensure role is PATIENT
    if (user.role !== 'PATIENT') {
      return res.status(403).json({ error: 'Please use the staff or doctor login portal.' });
    }

    // 3. Verify password
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Issue JWT
    const token = signToken(user);

    // 5. Set httpOnly cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions());

    // 6. Return user
    const userToReturn = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return res.status(200).json({
      message: 'Login successful',
      user: userToReturn,
    });
  } catch (error) {
    console.error('Patient Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT (Same for all roles, can use this one endpoint or duplicate)
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearCsrfCookieOptions());
  return res.status(200).json({ message: 'Logged out successfully' });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT USER (Session check)
// ─────────────────────────────────────────────────────────────────────────────
exports.getCurrentUser = (req, res) => {
  return res.status(200).json({
    user: serializePatient(req.user),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PATIENT PROFILE
// ─────────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone, age, gender, bloodGroup, address, allergies } = req.body;
    const user = req.user;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }
      user.name = trimmedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email cannot be empty.' });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Email is already registered to another account.' });
      }

      user.email = normalizedEmail;
    }

    if (phone !== undefined) user.phone = String(phone).trim();
    if (age !== undefined) {
      const parsedAge = Number(age);
      user.age = Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null;
    }
    if (gender !== undefined) {
      if (!['M', 'F', 'Other', ''].includes(gender)) {
        return res.status(400).json({ error: 'Invalid gender value.' });
      }
      user.gender = gender || undefined;
    }
    if (bloodGroup !== undefined) user.bloodGroup = String(bloodGroup).trim();
    if (address !== undefined) user.address = String(address).trim();
    if (allergies !== undefined) user.allergies = parseAllergies(allergies);

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: serializePatient(user),
    });
  } catch (error) {
    console.error('Update Patient Profile Error:', error);
    return res.status(500).json({ error: 'Internal server error while updating profile.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD PATIENT PROFILE PHOTO
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo file is required.' });
    }

    const user = req.user;
    const previousPhoto = user.profilePicture;

    const uploadPayload = {
      patientId: user._id.toString(),
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
    };

    const uploaded = isS3Configured()
      ? await uploadProfilePhoto(uploadPayload)
      : uploadProfilePhotoLocal(uploadPayload);

    user.profilePicture = uploaded.url;
    await user.save();

    await removePreviousProfilePhoto(previousPhoto);

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated.',
      user: serializePatient(user),
    });
  } catch (error) {
    console.error('Upload Profile Photo Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while uploading profile photo.',
    });
  }
};
