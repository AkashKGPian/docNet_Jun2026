const User = require('../models/User');
const Store = require('../models/Store');
const Doctor = require('../../prescription/models/Doctor');
const Token = require('../../queue/models/Token');
const Queue = require('../../queue/models/Queue');
const { hashPassword } = require('../helpers/auth.helpers');

const DEMO_DOCTOR_TEMPLATE = {
  name: 'Dr. Chavla',
  email: 'chavla@docnet.com',
  password: 'password123',
  phone: '9868543211',
  department: 'Cardiology',
  specialization: 'Cardiologist',
  dailyPatientLimit: 50,
};

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

async function getStoreForStaff(storeId) {
  const store = await Store.findById(storeId);
  if (!store) {
    const error = new Error('Hospital not found.');
    error.status = 404;
    throw error;
  }
  return store;
}

async function assertStoreDoctor(doctorId, storeId) {
  const doctor = await Doctor.findById(doctorId).populate('userId', 'name email phone role storeId');
  if (!doctor) {
    const error = new Error('Doctor not found.');
    error.status = 404;
    throw error;
  }
  if (doctor.storeId.toString() !== storeId.toString()) {
    const error = new Error('You can only manage doctors in your own hospital.');
    error.status = 403;
    throw error;
  }
  return doctor;
}

function formatDoctorResponse(doctor) {
  const user = doctor.userId;
  return {
    _id: doctor._id,
    userId: user?._id || doctor.userId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone || '',
    department: doctor.department,
    specialization: doctor.specialization,
    dailyPatientLimit: doctor.dailyPatientLimit,
    isAvailable: doctor.isAvailable,
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
  };
}

async function listDoctors(storeId) {
  const doctors = await Doctor.find({ storeId })
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 });
  return doctors.map(formatDoctorResponse);
}

async function getDoctor(storeId, doctorId) {
  const doctor = await assertStoreDoctor(doctorId, storeId);
  return formatDoctorResponse(doctor);
}

async function createDoctorAccount(storeId, payload) {
  const {
    name,
    email,
    password,
    phone,
    department,
    specialization,
    dailyPatientLimit,
    isAvailable = 'AVAILABLE',
  } = payload;

  if (!name || !email || !password || !department) {
    const error = new Error('Name, email, password, and department are required.');
    error.status = 400;
    throw error;
  }

  const store = await getStoreForStaff(storeId);
  if (!store.departments.includes(department)) {
    const error = new Error(
      `Department '${department}' does not exist in this hospital. Add it under Departments first.`
    );
    error.status = 400;
    throw error;
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error('Email is already registered.');
    error.status = 409;
    throw error;
  }

  const hashedPassword = await hashPassword(password);
  const newUser = new User({
    name,
    email: email.toLowerCase(),
    passwordHash: hashedPassword,
    phone: phone || undefined,
    role: 'DOCTOR',
    storeId,
  });

  try {
    await newUser.save();

    const newDoctor = new Doctor({
      userId: newUser._id,
      storeId,
      department,
      specialization: specialization || '',
      dailyPatientLimit: dailyPatientLimit || 30,
      isAvailable: ['AVAILABLE', 'PAUSED', 'ABSENT'].includes(isAvailable) ? isAvailable : 'AVAILABLE',
    });

    await newDoctor.save();
    await newDoctor.populate('userId', 'name email phone');
    return formatDoctorResponse(newDoctor);
  } catch (saveError) {
    if (newUser._id) {
      await User.findByIdAndDelete(newUser._id);
    }
    throw saveError;
  }
}

