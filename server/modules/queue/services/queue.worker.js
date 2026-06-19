const cron = require('node-cron');
const Token = require('../models/Token');
const { getIO } = require('../../shared/socket');

const DEFAULT_AUTOSKIP_MINUTES = Number(process.env.QUEUE_AUTOSKIP_MINUTES || 3);
const DEFAULT_STALE_CALLED_MINUTES = Number(process.env.QUEUE_STALE_CALLED_MINUTES || 120);

function getQueueWorkerTimezone() {
  return process.env.QUEUE_WORKER_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function markTokensAsMissed(filter) {
  const staleTokens = await Token.find(filter)
    .select('_id queueId patientId storeId number status')
    .lean();

  if (staleTokens.length === 0) {
    return 0;
  }

  const now = new Date();
  const staleTokenIds = staleTokens.map((token) => token._id);
  const snapshotStatuses = [...new Set(staleTokens.map((token) => token.status))];

  const updateResult = await Token.updateMany(
    {
      _id: { $in: staleTokenIds },
      status: { $in: snapshotStatuses },
    },
    {
      $set: {
        status: 'MISSED',
        servedAt: now,
      },
    }
  );

  if (!updateResult.modifiedCount) {
    return 0;
  }

  const updatedTokens = await Token.find({
    _id: { $in: staleTokenIds },
    status: 'MISSED',
    servedAt: now,
  })
    .select('_id queueId patientId number')
    .lean();

  let io;
  try {
    io = getIO();
  } catch (error) {
    io = null;
  }

  if (io) {
    updatedTokens.forEach((token) => {
      io.to(`queue:${token.queueId}`).emit('queue:token_completed', {
        completedTokenId: token._id,
        status: 'MISSED',
      });

      io.to(`user:${token.patientId}`).emit('token:missed', {
        tokenId: token._id,
        tokenNumber: token.number,
        queueId: token.queueId,
        message: 'Your token was automatically marked MISSED.',
      });
    });
  }

  return updatedTokens.length;
}

async function runNightlyQueueCleanup() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const markedCount = await markTokensAsMissed({
    status: { $in: ['WAITING', 'CALLED', 'ACTIVE'] },
    createdAt: { $lt: startOfToday },
  });

  console.log(`[QueueWorker] Nightly cleanup marked ${markedCount} token(s) as MISSED.`);
  return markedCount;
}

async function runCalledTokenAutoSkip(maxMinutes = DEFAULT_AUTOSKIP_MINUTES) {
  const calledBefore = new Date(Date.now() - maxMinutes * 60 * 1000);

  const markedCount = await markTokensAsMissed({
    status: 'CALLED',
    calledAt: { $lte: calledBefore },
  });

  if (markedCount > 0) {
    console.log(`[QueueWorker] Auto-skip marked ${markedCount} token(s) as MISSED.`);
  }

  return markedCount;
}

async function markStaleCalledTokensForQueue(queueId, maxMinutes = DEFAULT_STALE_CALLED_MINUTES) {
  const calledBefore = new Date(Date.now() - maxMinutes * 60 * 1000);

  return markTokensAsMissed({
    queueId,
    status: 'CALLED',
    calledAt: { $lte: calledBefore },
  });
}

function startQueueWorker() {
  const timezone = getQueueWorkerTimezone();

  cron.schedule('*/1 * * * *', () => {
    runCalledTokenAutoSkip().catch((error) => {
      console.error('[QueueWorker] Auto-skip job failed:', error.message);
    });
  }, { timezone });

  cron.schedule('59 23 * * *', () => {
    runNightlyQueueCleanup().catch((error) => {
      console.error('[QueueWorker] Nightly cleanup job failed:', error.message);
    });
  }, { timezone });

  console.log(`[QueueWorker] Worker started in timezone ${timezone}.`);
}

module.exports = {
  startQueueWorker,
  runNightlyQueueCleanup,
  runCalledTokenAutoSkip,
  markStaleCalledTokensForQueue,
};