const amqp = require('amqplib');
const logger = require('../utils/logger');

const EMAIL_QUEUE = 'email_alerts';
const EMAIL_DLQ = 'email_alerts_dlq';
const EMAIL_DLX = 'email_alerts_dlx';
const RETRY_INITIAL_MS = 1000;
const RETRY_MAX_MS = 30000;

let connection;
let channel;
let connecting;
let retryDelay = RETRY_INITIAL_MS;
let retryTimer;

function rabbitUrl() {
  return process.env.RABBITMQ_URL;
}

function scheduleReconnect() {
  if (retryTimer) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    getChannel().catch(() => {});
  }, delay);
  retryTimer.unref?.();
  logger.warn('RabbitMQ unavailable; retrying connection', { retryInMs: delay });
}

async function establishConnection() {
  const url = rabbitUrl();
  if (!url) throw new Error('RABBITMQ_URL is required');

  const nextConnection = await amqp.connect(url);
  nextConnection.on('error', (err) => logger.error('RabbitMQ connection error', { error: err.message }));
  nextConnection.on('close', () => {
    connection = null;
    channel = null;
    logger.warn('RabbitMQ connection closed');
    scheduleReconnect();
  });

  const nextChannel = await nextConnection.createChannel();
  nextChannel.on('error', (err) => logger.error('RabbitMQ channel error', { error: err.message }));
  await nextChannel.assertExchange(EMAIL_DLX, 'direct', { durable: true });
  await nextChannel.assertQueue(EMAIL_DLQ, { durable: true });
  await nextChannel.bindQueue(EMAIL_DLQ, EMAIL_DLX, EMAIL_DLQ);
  await nextChannel.assertQueue(EMAIL_QUEUE, {
    durable: true,
    deadLetterExchange: EMAIL_DLX,
    deadLetterRoutingKey: EMAIL_DLQ
  });

  connection = nextConnection;
  channel = nextChannel;
  retryDelay = RETRY_INITIAL_MS;
  logger.info('Connected to RabbitMQ', { queue: EMAIL_QUEUE });
  return channel;
}

function getChannel() {
  if (channel) return Promise.resolve(channel);
  if (!connecting) {
    connecting = establishConnection()
      .catch((err) => {
        logger.error('RabbitMQ connection failed', { error: err.message });
        scheduleReconnect();
        throw err;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
}

function publishEmailJob(job) {
  if (!job?.tagId || !job?.type) {
    logger.error('Email job was not published because it is invalid', { job });
    return;
  }

  getChannel()
    .then((activeChannel) => {
      activeChannel.sendToQueue(EMAIL_QUEUE, Buffer.from(JSON.stringify({ tagId: job.tagId, type: job.type })), {
        persistent: true,
        contentType: 'application/json'
      });
    })
    .catch((err) => logger.error('Failed to publish email job', { tagId: job.tagId, type: job.type, error: err.message }));
}

module.exports = { EMAIL_QUEUE, getChannel, publishEmailJob };
