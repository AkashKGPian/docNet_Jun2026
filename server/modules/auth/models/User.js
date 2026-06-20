const mongoose = require('mongoose');

/**
 * User Model — DocNet MVP
 *
 * Handles authentication for all roles: PATIENT, STAFF, DOCTOR, PLATFORM_ADMIN.
 *
 * SECURITY: storeId is REQUIRED for STAFF and DOCTOR roles.
 * It is enforced at the application layer via the `pre('save')` hook below.
 * PATIENT always has storeId = null (they are not scoped to one store).
 *
 * Why storeId here AND in Doctor model?
 *   - User.storeId → fast auth middleware check without an extra DB lookup
 *   - Doctor.storeId → canonical source, used for doctor-specific queries
 *   - They MUST always match (enforced when staff creates a doctor)
 */
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['PATIENT', 'STAFF', 'DOCTOR', 'PLATFORM_ADMIN'],
      default: 'PATIENT',
    },

    // ─── TENANT SCOPING (SECURITY CRITICAL) ──────────────────────────────────
    // Required for STAFF and DOCTOR. Null for PATIENT.
    // This field lets middleware enforce: "staff can only touch their own store"
    // without needing an extra DB round-trip on every request.
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },

    // ─── PATIENT-ONLY PROFILE FIELDS ─────────────────────────────────────────
    // These are null/undefined for STAFF and DOCTOR roles.
    // Visible to doctors when viewing patient info before writing prescription.
    age: {
      type: Number,
    },

    gender: {
      type: String,
      enum: ['M', 'F', 'Other'],
    },

    bloodGroup: {
      type: String,  // e.g. "O+", "AB-"
    },

    allergies: [{ type: String }],  // e.g. ["Penicillin", "Aspirin"]

    address: {
      type: String,
    },

    profilePicture: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── INDEXES ────────────────────────────────────────────────────────────────

// Compound index for authorization queries:
//   "Is this user a STAFF member of store X?" → single index hit
//   "Find all DOCTOR users for store X?" → single index hit
UserSchema.index({ role: 1, storeId: 1 });

// ─── VALIDATION HOOK ─────────────────────────────────────────────────────────

// Enforce: STAFF and DOCTOR MUST have a storeId. PATIENT must NOT.
// This is the final safety net — the controller should also validate this,
// but the model-level hook catches bugs and bypasses.
UserSchema.pre('save', function (next) {
  if ((this.role === 'STAFF' || this.role === 'DOCTOR') && !this.storeId) {
    return next(
      new Error(`storeId is required for role ${this.role}. Every staff/doctor must belong to a store.`)
    );
  }
  if ((this.role === 'PATIENT' || this.role === 'PLATFORM_ADMIN') && this.storeId) {
    // Patients and platform admins are not store-scoped
    this.storeId = null;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
