const Tag = require('../models/Tag');
const MovementEvent = require('../models/MovementEvent');
const AlertLog = require('../models/AlertLog');
const Zone = require('../models/Zone');
const { sendAlertEmail } = require('./emailService');

const readerZoneMap = {
  'Shutter-1': {
    name: 'Zone A - Test Bay',
    description: 'Primary test bay'
  },
  'Shutter-2': {
    name: 'Zone B - Paint Shop',
    description: 'Paint and finishing zone'
  }
};

async function getZoneByReader(readerId) {
  const zoneDef = readerZoneMap[readerId];
  if (!zoneDef) return null;
  let zone = await Zone.findOne({ name: zoneDef.name });
  if (!zone) {
    zone = await Zone.create(zoneDef);
  }
  return zone;
}

async function evaluateZoneViolation(tag, now) {
  const assignedZoneId = tag.assignedZone ? tag.assignedZone._id?.toString() || tag.assignedZone.toString() : null;
  const currentZoneId = tag.currentZone ? tag.currentZone._id?.toString() || tag.currentZone.toString() : null;
  const isViolation = !!assignedZoneId && currentZoneId !== assignedZoneId;

  if (!isViolation) {
    if (tag.alertStatus === 'ALARMING' || tag.alertStatus === 'OVERDUE') {
      const previousStatus = tag.alertStatus;
      tag.alertStatus = 'NONE';
      tag.silenced = false;
      tag.lastAlarmBeepAt = null;
      tag.lastEmailSentAt = null;
      tag.overdueAlertStart = null;
      tag.lastOverdueEmailSentAt = null;
      await AlertLog.create({
        type: previousStatus === 'ALARMING' ? 'ALARM_RESOLVED' : 'OVERDUE_RESOLVED',
        tag: tag._id,
        tagId: tag.tagId,
        timestamp: now,
        details: 'Zone restored to assigned zone'
      });
    }
    return { violation: false, resolved: tag.alertStatus !== 'NONE' };
  }

  if (tag.status === 'PERMANENT_DISABLED') return { violation: false, resolved: false };
  if (tag.alertStatus === 'ALARMING') return { violation: true, resolved: false };
  if (tag.alertStatus === 'OVERDUE') return { violation: true, resolved: false };

  tag.alertStatus = 'ALARMING';
  tag.silenced = false;
  tag.lastAlarmBeepAt = now;
  await AlertLog.create({ type: 'ALARM_BEEP', tag: tag._id, tagId: tag.tagId, timestamp: now, details: 'Zone violation' });
  await sendAlertEmail(tag, 'ALARM');
  tag.lastEmailSentAt = new Date();
  return { violation: true, resolved: false };
}

async function handleExit(tagId, readerId) {
  const tag = await Tag.findOne({ tagId }).populate(['equipment', 'assignedZone', 'currentZone']);
  if (!tag) throw new Error('Tag not found');

  const zone = await getZoneByReader(readerId);
  const now = new Date();

  if (tag.status === 'PERMANENT_DISABLED') {
    await MovementEvent.create({
      tag: tag._id,
      tagId,
      readerId,
      zone: zone ? zone._id : null,
      zoneTransition: 'LEAVE',
      direction: 'EXIT',
      classification: 'PERMANENTLY_DISABLED'
    });
    return { tag, movement: 'PERMANENTLY_DISABLED', alertTriggered: false };
  }

  const wasAlarming = tag.alertStatus === 'ALARMING';
  const wasOverdue = tag.alertStatus === 'OVERDUE';

  if (tag.currentZone && tag.currentZone._id.toString() === (zone ? zone._id.toString() : '')) {
    tag.currentZone = null;
    tag.location = 'OUTSIDE';
    tag.zoneTransition = 'LEAVE';
  } else if (zone) {
    tag.currentZone = zone._id;
    tag.location = 'IN_ZONE';
    tag.zoneTransition = 'ENTER';
  } else {
    tag.currentZone = null;
    tag.location = 'OUTSIDE';
  }

  if (tag.status === 'ACTIVE') {
    const result = await evaluateZoneViolation(tag, now);
    await tag.save();
    await MovementEvent.create({
      tag: tag._id,
      tagId,
      readerId,
      zone: zone ? zone._id : null,
      zoneTransition: tag.currentZone ? 'ENTER' : 'LEAVE',
      direction: 'EXIT',
      classification: result && result.violation ? 'UNINTENTIONAL' : 'INTENTIONAL'
    });
    return { tag, movement: result && result.violation ? 'UNINTENTIONAL' : 'INTENTIONAL', alertTriggered: result && result.violation };
  }

  if (tag.status === 'TEMP_DISABLED') {
    if (tag.alertStatus === 'OVERDUE') {
      await AlertLog.create({
        type: 'OVERDUE_RESOLVED',
        tag: tag._id,
        tagId,
        timestamp: now,
        details: 'Temp-disabled tag changed zones'
      });
      tag.alertStatus = 'NONE';
      tag.overdueAlertStart = null;
      tag.lastOverdueEmailSentAt = null;
    }
    await tag.save();
    await MovementEvent.create({
      tag: tag._id,
      tagId,
      readerId,
      zone: zone ? zone._id : null,
      zoneTransition: tag.currentZone ? 'ENTER' : 'LEAVE',
      direction: 'EXIT',
      classification: 'INTENTIONAL'
    });
    return { tag, movement: 'INTENTIONAL', alertTriggered: false };
  }

  return { tag, movement: 'UNKNOWN', alertTriggered: false };
}

async function handleReturn(tagId, readerId) {
  const tag = await Tag.findOne({ tagId }).populate(['equipment', 'assignedZone', 'currentZone']);
  if (!tag) throw new Error('Tag not found');

  const zone = await getZoneByReader(readerId);
  const wasAlarming = tag.alertStatus === 'ALARMING';
  const wasOverdue = tag.alertStatus === 'OVERDUE';
  const now = new Date();

  if (zone) {
    tag.currentZone = zone._id;
    tag.location = 'IN_ZONE';
  } else {
    tag.currentZone = null;
    tag.location = 'OUTSIDE';
  }

  if (wasAlarming || wasOverdue) {
    tag.alertStatus = 'NONE';
    tag.silenced = false;
    tag.lastAlarmBeepAt = null;
    tag.lastEmailSentAt = null;
    tag.overdueAlertStart = null;
    tag.lastOverdueEmailSentAt = null;
    await AlertLog.create({
      type: wasAlarming ? 'ALARM_RESOLVED' : 'OVERDUE_RESOLVED',
      tag: tag._id,
      tagId,
      timestamp: now,
      details: 'Zone restored to assigned zone'
    });
    const lastExit = await MovementEvent.findOne({ tag: tag._id, direction: 'EXIT', resolvedAt: null }).sort({ createdAt: -1 });
    if (lastExit) {
      lastExit.resolvedAt = new Date();
      await lastExit.save();
    }
  }

  await tag.save();
  await MovementEvent.create({
    tag: tag._id,
    tagId,
    readerId,
    zone: zone ? zone._id : null,
    zoneTransition: 'ENTER',
    direction: 'RETURN',
    classification: 'RETURN'
  });

  return { tag, resolved: wasAlarming || wasOverdue };
}

module.exports = { handleExit, handleReturn };