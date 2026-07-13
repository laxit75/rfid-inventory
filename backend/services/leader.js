const os = require('os');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let intervalId = null;
let isLeader = false;
let instanceId = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

async function tryAcquire(collection, ttlMs) {
  const cutoff = new Date(Date.now() - ttlMs);
  const filter = { _id: 'leader', $or: [ { owner: instanceId }, { heartbeat: { $lt: cutoff } } ] };
  const update = { $set: { owner: instanceId, heartbeat: new Date() } };
  const opts = { upsert: true, returnDocument: 'after' };
  const res = await collection.findOneAndUpdate(filter, update, opts);
  return res && res.value && res.value.owner === instanceId;
}

async function heartbeat(collection) {
  try {
    const cutoff = new Date(Date.now() - 10000);
    // attempt to take or renew leadership
    const filter = { _id: 'leader', $or: [ { owner: instanceId }, { heartbeat: { $lt: cutoff } } ] };
    const update = { $set: { owner: instanceId, heartbeat: new Date() } };
    const opts = { upsert: true, returnDocument: 'after' };
    const res = await collection.findOneAndUpdate(filter, update, opts);
    const nowLeader = !!(res && res.value && res.value.owner === instanceId);
    if (nowLeader && !isLeader) {
      isLeader = true;
      logger.info('Acquired leadership', { instanceId });
      if (typeof onAcquire === 'function') onAcquire();
    } else if (!nowLeader && isLeader) {
      isLeader = false;
      logger.warn('Lost leadership', { instanceId });
      if (typeof onRelease === 'function') onRelease();
    }
  } catch (err) {
    logger.warn('Heartbeat error', { error: err.message });
  }
}

let onAcquire = null;
let onRelease = null;

function start(options = {}) {
  const ttlMs = options.ttlMs || 10000;
  const intervalMs = options.heartbeatIntervalMs || 3000;
  onAcquire = options.onAcquire;
  onRelease = options.onRelease;
  const collection = mongoose.connection.collection('leader_locks');
  // run immediately then on interval
  intervalId = setInterval(() => heartbeat(collection), intervalMs);
  // initial attempt
  heartbeat(collection);
}

async function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  try {
    const collection = mongoose.connection.collection('leader_locks');
    await collection.deleteOne({ _id: 'leader', owner: instanceId });
  } catch (err) {
    // ignore
  }
  if (isLeader && typeof onRelease === 'function') onRelease();
  isLeader = false;
}

module.exports = { start, stop, getInstanceId: () => instanceId, isLeader: () => isLeader };
