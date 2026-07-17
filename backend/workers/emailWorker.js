const Tag = require('../models/Tag');
const { deliverAlertEmail } = require('../services/emailService');
const { EMAIL_QUEUE, getChannel } = require('../services/queue');
const logger = require('../utils/logger');

let consumerTag;
let consumerChannel;
let retryTimer;
let stopping = false;

function scheduleStart() {
  if (stopping || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startEmailWorker();
  }, 5000);
  retryTimer.unref?.();
}

async function consumeEmailJob(activeChannel, message) {
  if (!message) return;

  let job;
  try {
    job = JSON.parse(message.content.toString());
    if (!job.tagId || !job.type) throw new Error('Email job is missing tagId or type');

    const tag = await Tag.findOne({ tagId: job.tagId }).populate(['equipment', 'currentZone', 'assignedZone']);
    if (!tag) throw new Error('Tag not found');

    await deliverAlertEmail(tag, job.type);
    activeChannel.ack(message);
  } catch (err) {
    logger.error('Email job failed and was dead-lettered', {
      tagId: job?.tagId,
      type: job?.type,
      error: err.message
    });
    activeChannel.nack(message, false, false);
  }
}

async function startEmailWorker() {
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
    const result = await activeChannel.consume(EMAIL_QUEUE, (message) => consumeEmailJob(activeChannel, message), { noAck: false });
    consumerTag = result.consumerTag;
    logger.info('Email worker started', { queue: EMAIL_QUEUE });
  } catch (err) {
    logger.error('Email worker failed to start', { error: err.message });
    scheduleStart();
  }
}

async function stopEmailWorker() {
  stopping = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (consumerTag && consumerChannel) {
    try {
      await consumerChannel.cancel(consumerTag);
    } catch (err) {
      logger.warn('Unable to stop email worker', { error: err.message });
    }
  }
  consumerTag = null;
  consumerChannel = null;
}

module.exports = { startEmailWorker, stopEmailWorker };
