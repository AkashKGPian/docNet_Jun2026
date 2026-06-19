const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign (create) a JWT token for a logged-in user.
 *
 * What goes inside the token (payload):
 *   - id    → user's MongoDB _id — used by isAuthenticated to fetch the user
 *   - role  → PATIENT / STAFF / DOCTOR — used by role middleware
 *
 * What does NOT go inside (kept out intentionally):
 *   - passwordHash  → never expose this
 *   - storeId       → fetched fresh from DB each request (via User.findById)
 *                     so that storeId changes take effect immediately
 *
 * DocNet change vs SmartQ:
 *   SmartQ payload: { id, role }  ← same
 *   DocNet payload: { id, role }  ← same, no change needed
 *   (storeId lives on the User doc, fetched in isAuthenticated middleware)
 *
 * @param {Object} user - The User mongoose document
 * @returns {string}    - Signed JWT string
 */
function signToken(user) {
  return jwt.sign(
    {
      id:   user._id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Verify and decode a JWT token.
 * Throws an error if token is expired or tampered with.
 *
 * @param {string} token - JWT string from cookie or Authorization header
 * @returns {Object}     - Decoded payload: { id, role, iat, exp }
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
