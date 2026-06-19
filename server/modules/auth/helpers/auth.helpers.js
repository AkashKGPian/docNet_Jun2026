const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcrypt.
 * Always use this before saving any password to the database.
 *
 * @param {string} plainPassword - The raw password from the signup form
 * @returns {Promise<string>} - The hashed password string to store in DB
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * Use this during login to verify credentials.
 *
 * @param {string} plainPassword  - The raw password from the login form
 * @param {string} hashedPassword - The stored hash from User.passwordHash
 * @returns {Promise<boolean>}    - true if match, false if wrong password
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = { hashPassword, verifyPassword };
