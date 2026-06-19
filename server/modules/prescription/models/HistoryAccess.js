const mongoose = require('mongoose');

/**
 * Patient-granted permission for a doctor to view prescription history.
 */
const HistoryAccessSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

HistoryAccessSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model('HistoryAccess', HistoryAccessSchema);
