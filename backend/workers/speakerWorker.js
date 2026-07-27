const Device = require('../models/Device');
const { SPEAKER_QUEUE, getChannel } = require('../services/queue');
const logger = require('../utils/logger');

let consumerTag;
let consumerChannel;
let retryTimer;
let stopping = false;

function scheduleStart() {
  if (stopping || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startSpeakerWorker();
  }, 5000);
  retryTimer.unref?.();
}

async function consumeSpeakerJob(activeChannel, message) {
  if (!message) return;

  let job;
  try {
    job = JSON.parse(message.content.toString());
    if (!job.type || (!job.tagId && !job.deviceId)) {
      throw new Error('Speaker job is missing type or target device/tag');
    }

    const matchingDevices = job.deviceId
      ? await Device.find({ _id: job.deviceId, active: true }).lean()
      : await Device.find({ type: 'SPEAKER', active: true }).lean();

    if (matchingDevices.length === 0) {
      logger.warn('Speaker job had no active devices to trigger', { deviceId: job.deviceId, tagId: job.tagId, type: job.type });
    }

    await Promise.allSettled(matchingDevices.map(async (device) => {
      const triggerAt = new Date();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${device.endpoint}/play`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-secret': device.secret
          },
          body: JSON.stringify({ type: job.type, tagId: job.tagId || null }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        await Device.findByIdAndUpdate(device._id, {
          $set: {
            lastTriggeredAt: triggerAt,
            lastStatus: 'OK'
          }
        });
      } catch (err) {
        logger.error('Speaker device call failed', {
          deviceId: device._id,
          endpoint: device.endpoint,
          tagId: job.tagId,
          type: job.type,
          error: err.message
        });
        await Device.findByIdAndUpdate(device._id, {
          $set: {
            lastTriggeredAt: triggerAt,
            lastStatus: `FAILED: ${err.message}`
          }
        });
      } finally {
        clearTimeout(timeout);
      }
    }));

    activeChannel.ack(message);
  } catch (err) {
    logger.error('Speaker job failed and was dead-lettered', {
      deviceId: job?.deviceId,
      tagId: job?.tagId,
      type: job?.type,
      error: err.message
    });
    activeChannel.nack(message, false, false);
  }
}

async function startSpeakerWorker() {
  stopping = false;
  if (consumerTag) return;

  try {
    const activeChannel = await getChannel();
    if (consumerTag) return;
    consumerChannel = activeChannel;
    activeChannel.prefetch(1);
    activeChannel.once('close', () => {
      consumerTag = null;
      consumerChannel = null;
      scheduleStart();
    });
    const result = await activeChannel.consume(SPEAKER_QUEUE, (message) => consumeSpeakerJob(activeChannel, message), { noAck: false });
    consumerTag = result.consumerTag;
    logger.info('Speaker worker started', { queue: SPEAKER_QUEUE });
  } catch (err) {
    logger.error('Speaker worker failed to start', { error: err.message });
    scheduleStart();
  }
}

async function stopSpeakerWorker() {
  stopping = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (consumerTag && consumerChannel) {
    try {
      await consumerChannel.cancel(consumerTag);
    } catch (err) {
      logger.warn('Unable to stop speaker worker', { error: err.message });
    }
  }
  consumerTag = null;
  consumerChannel = null;
}

module.exports = { startSpeakerWorker, stopSpeakerWorker };
