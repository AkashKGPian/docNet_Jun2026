import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  API_BASE_URL.replace(/\/api\/?$/, '') ||
  'http://localhost:5000';

export function getAssetUrl(path) {
  if (!path) return null;
  // CloudFront / absolute URLs — use as-is in all environments
  if (/^https?:\/\//i.test(path)) return path;

  // Legacy URLs stored without https:// (e.g. dxxxx.cloudfront.net/profiles/...)
  if (/^[\w.-]+\.cloudfront\.net\//i.test(path)) {
    return `https://${path}`;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;

  // Dev only: legacy local disk photos via Vite /uploads proxy
  if (import.meta.env.DEV) {
    return normalized;
  }

  // Production: profile photos should be CloudFront URLs; legacy /uploads paths are unsupported
  return `${SOCKET_URL}${normalized}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
let csrfTokenCache = null;

function readCookie(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken() {
  const cookieToken = readCookie('csrfToken');
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return csrfTokenCache;
  }

  const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
    withCredentials: true,
  });

  csrfTokenCache = response.data?.csrfToken || readCookie('csrfToken');
  return csrfTokenCache;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!MUTATING_METHODS.has(method)) {
    return config;
  }

  const cookieToken = readCookie('csrfToken');
  if (cookieToken) {
    csrfTokenCache = cookieToken;
  }

  const csrfToken = csrfTokenCache || (await ensureCsrfToken());
  if (csrfToken) {
    config.headers = config.headers || {};
    config.headers['x-csrf-token'] = csrfToken;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isSessionProbe = /\/auth\/(patient|doctor|staff)\/me/.test(url);

    // 401 on /me probes is expected when checking which role is logged in — do not clear session
    if (error.response?.status === 401 && !isSessionProbe) {
      window.dispatchEvent(new CustomEvent('docnet:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
