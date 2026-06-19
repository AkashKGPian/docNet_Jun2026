const mongoose = require('mongoose');

const DoctorVocabSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, unique: true },
  words: {
    type: Map,
    of: Number,   // e.g. { "Amoxicillin": 47, "Pantoprazole": 32 }
    default: {}
  },
}, { timestamps: true });

module.exports = mongoose.model('DoctorVocab', DoctorVocabSchema);
