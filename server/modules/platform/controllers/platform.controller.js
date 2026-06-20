const platformAdminService = require('../services/platformAdmin.service');

exports.listHospitals = async (req, res) => {
  try {
    const hospitals = await platformAdminService.listHospitals();
    return res.status(200).json({ hospitals });
  } catch (error) {
    console.error('List hospitals error:', error);
    return res.status(500).json({ error: 'Failed to load hospitals.' });
  }
};

exports.createHospital = async (req, res) => {
  try {
    const {
      hospitalName,
      staffEmail,
      staffName,
      staffPassword,
      staffPhone,
      address,
      departments,
      hasDispensary,
    } = req.body;

    const departmentsList =
      typeof departments === 'string'
        ? departments.split(',').map((d) => d.trim()).filter(Boolean)
        : departments;

    const result = await platformAdminService.createHospitalWithStaff({
      hospitalName,
      staffEmail,
      staffName,
      staffPassword,
      staffPhone,
      address,
      departments: departmentsList,
      hasDispensary,
    });

    const message = result.storeCreated && result.staffCreated
      ? 'Hospital and staff account created.'
      : result.staffCreated
        ? 'Staff account created for existing hospital.'
        : 'Hospital already exists with this staff account.';

    return res.status(result.storeCreated || result.staffCreated ? 201 : 200).json({
      message,
      ...result,
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to create hospital.' });
  }
};

exports.createDoctor = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      name,
      email,
      password,
      phone,
      department,
      specialization,
      dailyPatientLimit,
    } = req.body;

    const result = await platformAdminService.createDoctorForHospital(storeId, {
      name,
      email,
      password,
      phone,
      department,
      specialization,
      dailyPatientLimit,
    });

    return res.status(201).json({
      message: 'Doctor created successfully.',
      ...result,
    });
  } catch (error) {
    if (error.existing) {
      return res.status(409).json({ error: error.message, existing: true });
    }
    console.error('Create doctor error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to create doctor.' });
  }
};
