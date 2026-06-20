const { verifyToken } = require('../helpers/jwt.helper');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE 1: isAuthenticated
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifies the JWT from the httpOnly cookie.
 * On success: attaches full User document to req.user, calls next().
 * On failure: 401 (no identity established).
 *
 * ALWAYS the FIRST middleware in any protected route chain.
 * Run sequence: isAuthenticated → requireRole → enforceStoreScope → controller
 *
 * SmartQ source: kept as-is. No changes needed.
 */
async function isAuthenticated(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    // verifyToken throws if expired or tampered — caught by catch block below
    const payload = verifyToken(token);

    // Fetch full user from DB — this gives us fresh storeId, role, etc.
    // We do NOT trust storeId from the JWT — always fetch from DB
    const user = await User.findById(payload.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = user; // full User doc now available to all subsequent middleware
    next();
  } catch (err) {
    // JWT errors: TokenExpiredError, JsonWebTokenError, etc.
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE 2: Role Guards
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Role guards — run AFTER isAuthenticated.
 * Check req.user.role and allow or block.
 * 403 = identity confirmed, but permission insufficient.
 *
 * Usage:
 *   router.get('/profile', isAuthenticated, requirePatient, controller)
 *   router.post('/doctors', isAuthenticated, requireStaff, controller)
 *   router.get('/queue', isAuthenticated, requireDoctor, controller)
 */

function requirePatient(req, res, next) {
  if (req.user.role !== 'PATIENT') {
    return res.status(403).json({ error: 'Patient access only.' });
  }
  next();
}

function requireStaff(req, res, next) {
  if (req.user.role !== 'STAFF') {
    return res.status(403).json({ error: 'Staff access only.' });
  }
  next();
}

// DocNet addition — SmartQ did not have DOCTOR role
function requireDoctor(req, res, next) {
  if (req.user.role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Doctor access only.' });
  }
  next();
}

// Allows either STAFF or DOCTOR (e.g. pause/resume queue — both can do it)
function requireStaffOrDoctor(req, res, next) {
  if (req.user.role !== 'STAFF' && req.user.role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Staff or Doctor access only.' });
  }
  next();
}

function requirePlatformAdmin(req, res, next) {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'Platform admin access only.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE 3: enforceStoreScope  ← THE CRITICAL SECURITY FIX
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tenant isolation — ensures staff/doctor can ONLY access their own store.
 *
 * Run AFTER isAuthenticated + requireStaff/requireDoctor.
 * Compares the storeId in the REQUEST (params or body) against req.user.storeId.
 *
 * Where storeId comes from in request:
 *   - Route params:  GET /api/stores/:storeId/doctors → req.params.storeId
 *   - Request body:  POST /api/queue/pause { storeId } → req.body.storeId
 *
 * RULE: The storeId in the route/body must match the logged-in user's storeId.
 * If not → 403. Staff A cannot touch Store B's data. Ever.
 *
 * Usage:
 *   router.get('/stores/:storeId/doctors', isAuthenticated, requireStaff, enforceStoreScope, controller)
 *   router.post('/stores/:storeId/departments', isAuthenticated, requireStaff, enforceStoreScope, controller)
 */
function enforceStoreScope(req, res, next) {
  // Pick up storeId from params first, then body as fallback
  const requestedStoreId = req.params.storeId || req.body.storeId;

  if (!requestedStoreId) {
    // If no storeId in request at all — the controller will use req.user.storeId directly
    // This is safe: controller derives storeId from authenticated user, not from client
    return next();
  }

  // .toString() because req.user.storeId is a MongoDB ObjectId, not a plain string
  if (requestedStoreId !== req.user.storeId?.toString()) {
    return res.status(403).json({
      error: 'Access denied. You can only access your own store.',
    });
  }

  next();
}

/**
 * Alternative: deriveStoreScope
 * For routes where the client does NOT send storeId in the request.
 * Instead, the controller should always derive storeId from req.user.storeId.
 *
 * Example: Staff adds a doctor → storeId comes from req.user.storeId, NOT from req.body
 * This prevents: "Staff sends storeId: HOSPITAL_B in body to create doctor there"
 *
 * Usage: explained in staff controller comments. Not a middleware — a pattern.
 */

module.exports = {
  isAuthenticated,
  requirePatient,
  requireStaff,
  requireDoctor,
  requireStaffOrDoctor,
  requirePlatformAdmin,
  enforceStoreScope,
};
