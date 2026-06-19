const AUTH_COOKIE_NAME = 'token';
const CSRF_COOKIE_NAME = 'csrfToken';

function resolveSameSite() {
  const configured = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (['lax', 'strict', 'none'].includes(configured)) {
    return configured;
  }
  return 'lax';
}

function buildCookieOptions({ httpOnly, maxAge }) {
  const options = {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: resolveSameSite(),
    path: '/',
  };

  if (maxAge) {
    options.maxAge = maxAge;
  }

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

function getAuthCookieOptions() {
  return buildCookieOptions({
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getClearCookieOptions() {
  return buildCookieOptions({ httpOnly: true });
}

function getCsrfCookieOptions() {
  return buildCookieOptions({
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function getClearCsrfCookieOptions() {
  return buildCookieOptions({ httpOnly: false });
}

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
  getCsrfCookieOptions,
  getClearCsrfCookieOptions,
};