const express = require('express');
const TagAlertState = require('../models/TagAlertState');
const { muteTag, resolveTag } = require('../services/handleTagEvent');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const logger = require('../utils/logger');

const router = express.Router();

router.use(auth);

/**
 * GET /api/tag-alert-states
 * List all TagAlertState records, optionally filtered by status.
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    } else {
      // Default: exclude 'normal' tags — they have no active alerts
      filter.status = { $ne: 'normal' };
    }
    const states = await TagAlertState.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(states);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tag-alert-states/:tagId
 * Get a single TagAlertState by tag ID.
 */
router.get('/:tagId', async (req, res, next) => {
  try {
    const state = await TagAlertState.findOne({ tagId: req.params.tagId }).lean();
    if (!state) return res.status(404).json({ error: 'Tag alert state not found' });
    res.json(state);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tag-alert-states/:tagId/mute
 * Mute an alerting tag. Only works if tag is in 'unintentional_alert' state.
 * Body: { mutedBy?: string, muteDurationMs?: number }
 */
router.post('/:tagId/mute', async (req, res, next) => {
  try {
    const { mutedBy, muteDurationMs } = req.body;
    const state = await muteTag(
      req.params.tagId,
      mutedBy || req.user?.username || 'operator',
      muteDurationMs || 5 * 60 * 1000 // default 5 minutes
    );
    res.json({ message: 'Tag muted', state });
  } catch (err) {
    if (err.message === 'Tag not found') return res.status(404).json({ error: err.message });
    if (err.message === 'Tag is not currently in alert state') return res.status(400).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/tag-alert-states/:tagId/resolve
 * Manually resolve an alert. Works regardless of current state.
 */
router.post('/:tagId/resolve', async (req, res, next) => {
  try {
    const state = await resolveTag(req.params.tagId, req.user?.username || 'operator');
    res.json({ message: 'Tag alert resolved', state });
  } catch (err) {
    if (err.message === 'Tag not found') return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
