const crypto = require('crypto');

const CSRF_HEADER_NAME = 'x-csrf-token';

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  CSRF_HEADER_NAME,
  generateCsrfToken,
};