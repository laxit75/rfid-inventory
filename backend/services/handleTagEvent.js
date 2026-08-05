const TagAlertState = require('../models/TagAlertState');
const Tag = require('../models/Tag');
const { publishEmailJob, publishSpeakerJob } = require('./queue');
const realtime = require('./realtime');
const logger = require('../utils/logger');

/**
 * Minimum interval (ms) between consecutive alarm triggers for the same tag.
 * Prevents rapid re-triggers within the same alert episode.
 */
const MIN_ALARM_REPEAT_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Helper to clear Tag.alertStatus so the main Dashboard stays in sync.
 */
async function clearTagAlertStatus(tagId) {
  try {
    const tag = await Tag.findOne({ tagId });
    if (tag && (tag.alertStatus === 'ALARMING' || tag.alertStatus === 'OVERDUE')) {
      tag.alertStatus = 'NONE';
      tag.silenced = false;
      tag.lastAlarmBeepAt = null;
      tag.lastEmailSentAt = null;
      tag.overdueAlertStart = null;
      tag.lastOverdueEmailSentAt = null;
      await tag.save();
      logger.info('Tag model alertStatus cleared', { tagId });
    }
  } catch (err) {
    logger.warn('Failed to clear Tag.alertStatus', { tagId, error: err.message });
  }
}

/**
 * Core state machine for processing RFID tag events.
 *
 * Returns an object describing what happened:
 *   { transitioned: bool, newStatus: string, alerted: bool, resolved: bool }
 */
