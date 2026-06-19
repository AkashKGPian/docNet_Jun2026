const mongoose = require('mongoose');

/**
 * Token Model — DocNet MVP
 *
 * Modified from SmartQ. Two key changes:
 *
 * 1. `prescription` field:
 *    SmartQ: String (file path to a PDF/image, e.g. "/uploads/rx_123.pdf")
 *    DocNet: ObjectId (reference to a Prescription document in MongoDB)
 *    Why? We eliminated paper/PDFs. Prescription IS a MongoDB document now.
 *
 * 2. `prescriptionRef` field (NEW):
 *    Used ONLY for dispensary queue tokens.
 *    When patient sends a prescription to dispensary, this field links:
 *    Token (dispensary) → Prescription (doctor wrote this) → medicines to fill
 *
 * Token lifecycle (states):
 *
 *   WAITING → CALLED → SERVED
 *                ↘ MISSED (if not responded to within 3 minutes — auto by cron)
 *                ↘ CANCELED (patient leaves the queue voluntarily)
 *
 * A token is created when patient joins a queue.
 * It follows the patient through their entire visit.
 */
const TokenSchema = new mongoose.Schema(
  {
    // Which queue this token belongs to
    queueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      required: true,
    },

    // Denormalized for fast queries — "all tokens for store X today"
    // without needing to join Queue → Store
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },

    // Which patient holds this token
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The sequential token number (e.g. 1, 2, 3...)
    // Assigned from Queue.currentTokenNumber at join time
    // Never changes after assignment
    number: {
      type: Number,
      required: true,
    },

    // Current state of this token in the visit lifecycle
    status: {
      type: String,
      enum: ['WAITING', 'CALLED', 'SERVED', 'MISSED', 'CANCELED'],
      default: 'WAITING',
    },

    // Timestamp when doctor called this patient
    // null until doctor calls them
    calledAt: {
      type: Date,
      default: null,
    },

    // Timestamp when visit was completed (SERVED or MISSED)
    servedAt: {
      type: Date,
      default: null,
    },

    // ─── CHANGED FROM SmartQ ──────────────────────────────────────────────────
    // SmartQ stored a file path string: "/uploads/prescriptions/rx_abc.pdf"
    // DocNet stores an ObjectId reference to the Prescription collection.
    //
    // Set when the doctor confirms the prescription for this patient.
    // null → prescription not yet written (patient still waiting or just called)
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },

    // ─── NEW: For dispensary queue tokens only ────────────────────────────────
    // When a patient joins a dispensary queue, they carry a reference to
    // the prescription that needs to be filled.
    //
    // Flow:
    //   1. Doctor writes prescription → Prescription doc created
    //   2. Patient taps [Send to Dispensary] → sees prescription_id in URL
    //   3. Patient joins dispensary queue with prescriptionRef = prescription_id
    //   4. Dispensary staff opens this token → sees exact medicines to dispense
    //
    // null for DOCTOR queue tokens (doctor writes the prescription AFTER calling)
    prescriptionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
  },
  { timestamps: true }
);

// ─── INDEXES ────────────────────────────────────────────────────────────────

// Primary: "all tokens in this queue" — used to show doctor their patient list
// unique: true → patient cannot get two tokens with same number in one queue
TokenSchema.index({ queueId: 1, number: 1 }, { unique: true });

// "Find this patient's active tokens" — used for patient dashboard
TokenSchema.index({ patientId: 1, status: 1 });

// One active token per patient per queue (prevents double-join race conditions)
TokenSchema.index(
  { patientId: 1, queueId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['WAITING', 'CALLED'] } },
  }
);

// "All tokens for store today" — used for staff stats dashboard
TokenSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Token', TokenSchema);
