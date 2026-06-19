const Store = require('../../auth/models/Store');
const Doctor = require('../../prescription/models/Doctor');
const { attachDoctorQueuePreviews, emitDoctorAvailabilityChanged } = require('../helpers/queuePreview.helper');
const { getIO } = require('../../shared/socket');

exports.searchHospitals = async (req, res) => {
  try {
    const { query } = req.query;
    const filter = { isActive: true };

    if (query) {
      filter.$text = { $search: query };
    }

    const hospitals = await Store.find(filter)
      .select('-__v -createdAt -updatedAt')
      .sort({ isOpen: -1, name: 1 });

    return res.status(200).json({ success: true, count: hospitals.length, hospitals });
  } catch (error) {
    console.error('Search Hospitals Error:', error);
    return res.status(500).json({ error: 'Failed to search hospitals.' });
  }
};

exports.getHospitalDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const hospital = await Store.findById(id).select('-__v');
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ error: 'Hospital not found or inactive.' });
    }

    const doctors = await Doctor.find({ storeId: id })
      .populate('userId', 'name profilePicture')
      .select('-__v');

    const doctorsWithPreviews = await attachDoctorQueuePreviews(id, doctors);

    return res.status(200).json({ success: true, hospital, doctors: doctorsWithPreviews });
  } catch (error) {
    console.error('Get Hospital Details Error:', error);
    return res.status(500).json({ error: 'Failed to get hospital details.' });
  }
};

exports.getStaffStoreDetails = async (req, res) => {
  try {
    const storeId = req.user.storeId;

    const hospital = await Store.findById(storeId).select('-__v');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const doctors = await Doctor.find({ storeId })
      .populate('userId', 'name email phone profilePicture')
      .select('-__v');

    const doctorsWithQueues = await attachDoctorQueuePreviews(storeId, doctors);

    return res.status(200).json({
      success: true,
      hospital,
      doctors: doctorsWithQueues,
    });
  } catch (error) {
    console.error('Get Staff Store Details Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve staff store data.' });
  }
};

exports.updateDoctorAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { isAvailable } = req.body;

    if (!['AVAILABLE', 'PAUSED', 'ABSENT'].includes(isAvailable)) {
      return res.status(400).json({
        error: 'isAvailable must be one of AVAILABLE, PAUSED, or ABSENT.',
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    if (doctor.storeId.toString() !== req.user.storeId.toString()) {
      return res.status(403).json({ error: 'You can only manage doctors in your own hospital.' });
    }

    doctor.isAvailable = isAvailable;
    await doctor.save();

    try {
      const io = getIO();
      await emitDoctorAvailabilityChanged(io, doctor);
    } catch (socketError) {
      console.warn('Could not emit doctor availability update:', socketError.message);
    }

    return res.status(200).json({
      success: true,
      message: `Doctor availability updated to ${isAvailable}.`,
      doctor,
    });
  } catch (error) {
    console.error('Update Doctor Availability Error:', error);
    return res.status(500).json({ error: 'Failed to update doctor availability.' });
  }
};