async function handleTagEvent(event, options = {}) {
  const { tagId, zoneId, eventType } = event || {};
  const { isViolation = false } = options || {};

  if (!tagId || !eventType) {
    throw new Error('tagId and eventType are required');
  }

  const now = new Date();

  // Fetch or create the alert-state record for this tag
  let state = await TagAlertState.findOne({ tagId });
  if (!state) {
    state = await TagAlertState.create({ tagId, location: zoneId || '' });
  }

  // ──────────────────────────────────────────────
  // 1. Permanently disabled — always ignore
  // ──────────────────────────────────────────────
  if (state.status === 'permanently_disabled') {
    logger.info('Tag permanently disabled; ignoring event', { tagId, eventType });
    return { transitioned: false, newStatus: state.status, ignored: true };
  }

  // ──────────────────────────────────────────────
  // 2. Temp-disabled — re-evaluate expiry
  // ──────────────────────────────────────────────
  if (state.status === 'temp_disabled') {
    // If disabledUntil is in the past, transition to overdue
    if (state.disabledUntil && state.disabledUntil <= now) {
      state.status = 'temp_disabled_overdue';
      state.firstDetectedAt = now;
      await state.save();
      logger.info('Temp-disabled tag went overdue', { tagId });

      emitAlertUpdate(state);
      return { transitioned: true, newStatus: 'temp_disabled_overdue', alerted: true };
    }

    // Still within disabled window — just log movement, no alert
    state.lastMovementDetectedAt = now;
    await state.save();
    logger.info('Tag is temporarily disabled; skipping alert', { tagId, disabledUntil: state.disabledUntil });
    return { transitioned: false, newStatus: state.status, ignored: true };
  }

  // ──────────────────────────────────────────────
  // 3. Temp-disabled-overdue — was disabled, now overdue
  // ──────────────────────────────────────────────
  if (state.status === 'temp_disabled_overdue') {
    if (eventType === 'return') {
      // Tag came back — resolve the overdue state
      state.status = 'normal';
      state.resolvedAt = now;
      state.alarmCount = 0;
      state.firstDetectedAt = null;
      state.lastAlarmTriggeredAt = null;
      state.alarmMuted = false;
      state.mutedBy = '';
      state.mutedAt = null;
      state.muteExpiresAt = null;
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Overdue tag returned; resolved', { tagId });

      // Sync Tag model so main Dashboard clears the alert
      await clearTagAlertStatus(tagId);

      emitAlertUpdate(state);
      return { transitioned: true, newStatus: 'normal', resolved: true };
    }

    // Still out — just refresh movement timestamp, keep daily emails going
    state.lastMovementDetectedAt = now;
    await state.save();
    return { transitioned: false, newStatus: state.status };
  }

  // ──────────────────────────────────────────────
  // 4. Normal state — handle EXIT / RETURN
  // ──────────────────────────────────────────────
  if (state.status === 'normal') {
    if (eventType === 'return') {
      // Normal return, nothing to do
      state.lastMovementDetectedAt = now;
      await state.save();
      return { transitioned: false, newStatus: 'normal', resolved: false };
    }

    // EXIT event
    if (!isViolation) {
      // Intentional exit (tag left through its assigned zone) — no alert
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Exit was not a violation; no alert', { tagId, zoneId });
      return { transitioned: false, newStatus: 'normal', alerted: false };
    }

    // Violation exit — start an alert episode
    state.status = 'unintentional_alert';
    state.firstDetectedAt = now;
    state.lastAlarmTriggeredAt = now;
    state.alarmCount = 1;
    state.resolvedAt = null;
    state.alarmMuted = false;
    state.mutedBy = '';
    state.mutedAt = null;
    state.muteExpiresAt = null;
    state.vehicleId = zoneId || '';
    state.lastMovementDetectedAt = now;
    await state.save();

    // Publish immediate speaker trigger and alert email
    if (!state.alarmMuted) {
      publishSpeakerJob({ tagId, type: 'ALARM' });
    }
    publishEmailJob({ tagId, type: 'ALARM' });
    logger.info('Alert raised for tag', { tagId, zoneId, alarmCount: 1 });

    emitAlertUpdate(state);
    return { transitioned: true, newStatus: 'unintentional_alert', alerted: true };
  }

  // ──────────────────────────────────────────────
  // 5. Unintentional alert — handle re-trigger, mute, or resolve
  // ──────────────────────────────────────────────
  if (state.status === 'unintentional_alert') {
    if (eventType === 'return') {
      // Tag returned — resolve the alert
      state.status = 'normal';
      state.resolvedAt = now;
      state.alarmCount = 0;
      state.firstDetectedAt = null;
      state.lastAlarmTriggeredAt = null;
      state.alarmMuted = false;
      state.mutedBy = '';
      state.mutedAt = null;
      state.muteExpiresAt = null;
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Tag returned; alert resolved', { tagId });

      // Sync Tag model so main Dashboard clears the alert
      await clearTagAlertStatus(tagId);

      emitAlertUpdate(state);
      return { transitioned: true, newStatus: 'normal', resolved: true };
    }

    // Re-trigger: another EXIT while still in alert
    const timeSinceLastAlarm = now - state.lastAlarmTriggeredAt;

    // Update movement timestamp regardless
    state.lastMovementDetectedAt = now;

    // Check if the repeat interval has elapsed before re-firing
    if (timeSinceLastAlarm >= MIN_ALARM_REPEAT_INTERVAL_MS && !state.alarmMuted) {
      state.lastAlarmTriggeredAt = now;
      state.alarmCount = (state.alarmCount || 0) + 1;
      await state.save();

      // Fire speaker again
      publishSpeakerJob({ tagId, type: 'ALARM' });
      logger.info('Alarm re-triggered for tag', { tagId, alarmCount: state.alarmCount });

      emitAlertUpdate(state);
      return { transitioned: false, newStatus: 'unintentional_alert', alerted: true, reTriggered: true };
    }

    // Muted or too soon — just update movement timestamp
    if (state.alarmMuted) {
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Tag is muted; skipping alarm re-trigger', { tagId });
    } else {
      state.lastMovementDetectedAt = now;
      await state.save();
      logger.info('Tag still alerting; within repeat interval', { tagId });
    }

    return { transitioned: false, newStatus: 'unintentional_alert', alerted: false };
  }

  // Unknown status — fallback
  logger.warn('Unknown alert state for tag', { tagId, status: state.status });
  return { transitioned: false, newStatus: state.status, handled: false };
}

/**
 * Mute an alerting tag, optionally with an expiry.
 */
async function muteTag(tagId, mutedBy = 'operator', muteDurationMs = 5 * 60 * 1000) {
  const state = await TagAlertState.findOne({ tagId });
  if (!state) {
    throw new Error('Tag not found');
  }
  if (state.status !== 'unintentional_alert') {
    throw new Error('Tag is not currently in alert state');
  }

  const now = new Date();
  state.alarmMuted = true;
  state.mutedBy = mutedBy;
  state.mutedAt = now;
  state.muteExpiresAt = new Date(now.getTime() + muteDurationMs);
  await state.save();

  logger.info('Tag muted', { tagId, mutedBy, muteExpiresAt: state.muteExpiresAt });
  emitAlertUpdate(state);
  return state;
}

