const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const DoctorVocab = require('../models/DoctorVocab');
const HistoryAccess = require('../models/HistoryAccess');
const Token = require('../../queue/models/Token');
const { parseRowText } = require('../services/parser.service');
const { enhanceClinicalNotes, fallbackRowParse } = require('../services/gemini.service');
const { normalizeMedicines, buildMedicineWordIncrements } = require('../helpers/prescription.helpers');
const { getIO } = require('../../shared/socket');

async function doctorHasHistoryAccess(doctorProfileId, patientId) {
  if (!doctorProfileId || !patientId) return false;

  const access = await HistoryAccess.findOne({
    patientId,
    doctorId: doctorProfileId,
    approved: true,
  });

  return Boolean(access);
}

async function assertPrescriptionReadAccess(req, prescription) {
  const patientId = prescription.patientId._id?.toString() || prescription.patientId.toString();

  if (req.user.role === 'PATIENT') {
    if (patientId !== req.user._id.toString()) {
      return { allowed: false, status: 403, error: 'You can only view your own prescriptions.' };
    }
    return { allowed: true };
  }

  if (req.user.role === 'DOCTOR') {
    const doctorProfile = await Doctor.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return { allowed: false, status: 403, error: 'Doctor profile not found.' };
    }

    const prescribingDoctorId =
      prescription.doctorId._id?.toString() || prescription.doctorId.toString();

    if (prescribingDoctorId === doctorProfile._id.toString()) {
      return { allowed: true };
    }

    const hasAccess = await doctorHasHistoryAccess(doctorProfile._id, patientId);
    if (!hasAccess) {
      return {
        allowed: false,
        status: 403,
        error: 'This patient has not approved access to their prescription history.',
      };
    }

    return { allowed: true };
  }

  return { allowed: false, status: 403, error: 'You are not allowed to view this prescription.' };
}

exports.processPrescription = async (req, res) => {
  try {
    const { rawRows = [], clinicalNotes = '', patientId, tokenId } = req.body;
    const doctorUserId = req.user._id;

    const doctorProfile = await Doctor.findOne({ userId: doctorUserId });
    if (!doctorProfile) {
      return res.status(403).json({ error: 'Doctor profile not found.' });
    }

    const isConsultationOnly = rawRows.length === 0;
    const processedMedicines = [];

    for (const row of rawRows) {
      let structured = parseRowText(row.text, row.drugMatchedFromFuse || '');

      if (!structured.dose && !structured.frequency && row.text.length > 5) {
        structured = await fallbackRowParse(row.text);
      }

      processedMedicines.push(structured);
    }

    const drugNamesArray = processedMedicines.map((medicine) => medicine.drug).filter(Boolean);
    const aiResult = await enhanceClinicalNotes(drugNamesArray, clinicalNotes);

    const draft = new Prescription({
      patientId,
      doctorId: doctorProfile._id,
      storeId: doctorProfile.storeId,
      tokenId: tokenId || null,
      type: isConsultationOnly ? 'consultation' : 'prescription',
      heading: aiResult.heading,
      medicines: processedMedicines,
      clinicalNotes: aiResult.correctedNotes,
      rawText: rawRows.map((row) => row.text).join(' | '),
      status: 'draft',
    });

    await draft.save();

    return res.status(200).json({
      message: 'Processing complete.',
      prescription: draft,
    });
  } catch (error) {
    console.error('Process Prescription Error:', error);
    return res.status(500).json({ error: 'Internal server error processing prescription.' });
  }
};

