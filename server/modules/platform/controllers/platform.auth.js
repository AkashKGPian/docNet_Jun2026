const User = require('../../auth/models/User');
const { verifyPassword } = require('../../auth/helpers/auth.helpers');
const { signToken } = require('../../auth/helpers/jwt.helper');
const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
  getCsrfCookieOptions,
  getClearCsrfCookieOptions,
} = require('../../auth/helpers/cookie.helper');
const { generateCsrfToken } = require('../../auth/helpers/csrf.helper');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'Platform admin access only.' });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions());

    return res.status(200).json({
      message: 'Platform admin login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Platform Admin Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

exports.getCurrentUser = (req, res) => {
  return res.status(200).json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearCsrfCookieOptions());
  return res.status(200).json({ message: 'Logged out successfully' });
};
