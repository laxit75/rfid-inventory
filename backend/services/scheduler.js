const Tag = require('../models/Tag');
const Settings = require('../models/Settings');
const AlertLog = require('../models/AlertLog');
const { sendAlertEmail, sendAlertSms } = require('./emailService');
const logger = require('../utils/logger');

let intervalId;

function startScheduler() {
  intervalId = setInterval(processTags, 2000);
  logger.info('Background scheduler started', { intervalMs: 2000 });
}

async function processTags() {
  try {
    const settings = await Settings.findOne();
    if (!settings) return;

    const now = new Date();

    // 1. Overdue detection for TEMP_DISABLED tags that are outside their assigned zone and past disabledUntil
    const overdueCandidates = await Tag.find({
      status: 'TEMP_DISABLED',
      disabledUntil: { $lte: now },
      alertStatus: { $ne: 'OVERDUE' }
    }).populate(['equipment', 'assignedZone', 'currentZone']);

    const overdueZoneCandidates = overdueCandidates.filter(tag => {
      const assignedZoneId = tag.assignedZone ? tag.assignedZone._id?.toString() || tag.assignedZone.toString() : null;
      const currentZoneId = tag.currentZone ? tag.currentZone._id?.toString() || tag.currentZone.toString() : null;
      return !!assignedZoneId && currentZoneId !== assignedZoneId;
    });

    for (const tag of overdueZoneCandidates) {
      tag.alertStatus = 'OVERDUE';
      tag.overdueAlertStart = now;
      logger.info('Overdue alert triggered', { tagId: tag.tagId });
      try {
        await sendAlertEmail(tag, 'OVERDUE');
        tag.lastOverdueEmailSentAt = new Date();
        if (settings.smsEnabled && settings.smsEscalationDelaySec <= 0) {
          await sendAlertSms(tag, 'OVERDUE');
          tag.lastOverdueSmsSentAt = new Date();
        }
        await tag.save();
      } catch (err) {
        logger.error('Failed to process overdue alert', { tagId: tag.tagId, error: err.message });
      }
    }

    // 2. Active alarm repeat logic for ALARMING tags
    const alarmingTags = await Tag.find({
      alertStatus: 'ALARMING'
    }).populate(['equipment', 'assignedZone', 'currentZone']);

    for (const tag of alarmingTags) {
      const silenced = tag.silenced || settings.alarmMuted;
      const beepInterval = settings.alarmRepeatIntervalSec * 1000;
      const emailInterval = settings.emailRepeatIntervalSec * 1000;
      const smsEscalationDelay = settings.smsEscalationDelaySec * 1000;
      const smsRepeatInterval = settings.smsRepeatIntervalSec * 1000;

      if (!silenced && tag.lastAlarmBeepAt && (now - tag.lastAlarmBeepAt >= beepInterval)) {
        await AlertLog.create({
          type: 'ALARM_BEEP',
          tag: tag._id,
          tagId: tag.tagId,
          timestamp: now
        });
        logger.info('Alarm beep emitted', { tagId: tag.tagId });
        tag.lastAlarmBeepAt = now;
        await tag.save();
      }

      if (tag.lastEmailSentAt && (now - tag.lastEmailSentAt >= emailInterval)) {
        try {
          await sendAlertEmail(tag, 'ALARM');
          tag.lastEmailSentAt = new Date();
          await tag.save();
        } catch (err) {
          logger.error('Failed to repeat alarm email', { tagId: tag.tagId, error: err.message });
        }
      }

      if (settings.smsEnabled && tag.lastEmailSentAt) {
        try {
          if (!tag.lastSmsSentAt && (now - tag.lastEmailSentAt >= smsEscalationDelay)) {
            await sendAlertSms(tag, 'ALARM');
            tag.lastSmsSentAt = new Date();
            await tag.save();
          } else if (tag.lastSmsSentAt && (now - tag.lastSmsSentAt >= smsRepeatInterval)) {
            await sendAlertSms(tag, 'ALARM');
            tag.lastSmsSentAt = new Date();
            await tag.save();
          }
        } catch (err) {
          logger.error('Failed to send alarm SMS', { tagId: tag.tagId, error: err.message });
        }
      }
    }

    // 3. Overdue email repeat logic for OVERDUE tags
    const overdueTags = await Tag.find({
      alertStatus: 'OVERDUE'
    }).populate(['equipment', 'assignedZone', 'currentZone']);

    for (const tag of overdueTags) {
      const overdueEmailInterval = settings.overdueEmailRepeatIntervalSec * 1000;
      const smsEscalationDelay = settings.smsEscalationDelaySec * 1000;
      const smsRepeatInterval = settings.smsRepeatIntervalSec * 1000;

      if (tag.lastOverdueEmailSentAt && (now - tag.lastOverdueEmailSentAt >= overdueEmailInterval)) {
        try {
          await sendAlertEmail(tag, 'OVERDUE');
          tag.lastOverdueEmailSentAt = new Date();
          await tag.save();
        } catch (err) {
          logger.error('Failed to repeat overdue email', { tagId: tag.tagId, error: err.message });
        }
      }

      if (settings.smsEnabled && tag.overdueAlertStart) {
        try {
          if (!tag.lastOverdueSmsSentAt && (now - tag.overdueAlertStart >= smsEscalationDelay)) {
            await sendAlertSms(tag, 'OVERDUE');
            tag.lastOverdueSmsSentAt = new Date();
            await tag.save();
          } else if (tag.lastOverdueSmsSentAt && (now - tag.lastOverdueSmsSentAt >= smsRepeatInterval)) {
            await sendAlertSms(tag, 'OVERDUE');
            tag.lastOverdueSmsSentAt = new Date();
            await tag.save();
          }
        } catch (err) {
          logger.error('Failed to send overdue SMS', { tagId: tag.tagId, error: err.message });
        }
      }
    }
  } catch (err) {
    logger.error('Scheduler error', { error: err.message });
  }
}

function stopScheduler() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { startScheduler, stopScheduler };