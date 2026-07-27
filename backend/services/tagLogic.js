const Tag = require('../models/Tag');
const MovementEvent = require('../models/MovementEvent');
const AlertLog = require('../models/AlertLog');
const Zone = require('../models/Zone');
const Reader = require('../models/Reader');
const TagLifecycle = require('../models/TagLifecycle');
const realtime = require('./realtime');


async function getZoneByReader(readerId) {
  if (!readerId) return null;
  const reader = await Reader.findOne({ readerId }).populate('zone');
  if (!reader) return null;
  if (reader.zone) return reader.zone;
  // Fallback: use reader.name as zone name if present
  if (reader.name) {
    let zone = await Zone.findOne({ name: reader.name });
    if (!zone) {
      zone = await Zone.create({ name: reader.name, description: reader.description || '' });
    }
    reader.zone = zone._id;
    await reader.save();
    return zone;
  }
  return null;
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
      // record lifecycle
      await TagLifecycle.create({
        tag: tag._id,
        tagId: tag.tagId,
        eventType: 'ALARM_RESOLVED',
        fromState: previousStatus,
        toState: 'NONE',
        actor: 'system',
        details: 'Zone restored to assigned zone'
      });
    }
    return { violation: false, resolved: tag.alertStatus !== 'NONE' };
  }

  if (tag.status === 'PERMANENT_DISABLED') return { violation: false, resolved: false };
  if (tag.alertStatus === 'ALARMING') return { violation: true, resolved: false };
  if (tag.alertStatus === 'OVERDUE') return { violation: true, resolved: false };

  const prev = tag.alertStatus;
  tag.alertStatus = 'ALARMING';
  tag.silenced = false;
  tag.lastAlarmBeepAt = now;
  await AlertLog.create({ type: 'ALARM_BEEP', tag: tag._id, tagId: tag.tagId, timestamp: now, details: 'Zone violation' });
  // lifecycle: alarm raised
  await TagLifecycle.create({
    tag: tag._id,
    tagId: tag.tagId,
    eventType: 'ALARM_RAISED',
    fromState: prev,
    toState: 'ALARMING',
    actor: 'system',
    details: 'Zone violation detected'
  });
  tag.lastEmailSentAt = new Date();
  // note: do not emit here; caller will save tag and emit populated tag after save
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
    await TagLifecycle.create({
      tag: tag._id,
      tagId: tag.tagId,
      eventType: 'DISABLED',
      fromState: tag.status,
      toState: 'PERMANENT_DISABLED',
      actor: 'system',
      details: 'Permanent disabled tag seen leaving'
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
    const mv = await MovementEvent.create({
      tag: tag._id,
      tagId,
      readerId,
      zone: zone ? zone._id : null,
      zoneTransition: tag.currentZone ? 'ENTER' : 'LEAVE',
      direction: 'EXIT',
      classification: result && result.violation ? 'UNINTENTIONAL' : 'INTENTIONAL'
    });
    // emit movement and updated tag (populate for client)
    try {
      const populated = await Tag.findById(tag._id).populate(['equipment', 'assignedZone', 'currentZone']);
      realtime.emit('tag:movement', { tag: populated, readerId, movement: result && result.violation ? 'UNINTENTIONAL' : 'INTENTIONAL', movementId: mv._id });
      if (populated.alertStatus === 'ALARMING') {
        realtime.emit('tag:alarm', { tag: populated });
      }
    } catch (err) {
      // best-effort
      realtime.emit('tag:movement', { tagId, readerId, movement: result && result.violation ? 'UNINTENTIONAL' : 'INTENTIONAL', movementId: mv._id });
    }
      // record lifecycle: movement
      await TagLifecycle.create({
        tag: tag._id,
        tagId: tag.tagId,
        eventType: 'EXIT',
        fromState: tag.location,
        toState: tag.location === 'OUTSIDE' ? 'OUTSIDE' : 'IN_ZONE',
        actor: 'system',
        details: result && result.violation ? 'Unintentional exit (zone violation)' : 'Intentional exit'
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
    const mv = await MovementEvent.create({
      tag: tag._id,
      tagId,
      readerId,
      zone: zone ? zone._id : null,
      zoneTransition: tag.currentZone ? 'ENTER' : 'LEAVE',
      direction: 'EXIT',
      classification: 'INTENTIONAL'
    });
    try {
      const populated = await Tag.findById(tag._id).populate(['equipment', 'assignedZone', 'currentZone']);
      realtime.emit('tag:movement', { tag: populated, readerId, movement: 'INTENTIONAL', movementId: mv._id });
    } catch (err) {
      realtime.emit('tag:movement', { tagId, readerId, movement: 'INTENTIONAL', movementId: mv._id });
    }
    await TagLifecycle.create({
      tag: tag._id,
      tagId: tag.tagId,
      eventType: 'EXIT',
      fromState: tag.location,
      toState: tag.location === 'OUTSIDE' ? 'OUTSIDE' : 'IN_ZONE',
      actor: 'system',
      details: 'Temp-disabled tag exit'
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
    await TagLifecycle.create({
      tag: tag._id,
      tagId: tag.tagId,
      eventType: 'ALARM_RESOLVED',
      fromState: wasAlarming ? 'ALARMING' : 'OVERDUE',
      toState: 'NONE',
      actor: 'system',
      details: 'Zone restored to assigned zone (return)'
    });
    const lastExit = await MovementEvent.findOne({ tag: tag._id, direction: 'EXIT', resolvedAt: null }).sort({ createdAt: -1 });
    if (lastExit) {
      lastExit.resolvedAt = new Date();
      await lastExit.save();
    }
  }

  await tag.save();
  const mv = await MovementEvent.create({
    tag: tag._id,
    tagId,
    readerId,
    zone: zone ? zone._id : null,
    zoneTransition: 'ENTER',
    direction: 'RETURN',
    classification: 'RETURN'
  });
  try {
    const populated = await Tag.findById(tag._id).populate(['equipment', 'assignedZone', 'currentZone']);
    realtime.emit('tag:movement', { tag: populated, readerId, movement: 'RETURN', movementId: mv._id });
  } catch (err) {
    realtime.emit('tag:movement', { tagId, readerId, movement: 'RETURN', movementId: mv._id });
  }
  await TagLifecycle.create({
    tag: tag._id,
    tagId: tag.tagId,
    eventType: 'RETURN',
    fromState: tag.location,
    toState: tag.location === 'OUTSIDE' ? 'OUTSIDE' : 'IN_ZONE',
    actor: 'system',
    details: 'Tag returned into zone'
  });

  return { tag, resolved: wasAlarming || wasOverdue };
}

module.exports = { handleExit, handleReturn };
