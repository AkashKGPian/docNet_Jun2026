const Queue = require('../../queue/models/Queue');
const Token = require('../../queue/models/Token');
const Doctor = require('../../prescription/models/Doctor');
const Store = require('../../auth/models/Store');
const HistoryAccess = require('../../prescription/models/HistoryAccess');
const { getIO } = require('../../shared/socket');
const { markStaleCalledTokensForQueue } = require('../services/queue.worker');
const { emitStoreQueuePreview } = require('../../store/helpers/queuePreview.helper');

/**
 * Helper: Get today's queue for a specific doctor/dispensary, or create it if it doesn't exist.
 * Ensures only ONE queue exists per doctor per day.
 *
 * @param {ObjectId} storeId  - Hospital ID
 * @param {string} type       - 'DOCTOR' or 'DISPENSARY'
 * @param {ObjectId} doctorId - Doctor ID (null for DISPENSARY)
 * @returns {Promise<Document>} Queue document
 */
async function getOrCreateQueue(storeId, type, doctorId = null) {
  // Use today's date in YYYY-MM-DD format (local time approximation for MVP)
  const today = new Date().toISOString().split('T')[0];

  // Atomic find-or-create using findOneAndUpdate with upsert: true
  // Prevents race conditions if two patients try to join at the exact same millisecond
  const queue = await Queue.findOneAndUpdate(
    { storeId, type, doctorId, date: today },
    {
      $setOnInsert: {
        storeId,
        type,
        doctorId,
        date: today,
        isPaused: false,
        currentTokenNumber: 0,
      },
    },
    { new: true, upsert: true }
  );

  return queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT JOINS QUEUE
// ─────────────────────────────────────────────────────────────────────────────
exports.joinQueue = async (req, res) => {
  try {
    const { storeId, type, doctorId, prescriptionRef, grantHistoryAccess = true } = req.body;
    const patientId = req.user._id;

    // 1. Basic Validation
    if (!storeId || !type) {
      return res.status(400).json({ error: 'storeId and type are required.' });
    }
    if (type !== 'DOCTOR' && type !== 'DISPENSARY') {
      return res.status(400).json({ error: 'Invalid queue type.' });
    }
    if (type === 'DOCTOR' && !doctorId) {
      return res.status(400).json({ error: 'doctorId is required for DOCTOR queues.' });
    }
    if (type === 'DISPENSARY' && !prescriptionRef) {
      return res.status(400).json({ error: 'prescriptionRef is required for DISPENSARY queues.' });
    }

    // 2. Check Hospital Status
    const store = await Store.findById(storeId);
    if (!store || !store.isActive) {
      return res.status(404).json({ error: 'Hospital not found or suspended.' });
    }
    if (!store.isOpen) {
      return res.status(403).json({ error: 'Hospital is closed for today. Cannot join queue.' });
    }
    if (type === 'DISPENSARY' && !store.hasDispensary) {
      return res.status(400).json({ error: 'This hospital does not have an in-house dispensary.' });
    }

    // 3. DOCTOR Queue Validations
    let doctorProfile = null;
    if (type === 'DOCTOR') {
      doctorProfile = await Doctor.findById(doctorId);
      if (!doctorProfile) {
        return res.status(404).json({ error: 'Doctor not found.' });
      }
      if (doctorProfile.storeId.toString() !== storeId) {
        return res.status(400).json({ error: 'Doctor does not belong to this hospital.' });
      }
      if (doctorProfile.isAvailable === 'ABSENT') {
        return res.status(403).json({ error: 'Doctor is absent today. Cannot join queue.' });
      }
      if (doctorProfile.isAvailable === 'PAUSED') {
        return res.status(403).json({ error: 'Doctor is not accepting new patients right now.' });
      }
    }

    // 4. Resolve today's queue (create shell if needed — increment happens later)
    const targetQueue = await getOrCreateQueue(storeId, type, type === 'DOCTOR' ? doctorId : null);

    if (targetQueue.isPaused) {
      return res.status(403).json({ error: 'This queue is currently paused.' });
    }

    // 5. Duplicate check — scoped to THIS queue, not just the hospital
    const existingInQueue = await Token.findOne({
      patientId,
      queueId: targetQueue._id,
    }).sort({ createdAt: -1 });

    if (existingInQueue) {
      if (['WAITING', 'CALLED'].includes(existingInQueue.status)) {
        const positionAhead = await Token.countDocuments({
          queueId: targetQueue._id,
          status: 'WAITING',
          number: { $lt: existingInQueue.number },
        });

        return res.status(409).json({
          error:
            type === 'DOCTOR'
              ? 'You already have an active token with this doctor. You can still join other doctors\' queues.'
              : 'You are already in the dispensary queue.',
          token: {
            _id: existingInQueue._id,
            number: existingInQueue.number,
            status: existingInQueue.status,
            queueId: targetQueue._id,
            positionAhead,
          },
        });
      }

      if (existingInQueue.status === 'SERVED') {
        return res.status(409).json({
          error:
            type === 'DOCTOR'
              ? 'You already completed your visit with this doctor today.'
              : 'You already completed your dispensary visit today.',
        });
      }

      // MISSED or CANCELED — allow patient to join again (falls through)
    }

    // 6. Atomically increment token number
    const updatedQueue = await Queue.findOneAndUpdate(
      { _id: targetQueue._id },
      { $inc: { currentTokenNumber: 1 } },
      { new: true }
    );

    if (type === 'DOCTOR' && updatedQueue.currentTokenNumber > doctorProfile.dailyPatientLimit) {
      await Queue.findByIdAndUpdate(updatedQueue._id, { $inc: { currentTokenNumber: -1 } });
      return res.status(403).json({ error: 'Doctor has reached their daily patient limit.' });
    }

    const tokenNumber = updatedQueue.currentTokenNumber;

    // 7. Create the Token
    let newToken;
    try {
      newToken = await Token.create({
        queueId: updatedQueue._id,
        storeId,
        patientId,
        number: tokenNumber,
        status: 'WAITING',
        prescriptionRef: type === 'DISPENSARY' ? prescriptionRef : null,
      });
    } catch (saveError) {
      await Queue.findByIdAndUpdate(updatedQueue._id, { $inc: { currentTokenNumber: -1 } });
      if (saveError.code === 11000) {
        return res.status(409).json({ error: 'You are already in this doctor\'s queue.' });
      }
      throw saveError;
    }

    if (type === 'DOCTOR' && grantHistoryAccess) {
      await HistoryAccess.findOneAndUpdate(
        { patientId, doctorId },
        { approved: true, approvedAt: new Date() },
        { upsert: true }
      );
    }

    // 7. Calculate position ahead
    const positionAhead = await Token.countDocuments({
      queueId: updatedQueue._id,
      status: 'WAITING',
      number: { $lt: tokenNumber },
    });

    // 8. Emit Real-Time Updates
    const io = getIO();
    io.to(`queue:${updatedQueue._id}`).emit('queue:joined', { tokenNumber, positionAhead });
    await emitStoreQueuePreview(io, storeId, doctorId, updatedQueue._id);

    return res.status(201).json({
      message: 'Successfully joined queue.',
      token: {
        _id: newToken._id,
        number: tokenNumber,
        status: newToken.status,
        queueId: updatedQueue._id,
        isPaused: updatedQueue.isPaused,
        positionAhead,
      },
    });
  } catch (error) {
    console.error('Join Queue Error:', error);
    return res.status(500).json({ error: 'Internal server error while joining queue.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR CALLS TOKEN (Non-Sequential)
// ─────────────────────────────────────────────────────────────────────────────
exports.callToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const doctorUserId = req.user._id;

    // 1. Find the token
    const token = await Token.findById(tokenId).populate('queueId');
    if (!token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    // 2. Authorization: Is this my queue?
    // Token -> Queue -> doctorId must match logged-in user's Doctor profile
    if (token.queueId.type === 'DOCTOR') {
      const doctorProfile = await Doctor.findOne({ userId: doctorUserId });
      if (!doctorProfile) {
        return res.status(403).json({ error: 'Doctor profile not found.' });
      }
      if (token.queueId.doctorId.toString() !== doctorProfile._id.toString()) {
        return res.status(403).json({ error: 'You can only call tokens from your own queue.' });
      }
    } else {
      // It's a DISPENSARY queue — only staff should be calling these
      return res.status(400).json({ error: 'Doctors cannot call dispensary tokens.' });
    }

    // 3. State Check
    if (token.status !== 'WAITING') {
      return res.status(400).json({ error: `Token is already ${token.status}.` });
    }

    // 4. Real-time safeguard: mark stale CALLED tokens in this queue as MISSED.
    await markStaleCalledTokensForQueue(token.queueId._id);

    // 5. Update Token
    token.status = 'CALLED';
    token.calledAt = new Date();
    await token.save();

    // 6. Auto-Update others' positions via Socket.IO
    const io = getIO();
    // Tell the specific patient their token was called
    io.to(`user:${token.patientId}`).emit('token:called', { 
      message: 'It is your turn!', 
      token 
    });
    // Tell everyone in this specific queue that a token was called (so their UI can recalculate waiting positions)
    io.to(`queue:${token.queueId._id}`).emit('queue:token_called', { 
      calledTokenId: token._id 
    });
    await emitStoreQueuePreview(
      io,
      token.storeId,
      token.queueId.doctorId,
      token.queueId._id
    );

    return res.status(200).json({
      message: `Token #${token.number} has been called.`,
      token,
    });
  } catch (error) {
    console.error('Call Token Error:', error);
    return res.status(500).json({ error: 'Internal server error while calling token.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR COMPLETES TOKEN (SERVED / MISSED)
// ─────────────────────────────────────────────────────────────────────────────
exports.completeToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { status, prescriptionId } = req.body; // status must be 'SERVED' or 'MISSED'
    const doctorUserId = req.user._id;

    if (!['SERVED', 'MISSED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be SERVED or MISSED.' });
    }

    // 1. Find the token
    const token = await Token.findById(tokenId).populate('queueId');
    if (!token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    // 2. Authorization (Same as callToken)
    if (token.queueId.type === 'DOCTOR') {
      const doctorProfile = await Doctor.findOne({ userId: doctorUserId });
      if (token.queueId.doctorId.toString() !== doctorProfile._id.toString()) {
        return res.status(403).json({ error: 'You can only complete tokens from your own queue.' });
      }
    }

    // 3. State Check
    if (token.status !== 'CALLED' && status === 'SERVED') {
      // You can't serve a patient you haven't called yet
      return res.status(400).json({ error: 'You must CALL the token before marking it SERVED.' });
    }

    // Note: You CAN skip from WAITING straight to MISSED if they aren't around

    // 4. Update Token
    token.status = status;
    token.servedAt = new Date();

    // If served, link the prescription the doctor just wrote (if any)
    if (status === 'SERVED' && prescriptionId) {
      token.prescription = prescriptionId;
    }

    await token.save();

    // Emit Socket.IO event: Tell everyone in the queue that a token is gone
    const io = getIO();
    io.to(`queue:${token.queueId._id}`).emit('queue:token_completed', { 
      completedTokenId: token._id, 
      status 
    });
    await emitStoreQueuePreview(
      io,
      token.storeId,
      token.queueId.doctorId,
      token.queueId._id
    );

    return res.status(200).json({
      message: `Token marked as ${status}.`,
      token,
    });
  } catch (error) {
    console.error('Complete Token Error:', error);
    return res.status(500).json({ error: 'Internal server error while completing token.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT CANCELS TOKEN
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const patientId = req.user._id;

    const token = await Token.findById(tokenId).populate('queueId');
    if (!token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    if (token.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own tokens.' });
    }

    if (!['WAITING', 'CALLED'].includes(token.status)) {
      return res.status(400).json({ error: `This token is already ${token.status.toLowerCase()}.` });
    }

    token.status = 'CANCELED';
    token.servedAt = new Date();
    await token.save();

    const io = getIO();
    io.to(`queue:${token.queueId._id}`).emit('queue:token_completed', {
      completedTokenId: token._id,
      status: 'CANCELED',
    });
    io.to(`user:${token.patientId}`).emit('token:canceled', {
      tokenId: token._id,
      tokenNumber: token.number,
    });
    await emitStoreQueuePreview(
      io,
      token.storeId,
      token.queueId.doctorId,
      token.queueId._id
    );

    return res.status(200).json({
      success: true,
      message: 'Token canceled.',
      token,
    });
  } catch (error) {
    console.error('Cancel Token Error:', error);
    return res.status(500).json({ error: 'Internal server error while canceling token.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE QUEUE RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────
exports.getActiveQueue = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await Doctor.findOne({ userId: doctorUserId });
    
    if (!doctor) {
      return res.status(403).json({ error: 'Doctor profile not found.' });
    }

    const queue = await getOrCreateQueue(doctor.storeId, 'DOCTOR', doctor._id);
    
    // Fetch all tokens for today's queue, sorted by number
    const tokens = await Token.find({ queueId: queue._id })
      .populate('patientId', 'name age gender')
      .sort({ number: 1 });

    return res.status(200).json({ success: true, queue, tokens });
  } catch (error) {
    console.error('Get Active Queue Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve active queue.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT ACTIVE QUEUE STATUS
// ─────────────────────────────────────────────────────────────────────────────

const queuePopulateConfig = {
  path: 'queueId',
  select: 'type doctorId storeId',
  populate: [
    {
      path: 'doctorId',
      select: 'department specialization userId',
      populate: { path: 'userId', select: 'name' },
    },
    { path: 'storeId', select: 'name address' },
  ],
};

async function buildActiveQueueSummary(token) {
  const queue = token.queueId;
  if (!queue) return null;

  const doctor = queue.doctorId;
  const store = queue.storeId;

  const positionAhead = await Token.countDocuments({
    queueId: queue._id,
    status: 'WAITING',
    number: { $lt: token.number },
  });

  return {
    tokenId: token._id,
    queueId: queue._id,
    doctorId: queue.doctorId?._id?.toString() || queue.doctorId?.toString() || null,
    type: queue.type,
    status: token.status,
    tokenNumber: token.number,
    calledAt: token.calledAt,
    positionAhead,
    doctorName: doctor?.userId?.name || null,
    department: doctor?.department || null,
    specialization: doctor?.specialization || null,
    hospitalName: store?.name || null,
    hospitalAddress: store?.address || null,
  };
}

exports.getPatientQueueStatus = async (req, res) => {
  try {
    const patientId = req.user._id;

    const activeTokens = await Token.find({
      patientId,
      status: { $in: ['WAITING', 'CALLED'] },
    })
      .populate(queuePopulateConfig)
      .sort({ status: -1, calledAt: -1, createdAt: -1 });

    const validTokens = activeTokens.filter((token) => token.queueId);
    const activeQueues = (
      await Promise.all(validTokens.map((token) => buildActiveQueueSummary(token)))
    ).filter(Boolean);

    // Primary queue: CALLED first, otherwise most recent WAITING (for legacy clients)
    const activeQueue =
      activeQueues.find((q) => q.status === 'CALLED') || activeQueues[0] || null;

    return res.status(200).json({
      success: true,
      activeQueue,
      activeQueues,
      count: activeQueues.length,
    });
  } catch (error) {
    console.error('Get Patient Queue Status Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve patient queue status.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF/DOCTOR PAUSES OR RESUMES QUEUE
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleQueueStatus = async (req, res) => {
  try {
    const { queueId } = req.params;
    const { isPaused } = req.body; // boolean

    if (typeof isPaused !== 'boolean') {
      return res.status(400).json({ error: 'isPaused must be a boolean.' });
    }

    // 1. Find the Queue
    const queue = await Queue.findById(queueId);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found.' });
    }

    // 2. Authorization (enforceStoreScope middleware handles the storeId check,
    //    but we must ensure the User is touching a queue in their own store)
    if (queue.storeId.toString() !== req.user.storeId.toString()) {
      return res.status(403).json({ error: 'You can only manage queues in your own hospital.' });
    }

    // 3. Update Queue
    queue.isPaused = isPaused;
    await queue.save();

    // 4. Emit Socket.IO event
    const io = getIO();
    // Tell the doctor's specific queue room
    io.to(`queue:${queue._id}`).emit('queue:status_changed', { isPaused });
    // Tell the whole store so patients looking at the hospital page see it disabled
    io.to(`store:${queue.storeId}`).emit('store:queue_status_changed', { queueId: queue._id, isPaused });

    return res.status(200).json({
      message: `Queue has been ${isPaused ? 'paused' : 'resumed'}.`,
      queue,
    });
  } catch (error) {
    console.error('Toggle Queue Status Error:', error);
    return res.status(500).json({ error: 'Internal server error while toggling queue status.' });
  }
};