async function updateDoctorAccount(storeId, doctorId, updates) {
  const doctor = await assertStoreDoctor(doctorId, storeId);
  const user = doctor.userId;

  const {
    name,
    email,
    phone,
    password,
    department,
    specialization,
    dailyPatientLimit,
    isAvailable,
  } = updates;

  if (department !== undefined) {
    const store = await getStoreForStaff(storeId);
    if (!store.departments.includes(department)) {
      const error = new Error(`Department '${department}' does not exist in this hospital.`);
      error.status = 400;
      throw error;
    }
    doctor.department = department;
  }

  if (specialization !== undefined) doctor.specialization = specialization;
  if (dailyPatientLimit !== undefined) doctor.dailyPatientLimit = Number(dailyPatientLimit) || 30;
  if (isAvailable !== undefined) {
    if (!['AVAILABLE', 'PAUSED', 'ABSENT'].includes(isAvailable)) {
      const error = new Error('isAvailable must be AVAILABLE, PAUSED, or ABSENT.');
      error.status = 400;
      throw error;
    }
    doctor.isAvailable = isAvailable;
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  if (email !== undefined && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (existing) {
      const error = new Error('Email is already registered.');
      error.status = 409;
      throw error;
    }
    user.email = email.toLowerCase();
  }

  if (password) {
    user.passwordHash = await hashPassword(password);
  }

  await user.save();
  await doctor.save();
  await doctor.populate('userId', 'name email phone');
  return formatDoctorResponse(doctor);
}

async function deleteDoctorAccount(storeId, doctorId) {
  const doctor = await assertStoreDoctor(doctorId, storeId);
  const userId = doctor.userId._id || doctor.userId;

  const today = getTodayDateString();
  const queues = await Queue.find({ storeId, doctorId, date: today }).select('_id');
  const queueIds = queues.map((q) => q._id);

  if (queueIds.length > 0) {
    const waitingCount = await Token.countDocuments({
      queueId: { $in: queueIds },
      status: { $in: ['WAITING', 'CALLED'] },
    });
    if (waitingCount > 0) {
      const error = new Error(
        'Cannot remove doctor while patients are waiting in their queue today. Mark them absent instead.'
      );
      error.status = 409;
      throw error;
    }
  }

  await Doctor.findByIdAndDelete(doctorId);
  await User.findByIdAndDelete(userId);
  return { deleted: true, doctorId };
}

async function addDepartment(storeId, departmentName) {
  const name = (departmentName || '').trim();
  if (!name) {
    const error = new Error('Department name is required.');
    error.status = 400;
    throw error;
  }

  const store = await getStoreForStaff(storeId);
  if (store.departments.includes(name)) {
    const error = new Error(`Department '${name}' already exists.`);
    error.status = 409;
    throw error;
  }

  store.departments.push(name);
  await store.save();
  return store.departments;
}

async function removeDepartment(storeId, departmentName) {
  const name = decodeURIComponent(departmentName || '').trim();
  const store = await getStoreForStaff(storeId);

  const assignedCount = await Doctor.countDocuments({ storeId, department: name });
  if (assignedCount > 0) {
    const error = new Error(
      `Cannot remove '${name}' — ${assignedCount} doctor(s) are still assigned. Reassign them first.`
    );
    error.status = 409;
    throw error;
  }

  store.departments = store.departments.filter((dept) => dept !== name);
  await store.save();
  return store.departments;
}

async function renameDepartment(storeId, oldName, newName) {
  const from = (oldName || '').trim();
  const to = (newName || '').trim();

  if (!from || !to) {
    const error = new Error('Both old and new department names are required.');
    error.status = 400;
    throw error;
  }

  const store = await getStoreForStaff(storeId);
  if (!store.departments.includes(from)) {
    const error = new Error(`Department '${from}' not found.`);
    error.status = 404;
    throw error;
  }
  if (from !== to && store.departments.includes(to)) {
    const error = new Error(`Department '${to}' already exists.`);
    error.status = 409;
    throw error;
  }

  store.departments = store.departments.map((dept) => (dept === from ? to : dept));
  await store.save();
  await Doctor.updateMany({ storeId, department: from }, { department: to });
  return store.departments;
}

async function seedDemoDoctor(storeId, template = {}) {
  const payload = { ...DEMO_DOCTOR_TEMPLATE, ...template };
  const existing = await User.findOne({ email: payload.email.toLowerCase() });
  if (existing) {
    const error = new Error(`Demo doctor already exists: ${payload.email}`);
    error.status = 409;
    error.existing = true;
    throw error;
  }

  const store = await getStoreForStaff(storeId);
  if (!store.departments.includes(payload.department)) {
    store.departments.push(payload.department);
    await store.save();
  }

  const doctor = await createDoctorAccount(storeId, payload);
  return { doctor, template: payload };
}

async function listDepartments(storeId) {
  const store = await getStoreForStaff(storeId);
  return store.departments;
}

function getDemoTemplate() {
  return { ...DEMO_DOCTOR_TEMPLATE };
}

module.exports = {
  DEMO_DOCTOR_TEMPLATE,
  listDoctors,
  getDoctor,
  createDoctorAccount,
  updateDoctorAccount,
  deleteDoctorAccount,
  addDepartment,
  removeDepartment,
  renameDepartment,
  seedDemoDoctor,
  listDepartments,
  getDemoTemplate,
  formatDoctorResponse,
};
