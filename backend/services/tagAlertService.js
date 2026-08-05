/**
 * tagAlertService.js — Legacy alert service.
 *
 * The core state machine has been moved to handleTagEvent.js (DB-driven).
 * This module re-exports handleTagEvent and related functions for backward
 * compatibility, while keeping the legacy in-memory timer functions available
 * for any remaining references.
 *
 * @deprecated Prefer importing directly from './handleTagEvent' in new code.
 */
const { handleTagEvent, muteTag, resolveTag } = require('./handleTagEvent');
const TagAlertState = require('../models/TagAlertState');
const { publishEmailJob, publishSpeakerJob } = require('./queue');
const logger = require('../utils/logger');

// ── Legacy in-memory Maps for alarm/email timers ──
const alarmTimers = new Map();
const emailTimers = new Map();

const DEFAULT_ALARM_DURATION_MS = 5000;
const DEFAULT_ALARM_INTERVAL_MS = 5000;
const DEFAULT_EMAIL_REPEAT_MS = 60 * 60 * 1000;
const DEFAULT_DAILY_EMAIL_MS = 24 * 60 * 60 * 1000;

/** @deprecated Use alarmScheduler.js or handleTagEvent directly */
async function sendAlertEmail(tagId) {
  try {
    publishEmailJob({ tagId, type: 'ALARM' });
    await TagAlertState.findOneAndUpdate({ tagId }, { lastEmailSentAt: new Date() });
  } catch (err) {
    logger.error('Failed to send alert email', { tagId, error: err && err.message });
  }
}

/** @deprecated Use the hourly/daily email cadence jobs instead */
async function startHourlyEmail(tagId) {
  if (emailTimers.has(tagId)) return;
  await sendAlertEmail(tagId);
  const id = setInterval(() => sendAlertEmail(tagId), DEFAULT_EMAIL_REPEAT_MS);
  emailTimers.set(tagId, id);
}

/** @deprecated Use the daily email cadence job instead */
function switchToDailyEmail(tagId) {
  const id = emailTimers.get(tagId);
  if (id) {
    clearInterval(id);
    emailTimers.delete(tagId);
  }
  sendAlertEmail(tagId).catch(() => {});
  const dailyId = setInterval(() => sendAlertEmail(tagId), DEFAULT_DAILY_EMAIL_MS);
  emailTimers.set(tagId, dailyId);
}

/** @deprecated */
function stopEmails(tagId) {
  const id = emailTimers.get(tagId);
  if (id) {
    clearInterval(id);
    emailTimers.delete(tagId);
  }
}

/** @deprecated Use alarmScheduler.js instead */
async function playSpeakerOnce(tagId) {
  try {
    publishSpeakerJob({ tagId, type: 'ALARM' });
    return null;
  } catch (err) {
    logger.error('Failed to publish speaker job', { tagId, error: err && err.message });
    return null;
  }
}

/** @deprecated Use alarmScheduler.js instead */
async function startAlarmLoop(tagId) {
  if (alarmTimers.has(tagId)) return;
  const timeoutId = await playSpeakerOnce(tagId);
  const intervalId = setInterval(async () => {
    const t = await playSpeakerOnce(tagId);
    const current = alarmTimers.get(tagId) || {};
    if (current.timeoutId) clearTimeout(current.timeoutId);
    alarmTimers.set(tagId, { intervalId, timeoutId: t });
  }, DEFAULT_ALARM_INTERVAL_MS);
  alarmTimers.set(tagId, { intervalId, timeoutId });
}

/** @deprecated */
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

// ── Re-export from the new DB-driven state machine ──
module.exports = {
  // New DB-driven API (preferred)
  handleTagEvent,
  muteTag,
  resolveTag,

  // Legacy in-memory API (deprecated)
  startAlarmLoop,
  stopAlarmLoop,
  startHourlyEmail,
  switchToDailyEmail,
  stopEmails
};
