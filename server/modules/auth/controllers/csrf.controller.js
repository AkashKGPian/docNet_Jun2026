const { CSRF_COOKIE_NAME, getCsrfCookieOptions } = require('../helpers/cookie.helper');
const { generateCsrfToken } = require('../helpers/csrf.helper');

exports.getCsrfToken = (req, res) => {
  const csrfToken = generateCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());

  return res.status(200).json({ csrfToken });
};