/**
 * Resolve (clear) an alert for a tag — either by return or manual override.
 * Also updates the Tag model's alertStatus to keep the main Dashboard in sync.
 */
async function resolveTag(tagId, actor = 'system') {
  const state = await TagAlertState.findOne({ tagId });
  if (!state) {
    throw new Error('Tag not found');
  }

  state.status = 'normal';
  state.resolvedAt = new Date();
  state.alarmCount = 0;
  state.alarmMuted = false;
  state.mutedBy = '';
  state.mutedAt = null;
  state.muteExpiresAt = null;
  state.lastAlarmTriggeredAt = null;
  state.firstDetectedAt = null;
  await state.save();

  // Also update the Tag model so the main Dashboard shows resolved status
  await clearTagAlertStatus(tagId);

  logger.info('Tag alert resolved', { tagId, actor });
  emitAlertUpdate(state);
  return state;
}

/**
 * Emit a real-time update via Socket.io so the frontend stays live.
 */
function emitAlertUpdate(state) {
  try {
    realtime.emit('tagAlertState:update', {
      tagId: state.tagId,
      status: state.status,
      firstDetectedAt: state.firstDetectedAt,
      lastAlarmTriggeredAt: state.lastAlarmTriggeredAt,
      alarmCount: state.alarmCount,
      alarmMuted: state.alarmMuted,
      muteExpiresAt: state.muteExpiresAt,
      mutedBy: state.mutedBy,
      resolvedAt: state.resolvedAt,
      location: state.location,
      vehicleId: state.vehicleId
    });
  } catch (err) {
    logger.warn('Failed to emit real-time alert update', { tagId: state.tagId, error: err.message });
  }
}

/**
 * Mark a tag as overdue in TagAlertState.
 *
 * Called by the background scheduler when it flags Tag.alertStatus = 'OVERDUE'
 * so the Live Alerts dashboard (which reads TagAlertState) stays in sync with
 * the main dashboard (which reads Tag.alertStatus). Idempotent.
 */
async function syncTagOverdue(tagId, zoneId = '') {
  const now = new Date();
  let state = await TagAlertState.findOne({ tagId });
  if (!state) {
    state = await TagAlertState.create({ tagId, location: zoneId || '' });
  }

  // Never downgrade an active alarm episode or a permanently disabled tag
  if (state.status === 'unintentional_alert' || state.status === 'permanently_disabled') {
    return state;
  }

  if (state.status !== 'temp_disabled_overdue') {
    state.status = 'temp_disabled_overdue';
    state.firstDetectedAt = state.firstDetectedAt || now;
    state.lastAlarmTriggeredAt = now;
    state.alarmCount = (state.alarmCount || 0) + 1;
    state.resolvedAt = null;
    state.alarmMuted = false;
    state.mutedBy = '';
    state.mutedAt = null;
    state.muteExpiresAt = null;
    state.lastMovementDetectedAt = now;
    if (zoneId) state.location = zoneId;
    await state.save();
    emitAlertUpdate(state);
    logger.info('TagAlertState synced to overdue', { tagId });
  }
  return state;
}

/**
 * Clear an overdue flag on TagAlertState.
 *
 * Used when an overdue temp-disabled tag is extended by an admin or moves
 * through a zone. Returns the state to 'temp_disabled' so a later expired
 * event re-arms it if still applicable.
 */
async function clearTagOverdue(tagId) {
  const state = await TagAlertState.findOne({ tagId });
  if (!state || state.status !== 'temp_disabled_overdue') return state;
  state.status = 'temp_disabled';
  state.resolvedAt = new Date();
  state.lastAlarmTriggeredAt = null;
  state.alarmCount = 0;
  state.alarmMuted = false;
  state.mutedBy = '';
  state.mutedAt = null;
  state.muteExpiresAt = null;
  await state.save();
  emitAlertUpdate(state);
  logger.info('TagAlertState overdue cleared', { tagId });
  return state;
}

module.exports = { handleTagEvent, muteTag, resolveTag, syncTagOverdue, clearTagOverdue };
