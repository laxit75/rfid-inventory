const express = require('express');
const Reader = require('../models/Reader');
const { handleExit, handleReturn } = require('../services/tagLogic');
const { handleTagEvent } = require('../services/tagAlertService');
const logger = require('../utils/logger');

const router = express.Router();
const recentReads = new Map();
const DEBOUNCE_MS = 3000;

router.use((req, res, next) => {
  const expectedSecret = process.env.RFID_WEBHOOK_SECRET;
  const receivedSecret = req.headers['x-rfid-secret'];
  if (!expectedSecret || typeof receivedSecret !== 'string' || receivedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized RFID webhook request' });
  }
  next();
});

router.post('/debug', (req, res) => {
  logger.info('RFID debug payload received', { rawBody: req.rawBody || '', body: req.body });
  res.sendStatus(200);
});

function extractReads(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.reads)) return payload.reads;
  if (Array.isArray(payload?.tags)) return payload.tags;
  return [payload];
}

function normalizeRead(read) {
  // CONFIRM against real hardware payload before relying on this in production.
  const tagId = read?.tagId || read?.tag_id || read?.epc || read?.EPC || read?.rfid || read?.rfidTag;
  const antennaValue = read?.antennaPort ?? read?.antenna_port ?? read?.antenna ?? read?.port;
  const antennaPort = Number(antennaValue);
  return { tagId: typeof tagId === 'string' ? tagId.trim() : '', antennaPort };
}

function isDuplicate(tagId, antennaPort) {
  const now = Date.now();
  for (const [key, expiresAt] of recentReads) {
    if (expiresAt <= now) recentReads.delete(key);
  }
  const key = `${tagId}:${antennaPort}`;
  if (recentReads.has(key)) return true;
  recentReads.set(key, now + DEBOUNCE_MS);
  return false;
}

router.post('/ingest', async (req, res, next) => {
  try {
    const results = [];
    for (const rawRead of extractReads(req.body)) {
      const { tagId, antennaPort } = normalizeRead(rawRead);
      if (!tagId || !Number.isFinite(antennaPort)) {
        results.push({ accepted: false, error: 'A tag identifier and antenna port are required' });
        continue;
      }
      if (isDuplicate(tagId, antennaPort)) {
        results.push({ tagId, antennaPort, accepted: false, duplicate: true });
        continue;
      }

      const reader = await Reader.findOne({ antennaPort });
      if (!reader || !reader.direction) {
        results.push({ tagId, antennaPort, accepted: false, error: 'No directed reader configured for antenna port' });
        continue;
      }

      const result = reader.direction === 'EXIT'
        ? await handleExit(tagId, reader.readerId)
        : await handleReturn(tagId, reader.readerId);

      const isViolation = reader.direction === 'EXIT' ? Boolean(result?.alertTriggered) : false;
      await handleTagEvent({
        tagId,
        zoneId: reader.zone || null,
        eventType: reader.direction === 'EXIT' ? 'exit' : 'return'
      }, { isViolation });

      results.push({ tagId, antennaPort, accepted: true, direction: reader.direction, movement: result.movement || 'RETURN' });
    }

    const hasAcceptedRead = results.some((result) => result.accepted);
    res.status(hasAcceptedRead ? 200 : 400).json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
