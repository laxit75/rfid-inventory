const mongoose = require('mongoose');
const Tag = require('../models/Tag');
const realtime = require('./realtime');
const logger = require('../utils/logger');

let changeStream = null;

/**
 * Bounded deduplication cache for change stream events.
 * Uses a Map with an LRU-like eviction when cache exceeds MAX_ENTRIES.
 * This prevents unbounded memory growth when the change stream is long-lived.
 */
const MAX_DEDUPE_ENTRIES = 1000;
const lastSeen = new Map();

function trackChange(docId, changeId) {
  // Evict oldest entry if at capacity
  if (lastSeen.size >= MAX_DEDUPE_ENTRIES) {
    const oldestKey = lastSeen.keys().next().value;
    if (oldestKey) lastSeen.delete(oldestKey);
  }
  lastSeen.set(docId, changeId);
}

async function startChangeStream() {
  if (changeStream) return;
  try {
    // Use the underlying collection watch to start a change stream. This requires a replica set.
    changeStream = Tag.watch([], { fullDocument: 'updateLookup' });
    changeStream.on('change', async (change) => {
      try {
        // We only care about inserts and updates that change relevant fields
        if (!['insert', 'update', 'replace'].includes(change.operationType)) return;

        const changeId = change._id && change._id._data ? String(change._id._data) : String(change._id);
        const docId = change.documentKey && change.documentKey._id ? String(change.documentKey._id) : null;
        if (!docId) return;

        // Dedupe: skip if we've already seen this change id for the doc
        const existing = lastSeen.get(docId);
        if (existing === changeId) return;
        trackChange(docId, changeId);

        // fullDocument will be present because of updateLookup
        const full = change.fullDocument || await Tag.findById(docId).populate(['equipment','assignedZone','currentZone']);
        if (!full) return;

        realtime.emit('tag:change', { tag: full, changeType: change.operationType });
        // Also emit for older clients' event names
        realtime.emit('tag:movement', { tag: full });
        if (full.alertStatus === 'ALARMING') realtime.emit('tag:alarm', { tag: full });
      } catch (err) {
        logger.warn('Error handling change stream event', { error: err.message });
      }
    });
    changeStream.on('error', (err) => {
      logger.warn('Change stream error', { error: err.message });
      // Clear dedupe cache on error to prevent stale entries from blocking events
      lastSeen.clear();
      // Close and cleanup so startChangeStream can retry later
      try { changeStream.close(); } catch (e) {}
      changeStream = null;
    });
    logger.info('Tag change stream started');
  } catch (err) {
    logger.warn('Unable to start change stream (replica set required)', { error: err.message });
    changeStream = null;
  }
}

async function stopChangeStream() {
  if (!changeStream) return;
  try {
    await changeStream.close();
  } catch (err) {
    // ignore
  }
  lastSeen.clear();
  changeStream = null;
}

module.exports = { startChangeStream, stopChangeStream };
