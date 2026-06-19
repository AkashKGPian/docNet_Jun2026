const mongoose = require('mongoose');

/**
 * Doctor Model — DocNet MVP
 *
 * Stores the professional profile for a doctor account.
 * The auth identity lives in User; this document holds doctor-specific data.
 */
const DoctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    specialization: {
      type: String,
      default: '',
      trim: true,
    },

    isAvailable: {
      type: String,
      enum: ['AVAILABLE', 'PAUSED', 'ABSENT'],
      default: 'AVAILABLE',
    },

    dailyPatientLimit: {
      type: Number,
      default: 30,
      min: 1,
    },
  },
  { timestamps: true }
);

DoctorSchema.index({ storeId: 1, department: 1 });
DoctorSchema.index({ storeId: 1, isAvailable: 1 });

module.exports = mongoose.model('Doctor', DoctorSchema);