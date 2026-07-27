const TagAlertState = require('../models/TagAlertState');
const { publishEmailJob, publishSpeakerJob } = require('./queue');
const logger = require('../utils/logger');

// In-memory maps to manage alarm and email timers per tagId
const alarmTimers = new Map(); // tagId -> { intervalId, timeoutId }
const emailTimers = new Map(); // tagId -> intervalId

// Default timing values (ms)
const DEFAULT_ALARM_DURATION_MS = 5000; // 5s on
const DEFAULT_ALARM_INTERVAL_MS = 5000; // repeat every 5s
const DEFAULT_EMAIL_REPEAT_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_DAILY_EMAIL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sendAlertEmail(tagId) {
  try {
    publishEmailJob({ tagId, type: 'ALARM' });
    await TagAlertState.findOneAndUpdate({ tagId }, { lastEmailSentAt: new Date() });
  } catch (err) {
    logger.error('Failed to send alert email', { tagId, error: err && err.message });
  }
}

async function startHourlyEmail(tagId) {
  if (emailTimers.has(tagId)) return;
  // send immediately
  await sendAlertEmail(tagId);
  const id = setInterval(() => sendAlertEmail(tagId), DEFAULT_EMAIL_REPEAT_MS);
  emailTimers.set(tagId, id);
}

function switchToDailyEmail(tagId) {
  // clear existing hourly
  const id = emailTimers.get(tagId);
  if (id) {
    clearInterval(id);
    emailTimers.delete(tagId);
  }
  // send immediately once
  sendAlertEmail(tagId).catch(() => {});
  const dailyId = setInterval(() => sendAlertEmail(tagId), DEFAULT_DAILY_EMAIL_MS);
  emailTimers.set(tagId, dailyId);
}

function stopEmails(tagId) {
  const id = emailTimers.get(tagId);
  if (id) {
    clearInterval(id);
    emailTimers.delete(tagId);
  }
}

async function playSpeakerOnce(tagId) {
  try {
    publishSpeakerJob({ tagId, type: 'ALARM' });
    return null;
  } catch (err) {
    logger.error('Failed to publish speaker job', { tagId, error: err && err.message });
    return null;
  }
}

async function startAlarmLoop(tagId) {
  if (alarmTimers.has(tagId)) return; // already running
  // play immediately then schedule repeats
  const timeoutId = await playSpeakerOnce(tagId);
  const intervalId = setInterval(async () => {
    // each interval triggers another burst
    const t = await playSpeakerOnce(tagId);
    // replace stored timeoutId so stop can clear the latest
    const current = alarmTimers.get(tagId) || {};
    if (current.timeoutId) clearTimeout(current.timeoutId);
    alarmTimers.set(tagId, { intervalId, timeoutId: t });
  }, DEFAULT_ALARM_INTERVAL_MS);
  alarmTimers.set(tagId, { intervalId, timeoutId });
}

function stopAlarmLoop(tagId) {
  const timers = alarmTimers.get(tagId);
  if (!timers) return;
  try {
    if (timers.intervalId) clearInterval(timers.intervalId);
    if (timers.timeoutId) clearTimeout(timers.timeoutId);
  } catch (err) {
    logger.warn('Error stopping alarm loop', { tagId, error: err && err.message });
  }
  alarmTimers.delete(tagId);
}

/**
 * Handle an incoming tag event from readers.
 * event: { tagId, zoneId, eventType: 'exit'|'return' }
 */
async function handleTagEvent(event, options = {}) {
  const { tagId, zoneId, eventType } = event || {};
  const { isViolation = false } = options || {};
  if (!tagId || !eventType) throw new Error('tagId and eventType required');

  const now = new Date();
  let state = await TagAlertState.findOne({ tagId });
  if (!state) {
    state = await TagAlertState.create({ tagId });
  }

  // Ignore permanently disabled tags completely
  if (state.status === 'permanently_disabled') {
    logger.info('Tag permanently disabled; ignoring event', { tagId, eventType });
    return { ignored: true };
  }

  // If tag is temp-disabled and expiry is in the future, skip alerting
  if (state.status === 'temp_disabled' && state.disabledUntil && state.disabledUntil > now) {
    // update lastMovementDetectedAt for audit but do not alert
    state.lastMovementDetectedAt = now;
    await state.save();
    logger.info('Tag is temporarily disabled; skipping alert', { tagId, disabledUntil: state.disabledUntil });
    return { ignored: true };
  }

  // If temp_disabled expiry has passed and we see activity, move to overdue state
  if (state.status === 'temp_disabled' && state.disabledUntil && state.disabledUntil <= now) {
    state.status = 'temp_disabled_overdue';
    await state.save();
    // switch emails to daily
    switchToDailyEmail(tagId);
    logger.info('Temp-disabled tag went overdue', { tagId });
  }

  // Handle exit event: may trigger unintentional_alert
  if (eventType === 'exit') {
    if (!isViolation) {
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Exit was not a violation; skipping alert-state transition', { tagId, zoneId });
      return { alerted: false, isViolation: false };
    }

    // If now in temp_disabled_overdue or temp_disabled expired, do not raise buzzer
    if (state.status === 'temp_disabled_overdue') {
      // keep daily emails running
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Temp-disabled-overdue tag detected at exit; daily emails active', { tagId });
      return { alerted: false };
    }

    // If already alarming, refresh lastMovementDetectedAt
    if (state.status === 'unintentional_alert') {
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Tag already alarming; refreshed timestamp', { tagId });
      return { alerted: true };
    }

    // Otherwise, move to unintentional_alert unless muted or disabled
    state.status = 'unintentional_alert';
    state.lastMovementDetectedAt = now;
    await state.save();

    // Start buzzer unless muted
    if (!state.alarmMuted) {
      startAlarmLoop(tagId).catch(() => {});
    } else {
      logger.info('Alarm muted for tag; skipping buzzer', { tagId });
    }

    // Start hourly email alerts
    startHourlyEmail(tagId).catch(() => {});

    logger.info('Unintentional alert raised', { tagId, zoneId });
    return { alerted: true, isViolation: true };
  }

  // Handle return event: resolve alert states
  if (eventType === 'return') {
    // If currently alarming or overdue, clear alerts and timers
    if (state.status === 'unintentional_alert' || state.status === 'temp_disabled_overdue') {
      state.status = 'normal';
      state.lastMovementDetectedAt = now;
      await state.save();

      // stop buzzer and emails
      stopAlarmLoop(tagId);
      stopEmails(tagId);

      logger.info('Tag returned; alerts cleared', { tagId });
      return { resolved: true, isViolation: false };
    }

    // If temp_disabled and return occurs before expiry, clear temp_disabled
    if (state.status === 'temp_disabled') {
      state.status = 'normal';
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Temporarily disabled tag returned before expiry; state cleared', { tagId });
      return { resolved: true, isViolation: false };
    }

    // Otherwise no action
    state.lastMovementDetectedAt = now;
    await state.save();
    return { resolved: false, isViolation: false };
  }

  return { handled: false };
}

module.exports = {
  handleTagEvent,
  startAlarmLoop,
  stopAlarmLoop,
  startHourlyEmail,
  switchToDailyEmail,
  stopEmails
};