exports.confirmPrescriptionFromCanvas = async (req, res) => {
  try {
    const { tokenId, medicines = [], notes = '', clinicalNotes = '', heading = '' } = req.body;

    if (!tokenId) {
      return res.status(400).json({ error: 'tokenId is required.' });
    }

    const normalizedMedicines = normalizeMedicines(medicines);
    if (normalizedMedicines.length === 0 && !notes && !clinicalNotes) {
      return res.status(400).json({ error: 'Prescription cannot be empty.' });
    }

    const doctorProfile = await Doctor.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return res.status(403).json({ error: 'Doctor profile not found.' });
    }

    const token = await Token.findById(tokenId).populate('queueId');
    if (!token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    if (
      token.queueId.type === 'DOCTOR' &&
      token.queueId.doctorId?.toString() !== doctorProfile._id.toString()
    ) {
      return res.status(403).json({ error: 'You can only finalize prescriptions for your own queue.' });
    }

    const drugNamesArray = normalizedMedicines.map((medicine) => medicine.drug);
    const aiResult = await enhanceClinicalNotes(drugNamesArray, clinicalNotes || notes);

    const prescription = new Prescription({
      patientId: token.patientId,
      doctorId: doctorProfile._id,
      storeId: doctorProfile.storeId,
      tokenId: token._id,
      type: normalizedMedicines.length > 0 ? 'prescription' : 'consultation',
      heading: heading || aiResult.heading,
      medicines: normalizedMedicines,
      clinicalNotes: aiResult.correctedNotes || clinicalNotes || notes,
      rawText: '',
      status: 'confirmed',
    });

    await prescription.save();

    token.status = 'SERVED';
    token.servedAt = new Date();
    token.prescription = prescription._id;
    await token.save();

    const incObj = buildMedicineWordIncrements(normalizedMedicines);
    if (Object.keys(incObj).length > 0) {
      await DoctorVocab.findOneAndUpdate(
        { doctorId: doctorProfile._id },
        { $inc: incObj },
        { upsert: true }
      );
    }

    try {
      const io = getIO();
      io.to(`queue:${token.queueId._id}`).emit('queue:token_completed', {
        completedTokenId: token._id,
        status: 'SERVED',
      });
      io.to(`user:${token.patientId}`).emit('token:prescription_ready', {
        prescriptionId: prescription._id,
        doctorName: req.user.name,
      });
    } catch (socketError) {
      // Socket.IO is optional for local startup; the prescription still saves.
    }

    return res.status(200).json({
      success: true,
      message: 'Prescription finalized successfully.',
      prescription,
    });
  } catch (error) {
    console.error('Confirm Prescription Error:', error);
    return res.status(500).json({ error: 'Internal server error confirming prescription.' });
  }
};

exports.getPatientPrescriptions = async (req, res) => {
  try {
    let patientId = req.params.patientId || req.user._id.toString();

    if (req.user.role === 'PATIENT') {
      patientId = req.user._id.toString();
    } else if (req.user.role === 'DOCTOR') {
      if (!req.params.patientId) {
        return res.status(400).json({ error: 'patientId is required for doctor history lookup.' });
      }

      const doctorProfile = await Doctor.findOne({ userId: req.user._id });
      if (!doctorProfile) {
        return res.status(403).json({ error: 'Doctor profile not found.' });
      }

      const hasAccess = await doctorHasHistoryAccess(doctorProfile._id, req.params.patientId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'This patient has not approved access to their prescription history.',
        });
      }

      patientId = req.params.patientId;
    } else {
      return res.status(403).json({ error: 'You are not allowed to view patient prescription history.' });
    }

    const history = await Prescription.find({ patientId, status: 'confirmed' })
      .sort({ createdAt: -1 })
      .populate({
        path: 'doctorId',
        select: 'department specialization userId',
        populate: { path: 'userId', select: 'name' },
      })
      .populate('storeId', 'name address type');

    return res.status(200).json({ success: true, count: history.length, history });
  } catch (error) {
    console.error('Fetch Patient History Error:', error);
    return res.status(500).json({ error: 'Internal server error fetching patient history.' });
  }
};

exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patientId', 'name age gender allergies')
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' },
      })
      .populate('storeId', 'name address');

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    const access = await assertPrescriptionReadAccess(req, prescription);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.error });
    }

    return res.status(200).json({ success: true, prescription });
  } catch (error) {
    console.error('Get Prescription Error:', error);
    return res.status(500).json({ error: 'Internal server error fetching prescription.' });
  }
};

exports.grantHistoryAccess = async (req, res) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required.' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    const access = await HistoryAccess.findOneAndUpdate(
      { patientId: req.user._id, doctorId },
      { approved: true, approvedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Prescription history access granted.',
      access,
    });
  } catch (error) {
    console.error('Grant History Access Error:', error);
    return res.status(500).json({ error: 'Failed to grant history access.' });
  }
};

exports.revokeHistoryAccess = async (req, res) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required.' });
    }

    await HistoryAccess.findOneAndUpdate(
      { patientId: req.user._id, doctorId },
      { approved: false, approvedAt: null }
    );

    return res.status(200).json({
      success: true,
      message: 'Prescription history access revoked.',
    });
  } catch (error) {
    console.error('Revoke History Access Error:', error);
    return res.status(500).json({ error: 'Failed to revoke history access.' });
  }
};

exports.listHistoryAccess = async (req, res) => {
  try {
    const accessList = await HistoryAccess.find({ patientId: req.user._id, approved: true })
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' },
      })
      .sort({ approvedAt: -1 });

    return res.status(200).json({ success: true, accessList });
  } catch (error) {
    console.error('List History Access Error:', error);
    return res.status(500).json({ error: 'Failed to load history access list.' });
  }
};

module.exports.doctorHasHistoryAccess = doctorHasHistoryAccess;
