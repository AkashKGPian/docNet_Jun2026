const { CSRF_COOKIE_NAME } = require('../helpers/cookie.helper');
const { CSRF_HEADER_NAME } = require('../helpers/csrf.helper');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = req.headers[CSRF_HEADER_NAME];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  return next();
}

module.exports = {
  csrfProtection,
};