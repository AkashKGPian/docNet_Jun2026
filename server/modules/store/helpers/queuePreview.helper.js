const Queue = require('../../queue/models/Queue');
const Token = require('../../queue/models/Token');

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

async function getWaitingCountByQueueIds(queueIds) {
  if (!queueIds.length) return new Map();

  const rows = await Token.aggregate([
    { $match: { queueId: { $in: queueIds }, status: 'WAITING' } },
    { $group: { _id: '$queueId', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

function buildQueuePreview(doctor, queue, waitingCount) {
  const isAccepting =
    doctor.isAvailable === 'AVAILABLE' && queue && !queue.isPaused;

  return {
    queueId: queue?._id || null,
    waitingCount,
    patientsAheadIfJoin: isAccepting ? waitingCount : null,
    isPaused: Boolean(queue?.isPaused),
    isLive: isAccepting,
  };
}

async function attachDoctorQueuePreviews(storeId, doctors) {
  const today = getTodayDateString();
  const queues = await Queue.find({
    storeId,
    type: 'DOCTOR',
    date: today,
  }).select('_id doctorId isPaused currentTokenNumber');

  const queueByDoctor = new Map(queues.map((queue) => [queue.doctorId?.toString(), queue]));
  const waitingByQueue = await getWaitingCountByQueueIds(queues.map((queue) => queue._id));

  return doctors.map((doctor) => {
    const doctorObj = doctor.toObject ? doctor.toObject() : doctor;
    const queue = queueByDoctor.get(doctor._id.toString());
    const waitingCount = queue ? waitingByQueue.get(queue._id.toString()) || 0 : 0;
    const queuePreview = buildQueuePreview(doctorObj, queue, waitingCount);

    const enriched = {
      ...doctorObj,
      queuePreview,
    };

    if (queue) {
      enriched.todayQueue = {
        queueId: queue._id,
        isPaused: queue.isPaused,
        currentTokenNumber: queue.currentTokenNumber,
        waitingCount,
      };
    }

    return enriched;
  });
}

async function emitStoreQueuePreview(io, storeId, doctorId, queueId) {
  if (!io || !storeId || !queueId) return;

  const waitingCount = await Token.countDocuments({
    queueId,
    status: 'WAITING',
  });

  io.to(`store:${storeId}`).emit('store:queue_preview', {
    storeId: storeId.toString(),
    doctorId: doctorId ? doctorId.toString() : null,
    queueId: queueId.toString(),
    waitingCount,
    patientsAheadIfJoin: waitingCount,
  });
}

async function emitDoctorAvailabilityChanged(io, doctor) {
  if (!io || !doctor?.storeId) return;

  const storeId = doctor.storeId;
  const today = getTodayDateString();
  const queue = await Queue.findOne({
    storeId,
    type: 'DOCTOR',
    doctorId: doctor._id,
    date: today,
  }).select('_id isPaused currentTokenNumber');

  const waitingCount = queue
    ? await Token.countDocuments({ queueId: queue._id, status: 'WAITING' })
    : 0;

  const queuePreview = buildQueuePreview(
    { isAvailable: doctor.isAvailable },
    queue,
    waitingCount
  );

  io.to(`store:${storeId}`).emit('store:doctor_availability', {
    storeId: storeId.toString(),
    doctorId: doctor._id.toString(),
    isAvailable: doctor.isAvailable,
    queuePreview,
    waitingCount,
  });

  if (queue && doctor.isAvailable === 'AVAILABLE') {
    await emitStoreQueuePreview(io, storeId, doctor._id, queue._id);
  }
}

module.exports = {
  getTodayDateString,
  attachDoctorQueuePreviews,
  emitStoreQueuePreview,
  emitDoctorAvailabilityChanged,
  buildQueuePreview,
};
