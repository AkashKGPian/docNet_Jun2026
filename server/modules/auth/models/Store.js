const mongoose = require('mongoose');

/**
 * Store Model — DocNet MVP
 *
 * Represents a Hospital, Clinic, or Pharmacy/Dispensary.
 *
 * Enhanced from SmartQ original which only had:
 *   { name, type, address, isActive }
 *
 * DocNet additions:
 *   - isOpen    → daily open/closed toggle (staff controls this each day)
 *   - departments[] → list of department names this store has
 *   - hasDispensary → does this hospital have an in-house dispensary?
 *
 * Two different "inactive" states — important distinction:
 *   isActive = false → admin permanently disabled this store (hidden from app)
 *   isOpen   = false → staff closed for today (visible but grayed, no queue joins)
 */
const StoreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ['HOSPITAL', 'PHARMACY', 'CLINIC'],
      required: true,
    },

    address: {
      type: String,
    },

    // ─── FROM SmartQ (unchanged) ───────────────────────────────────────────────
    // Admin-level disable — permanently disables the store without deleting data.
    // Used by system admin (not staff). Staff cannot change this.
    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── NEW: Daily open/closed toggle (staff controls this) ──────────────────
    // When false:
    //   - Hospital still appears in patient search (so patients know it exists)
    //   - All [Join Queue] buttons are DISABLED
    //   - All active queues are effectively paused
    //   - UI: hospital card is grayed out with "Closed Today" label
    isOpen: {
      type: Boolean,
      default: true,
    },

    // ─── NEW: Department list ─────────────────────────────────────────────────
    // Array of department name strings.
    // Example: ["General Medicine", "Dermatology", "Cardiology", "ENT"]
    //
    // Staff can:
    //   - Add a department → push string to this array
    //   - Rename a department → update here + update all Doctor.department values
    //   - Delete a department → only if NO Doctors currently assigned to it
    //
    // Doctors are linked to ONE department by string name (not ObjectId).
    // This means if a department is renamed, you must update both:
    //   1. Store.departments array
    //   2. All Doctor documents where Doctor.department === old name
    departments: [
      {
        type: String,
        trim: true,
      },
    ],

    // ─── NEW: Dispensary flag ─────────────────────────────────────────────────
    // true → this hospital has an in-house dispensary queue
    // false → patients must search for a standalone pharmacy
    //
    // When true, a "Dispensary" section appears at the bottom of the hospital
    // view page with its own queue (type: "DISPENSARY").
    hasDispensary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ─── INDEXES ────────────────────────────────────────────────────────────────

// Patient search: search by name (text) or type filter
// We use a plain index on `type` for filtered queries (e.g., only PHARMACies)
StoreSchema.index({ type: 1, isActive: 1, isOpen: 1 });

// Text search index — allows case-insensitive partial name/address search
// Usage: Store.find({ $text: { $search: "apollo" } })
StoreSchema.index({ name: 'text', address: 'text' });

module.exports = mongoose.model('Store', StoreSchema);
