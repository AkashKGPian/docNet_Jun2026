const mongoose = require('mongoose');

/**
 * Queue Model — DocNet MVP
 *
 * Modified from SmartQ. Key change:
 *   SmartQ: one queue per store per type per day
 *           unique index: { storeId, type, date }
 *
 *   DocNet: one queue per DOCTOR per day (for DOCTOR type)
 *           one queue per store for DISPENSARY (doctorId = null)
 *           unique index: { storeId, type, doctorId, date }
 *
 * This means:
 *   - Dr. Sharma gets their OWN queue → patients choose a specific doctor
 *   - Dr. Mehta gets their OWN queue → independent of Dr. Sharma's queue
 *   - Hospital's dispensary gets ONE shared queue (no doctorId)
 *
 * SmartQ had one queue for ALL doctors → patients got a generic token.
 * DocNet separates: each doctor manages their own patient list.
 */
const QueueSchema = new mongoose.Schema(
  {
    // Which hospital/clinic/pharmacy this queue belongs to
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },

    // Queue type:
    //   DOCTOR     → for a specific doctor's patient queue
    //   DISPENSARY → for the hospital's medicine dispensary
    type: {
      type: String,
      enum: ['DOCTOR', 'DISPENSARY'],
      required: true,
    },

    // Which doctor this queue belongs to.
    // null for DISPENSARY queues (dispensary is store-scoped, not doctor-scoped)
    // Required (non-null) for DOCTOR queues
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },

    // Date this queue is for. Format: "YYYY-MM-DD"
    // A new queue is created each day via getOrCreateQueue()
    // Old queues are kept for historical/reporting purposes (not deleted)
    date: {
      type: String,
      required: true,
    },

    // Whether the queue is currently paused
    // When true: existing tokens stay WAITING, but no new joins allowed
    // Doctor or Staff can pause/resume
    isPaused: {
      type: Boolean,
      default: false,
    },

    // The token number that was last issued.
    // Each new token increments this by 1.
    // Never decrements (even if tokens are cancelled).
    // Example: if 5 patients joined and 2 cancelled, currentTokenNumber = 5
    //          but only 3 WAITING tokens exist
    currentTokenNumber: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── INDEXES ────────────────────────────────────────────────────────────────

// MODIFIED from SmartQ (was: { storeId, type, date })
// Now: each doctor gets their own unique queue per day
// doctorId = null for DISPENSARY → still unique per store+type+date for dispensary
QueueSchema.index(
  { storeId: 1, type: 1, doctorId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model('Queue', QueueSchema);
