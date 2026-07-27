const Doctor = require('../../prescription/models/Doctor');

function serializePatient(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: 'PATIENT',
    age: user.age ?? null,
    gender: user.gender || '',
    bloodGroup: user.bloodGroup || '',
    allergies: Array.isArray(user.allergies) ? user.allergies : [],
    address: user.address || '',
    profilePicture: user.profilePicture || null,
  };
}

exports.getCurrentSession = async (req, res) => {
  try {
    const { user } = req;

    if (user.role === 'PATIENT') {
      return res.status(200).json({ user: serializePatient(user) });
    }

    if (user.role === 'DOCTOR') {
      const doctorProfile = await Doctor.findOne({ userId: user._id });
      if (!doctorProfile) {
        return res.status(404).json({ error: 'Doctor profile not found.' });
      }

      return res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: 'DOCTOR',
          storeId: user.storeId,
          department: doctorProfile.department,
          specialization: doctorProfile.specialization,
          isAvailable: doctorProfile.isAvailable,
          dailyPatientLimit: doctorProfile.dailyPatientLimit,
        },
      });
    }

    if (user.role === 'STAFF') {
      return res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: 'STAFF',
          storeId: user.storeId,
        },
      });
    }

    if (user.role === 'PLATFORM_ADMIN') {
      return res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: 'PLATFORM_ADMIN',
        },
      });
    }

    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  } catch (error) {
    console.error('Get Current Session Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
