const User = require('../../auth/models/User');
const Store = require('../../auth/models/Store');
const Doctor = require('../../prescription/models/Doctor');
const { hashPassword } = require('../../auth/helpers/auth.helpers');
const doctorService = require('../../auth/services/doctorManagement.service');

const DEFAULT_DEPARTMENTS = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics'];

async function listHospitals() {
  const stores = await Store.find({ type: 'HOSPITAL' }).sort({ name: 1 }).lean();
  if (!stores.length) return [];

  const storeIds = stores.map((s) => s._id);

  const [staffByStore, doctorByStore] = await Promise.all([
    User.aggregate([
      { $match: { role: 'STAFF', storeId: { $in: storeIds } } },
      {
        $group: {
          _id: '$storeId',
          count: { $sum: 1 },
          staff: { $push: { name: '$name', email: '$email' } },
        },
      },
    ]),
    Doctor.aggregate([
      { $match: { storeId: { $in: storeIds } } },
      { $group: { _id: '$storeId', count: { $sum: 1 } } },
    ]),
  ]);

  const staffMap = Object.fromEntries(staffByStore.map((r) => [r._id.toString(), r]));
  const doctorMap = Object.fromEntries(doctorByStore.map((r) => [r._id.toString(), r.count]));

  return stores.map((store) => {
    const key = store._id.toString();
    const staffInfo = staffMap[key];
    return {
      _id: store._id,
      name: store.name,
      address: store.address,
      departments: store.departments || [],
      hasDispensary: store.hasDispensary,
      isActive: store.isActive,
      isOpen: store.isOpen,
      staffCount: staffInfo?.count || 0,
      staff: staffInfo?.staff || [],
      doctorCount: doctorMap[key] || 0,
      createdAt: store.createdAt,
    };
  });
}

async function createHospitalWithStaff(payload) {
  const hospitalName = payload.hospitalName?.trim();
  const staffEmail = payload.staffEmail?.trim().toLowerCase();
  const staffName = payload.staffName?.trim() || 'Hospital Admin';
  const staffPassword = payload.staffPassword || 'password123';
  const staffPhone = payload.staffPhone?.trim() || '9876543210';
  const address = payload.address?.trim() || 'Address not set';
  const departments = (payload.departments?.length
    ? payload.departments
    : DEFAULT_DEPARTMENTS
  )
    .map((d) => d.trim())
    .filter(Boolean);
  const hasDispensary = payload.hasDispensary !== false;

  if (!hospitalName || !staffEmail) {
    const error = new Error('Hospital name and staff email are required.');
    error.status = 400;
    throw error;
  }

  let store = await Store.findOne({ name: hospitalName, type: 'HOSPITAL' });
  let storeCreated = false;

  if (!store) {
    store = new Store({
      name: hospitalName,
      type: 'HOSPITAL',
      address,
      departments,
      hasDispensary,
    });
    await store.save();
    storeCreated = true;
  }

  let user = await User.findOne({ email: staffEmail });
  let staffCreated = false;

  if (!user) {
    const hashedPassword = await hashPassword(staffPassword);
    user = new User({
      name: staffName,
      email: staffEmail,
      passwordHash: hashedPassword,
      phone: staffPhone,
      role: 'STAFF',
      storeId: store._id,
    });
    await user.save();
    staffCreated = true;
  } else if (user.role !== 'STAFF') {
    const error = new Error(`Email ${staffEmail} is already used by a ${user.role} account.`);
    error.status = 409;
    throw error;
  } else if (user.storeId?.toString() !== store._id.toString()) {
    const error = new Error(
      `Staff ${staffEmail} already belongs to another hospital. Use a different email.`
    );
    error.status = 409;
    throw error;
  }

  return {
    store: {
      _id: store._id,
      name: store.name,
      address: store.address,
      departments: store.departments,
      hasDispensary: store.hasDispensary,
    },
    staff: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    credentials: {
      email: staffEmail,
      password: staffCreated ? staffPassword : undefined,
    },
    storeCreated,
    staffCreated,
  };
}

async function createDoctorForHospital(storeId, template = {}) {
  const store = await Store.findOne({ _id: storeId, type: 'HOSPITAL' });
  if (!store) {
    const error = new Error('Hospital not found.');
    error.status = 404;
    throw error;
  }

  const payload = {
    name: template.name || 'Dr. Demo',
    email: (template.email || 'demo.doctor@docnet.com').toLowerCase(),
    password: template.password || 'password123',
    phone: template.phone || '9868543210',
    department: template.department || 'General Medicine',
    specialization: template.specialization || 'General Physician',
    dailyPatientLimit: Number(template.dailyPatientLimit || 50),
  };

  try {
    const { doctor } = await doctorService.seedDemoDoctor(store._id, payload);
    return {
      hospital: { _id: store._id, name: store.name },
      doctor: doctorService.formatDoctorResponse(await Doctor.findById(doctor._id).populate('userId', 'name email phone')),
      credentials: {
        email: payload.email,
        password: payload.password,
      },
    };
  } catch (error) {
    if (error.existing) {
      error.status = 409;
    }
    throw error;
  }
}

module.exports = {
  listHospitals,
  createHospitalWithStaff,
  createDoctorForHospital,
};
