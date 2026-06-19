const doctorService = require('../services/doctorManagement.service');
const Doctor = require('../../prescription/models/Doctor');
const { emitDoctorAvailabilityChanged } = require('../../store/helpers/queuePreview.helper');
const { getIO } = require('../../shared/socket');

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;
  const body = { error: error.message || fallbackMessage };
  if (error.existing) body.existing = true;
  return res.status(status).json(body);
}

exports.listDoctors = async (req, res) => {
  try {
    const doctors = await doctorService.listDoctors(req.user.storeId);
    return res.status(200).json({ success: true, doctors });
  } catch (error) {
    console.error('List Doctors Error:', error);
    return handleServiceError(res, error, 'Failed to list doctors.');
  }
};

exports.getDoctor = async (req, res) => {
  try {
    const doctor = await doctorService.getDoctor(req.user.storeId, req.params.doctorId);
    return res.status(200).json({ success: true, doctor });
  } catch (error) {
    console.error('Get Doctor Error:', error);
    return handleServiceError(res, error, 'Failed to get doctor.');
  }
};

exports.createDoctor = async (req, res) => {
  try {
    const doctor = await doctorService.createDoctorAccount(req.user.storeId, req.body);
    return res.status(201).json({
      success: true,
      message: 'Doctor created successfully',
      doctor,
    });
  } catch (error) {
    console.error('Create Doctor Error:', error);
    return handleServiceError(res, error, 'Internal server error while creating doctor.');
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const doctor = await doctorService.updateDoctorAccount(
      req.user.storeId,
      req.params.doctorId,
      req.body
    );

    if (req.body.isAvailable !== undefined) {
      try {
        const doctorDoc = await Doctor.findById(req.params.doctorId);
        if (doctorDoc) {
          await emitDoctorAvailabilityChanged(getIO(), doctorDoc);
        }
      } catch (socketError) {
        console.warn('Could not emit doctor availability update:', socketError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Doctor updated successfully',
      doctor,
    });
  } catch (error) {
    console.error('Update Doctor Error:', error);
    return handleServiceError(res, error, 'Failed to update doctor.');
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const result = await doctorService.deleteDoctorAccount(req.user.storeId, req.params.doctorId);
    return res.status(200).json({
      success: true,
      message: 'Doctor removed from roster',
      ...result,
    });
  } catch (error) {
    console.error('Delete Doctor Error:', error);
    return handleServiceError(res, error, 'Failed to delete doctor.');
  }
};

exports.getDemoTemplate = (_req, res) => {
  return res.status(200).json({
    success: true,
    template: doctorService.getDemoTemplate(),
    note: 'Same defaults as server/scripts/createDoctor.js — edit fields in the form before saving.',
  });
};

exports.seedDemoDoctor = async (req, res) => {
  try {
    const { doctor, template } = await doctorService.seedDemoDoctor(req.user.storeId, req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Demo doctor created (replaces running createDoctor.js manually)',
      doctor,
      template,
    });
  } catch (error) {
    console.error('Seed Demo Doctor Error:', error);
    return handleServiceError(res, error, 'Failed to seed demo doctor.');
  }
};

exports.listDepartments = async (req, res) => {
  try {
    const departments = await doctorService.listDepartments(req.user.storeId);
    return res.status(200).json({ success: true, departments });
  } catch (error) {
    console.error('List Departments Error:', error);
    return handleServiceError(res, error, 'Failed to list departments.');
  }
};

exports.addDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const departments = await doctorService.addDepartment(req.user.storeId, name);
    return res.status(201).json({
      success: true,
      message: 'Department added',
      departments,
    });
  } catch (error) {
    console.error('Add Department Error:', error);
    return handleServiceError(res, error, 'Failed to add department.');
  }
};

exports.removeDepartment = async (req, res) => {
  try {
    const departments = await doctorService.removeDepartment(req.user.storeId, req.params.name);
    return res.status(200).json({
      success: true,
      message: 'Department removed',
      departments,
    });
  } catch (error) {
    console.error('Remove Department Error:', error);
    return handleServiceError(res, error, 'Failed to remove department.');
  }
};

exports.renameDepartment = async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    const departments = await doctorService.renameDepartment(req.user.storeId, oldName, newName);
    return res.status(200).json({
      success: true,
      message: 'Department renamed',
      departments,
    });
  } catch (error) {
    console.error('Rename Department Error:', error);
    return handleServiceError(res, error, 'Failed to rename department.');
  }
};
