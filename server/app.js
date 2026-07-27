const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { csrfProtection } = require('./modules/auth/middleware/csrf.middleware');

const app = express();

// Trust the first proxy (Nginx) so express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(hpp());    // Prevent HTTP Parameter Pollution

// Rate limiting — relaxed in dev; never throttle login/csrf (each login needs CSRF fetch + POST)
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 100,
  skip: (req) => {
    const path = req.originalUrl || req.url || '';
    return /\/auth\/(csrf-token|(patient|doctor|staff)\/(login|signup))|\/platform\/login/.test(path);
  },
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all /api routes
app.use('/api', limiter);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // required to send httpOnly cookies
  })
);

app.use(express.json()); // parses application/json
app.use(cookieParser()); // parses cookies into req.cookies

// Local profile photo fallback — dev only when S3 is not configured
if (process.env.NODE_ENV !== 'production' && !process.env.AWS_S3_BUCKET) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Require CSRF token header for non-read API requests.
app.use('/api', csrfProtection);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Base auth routes
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/platform', require('./modules/platform/routes/platform.routes'));
app.use('/api/stores', require('./modules/store/routes/store.routes'));

// Queue routes
app.use('/api/queue', require('./modules/queue/routes/queue.routes'));

// Prescription modules (Canvas TrOCR proxy & Drug Intelligence & CRUD)
app.use('/api/canvas', require('./modules/prescription/routes/canvas.routes'));
app.use('/api/drugs', require('./modules/prescription/routes/drug.routes'));
app.use('/api/prescriptions', require('./modules/prescription/routes/prescription.routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'DocNet API is running' });
});

// Profile photo pipeline diagnostic (S3 list + CloudFront probe + DB URL check)
app.get('/api/health/profile-media', async (req, res) => {
  try {
    const { runProfileMediaDiagnostics } = require('./modules/shared/mediaDiagnostics');
    const report = await runProfileMediaDiagnostics();
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Profile media diagnostic failed.' });
  }
});

// 404 Fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
