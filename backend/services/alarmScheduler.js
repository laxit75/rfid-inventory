const TagAlertState = require('../models/TagAlertState');
const Settings = require('../models/Settings');
const { publishSpeakerJob } = require('./queue');
const realtime = require('./realtime');
const logger = require('../utils/logger');

/**
 * alarmScheduler.js
 *
 * Polls TagAlertState on a configurable interval for tags that are in
 * 'unintentional_alert' status and need a repeated alarm trigger via the
 * IP speaker (AKOM SH-30).
 *
 * This replaces the legacy in-memory alarm loop (startAlarmLoop / stopAlarmLoop)
 * with a durable, DB-driven approach that survives server restarts.
 */

const DEFAULT_POLL_INTERVAL_MS = 10 * 1000; // every 10 seconds
const DEFAULT_REPEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between alarm re-triggers

let pollIntervalId = null;
let active = false;

/**
 * Start the alarm scheduler polling loop.
 * @param {number} pollIntervalMs — how often to poll the database
 */
function startAlarmScheduler(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (active) {
    logger.warn('Alarm scheduler is already running');
    return;
  }

  active = true;

  // Run immediately, then on interval
  pollOnce().catch((err) => logger.error('Alarm scheduler initial poll failed', { error: err.message }));
  pollIntervalId = setInterval(() => {
    pollOnce().catch((err) => logger.error('Alarm scheduler poll failed', { error: err.message }));
  }, pollIntervalMs);

  logger.info('Alarm scheduler started', { pollIntervalMs });
}

/**
 * Stop the alarm scheduler.
 */
function stopAlarmScheduler() {
  active = false;
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  logger.info('Alarm scheduler stopped');
}

/**
 * Core poll function: find tags in alert state and re-trigger alarms as needed.
 */
async function pollOnce() {
  try {
    const settings = await Settings.findOne().lean();
    const repeatIntervalMs = (settings?.alarmRepeatIntervalSec || 120) * 1000;
    const globalAlarmMuted = settings?.alarmMuted || false;

    const now = new Date();
    const cutoff = new Date(now.getTime() - repeatIntervalMs);

    // Find tags that are alerting AND have not been triggered within the repeat interval
    // OR have never been triggered (lastAlarmTriggeredAt is null)
    const alertingTags = await TagAlertState.find({
      status: 'unintentional_alert',
      $or: [
        { lastAlarmTriggeredAt: { $lte: cutoff } },
        { lastAlarmTriggeredAt: null }
      ]
    }).lean();

    if (alertingTags.length === 0) return;

    for (const state of alertingTags) {
      // Skip if globally muted
      if (globalAlarmMuted) continue;

      // Skip if tag is individually muted and mute hasn't expired
      if (state.alarmMuted && state.muteExpiresAt) {
        if (state.muteExpiresAt > now) {
          // Still within mute window — skip
          continue;
        } else {
          // Mute expired — un-mute automatically
          await TagAlertState.updateOne(
            { tagId: state.tagId },
            {
              $set: {
                alarmMuted: false,
                mutedBy: '',
                mutedAt: null,
                muteExpiresAt: null
              }
            }
          );
          logger.info('Mute expired for tag', { tagId: state.tagId });
        }
      }

      // Publish a speaker job (the speaker worker will fire the IP speaker)
      publishSpeakerJob({ tagId: state.tagId, type: 'ALARM' });

      // Update the alert state record
      await TagAlertState.updateOne(
        { tagId: state.tagId },
        {
          $set: { lastAlarmTriggeredAt: now },
          $inc: { alarmCount: 1 }
        }
      );

      // Emit real-time update
      try {
        realtime.emit('tagAlertState:update', {
          tagId: state.tagId,
          status: 'unintentional_alert',
          lastAlarmTriggeredAt: now,
          alarmCount: (state.alarmCount || 0) + 1,
          alarmMuted: false
        });
      } catch (err) {
        logger.warn('Failed to emit alarm update', { tagId: state.tagId, error: err.message });
      }

      logger.info('Alarm scheduler re-triggered', {
        tagId: state.tagId,
        alarmCount: (state.alarmCount || 0) + 1,
        repeatIntervalMs
      });
    }
  } catch (err) {
    logger.error('Alarm scheduler poll error', { error: err.message });
  }
}

module.exports = { startAlarmScheduler, stopAlarmScheduler };
