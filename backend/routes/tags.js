const express = require('express');
const Tag = require('../models/Tag');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// All tag routes require authentication
router.use(auth);

// List all tags (populated)
router.get('/', async (req, res, next) => {
  try {
    const filter = req.query.zone ? { $or: [{ assignedZone: req.query.zone }, { currentZone: req.query.zone }] } : {};
    const tags = await Tag.find(filter).populate(['equipment', 'assignedZone', 'currentZone']);
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// Create a new tag (admin only)
router.post('/', admin, async (req, res, next) => {
  try {
    const { tagId, equipment, assignedZone, status, disabledUntil, disableReason } = req.body;
    const newTag = await Tag.create({
      tagId,
      equipment,
      assignedZone: assignedZone || null,
      status: status || 'ACTIVE',
      disabledUntil: disabledUntil || null,
      disableReason: disableReason || ''
    });
    const tag = await Tag.findById(newTag._id).populate(['equipment', 'assignedZone', 'currentZone']);
    res.status(201).json(tag);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Tag ID already exists' });
    }
    next(err);
  }
});

// Get tag history (movements, alerts, lifecycle)
router.get('/:id/history', async (req, res, next) => {
  try {
    const tag = await Tag.findById(req.params.id).populate(['equipment', 'assignedZone', 'currentZone']).lean();
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const [movements, alerts, lifecycle] = await Promise.all([
      require('../models/MovementEvent').find({ tag: tag._id }).sort({ createdAt: -1 }).lean(),
      require('../models/AlertLog').find({ tag: tag._id }).sort({ timestamp: -1 }).lean(),
      require('../models/TagLifecycle').find({ tag: tag._id }).sort({ createdAt: -1 }).lean()
    ]);

    res.json({ tag, movements, alerts, lifecycle });
  } catch (err) {
    next(err);
  }
});

// Get single tag
router.get('/:id', async (req, res, next) => {
  try {
    const tag = await Tag.findById(req.params.id).populate(['equipment', 'assignedZone', 'currentZone']);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

// Update tag (admin or zone-manager for tags in their zones)
const authorize = require('../middleware/authorize');

async function zoneManagerCheck(req, res, next) {
  try {
    // Admin bypass is handled by authorize; if user is ZONE_MANAGER, verify tag's zone
    if (req.user && req.user.role === 'ZONE_MANAGER') {
      const tag = await Tag.findById(req.params.id).populate(['assignedZone', 'currentZone']);
      if (!tag) return res.status(404).json({ error: 'Tag not found' });
      const userZoneIds = (req.user.zones || []).map(String);
      const tagZoneId = (tag.assignedZone && tag.assignedZone._id) || (tag.currentZone && tag.currentZone._id);
      if (!tagZoneId) return res.status(403).json({ error: 'Tag is not assigned to a zone' });
      if (!userZoneIds.includes(String(tagZoneId))) return res.status(403).json({ error: 'Forbidden' });
      // attach loaded tag to request for downstream handlers to reuse
      req.tag = tag;
      return next();
    }
    // For non-zone-manager, pass through to authorize which will require ADMIN
    return authorize('ADMIN')(req, res, next);
  } catch (err) {
    next(err);
  }
}

router.patch('/:id', auth, zoneManagerCheck, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.assignedZone === '') {
      updates.assignedZone = null;
    }
    // Prevent overwriting protected fields like alertStatus, location from frontend directly
    // but allow admin to change status, disabledUntil, etc.
    // If `zoneManagerCheck` already loaded the tag, use it; otherwise perform update as admin
    let tag;
    if (req.tag) {
      Object.assign(req.tag, updates);
      tag = await req.tag.save();
      tag = await Tag.findById(tag._id).populate(['equipment', 'assignedZone', 'currentZone']);
    } else {
      tag = await Tag.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(['equipment', 'assignedZone', 'currentZone']);
    }
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    // If admin updated disabledUntil to future and tag was OVERDUE, resolve overdue (test implicit)
    if (tag.status === 'TEMP_DISABLED' && tag.disabledUntil && tag.disabledUntil > new Date() && tag.alertStatus === 'OVERDUE') {
      const AlertLog = require('../models/AlertLog');
      await AlertLog.create({
        type: 'OVERDUE_RESOLVED',
        tag: tag._id,
        tagId: tag.tagId,
        timestamp: new Date(),
        details: 'Admin extended disabledUntil'
      });
      tag.alertStatus = 'NONE';
      tag.overdueAlertStart = null;
      tag.lastOverdueEmailSentAt = null;
      await tag.save();
    }
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/silence', auth, zoneManagerCheck, async (req, res, next) => {
  try {
    // reuse loaded tag when available
    const tag = req.tag || await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    if (tag.alertStatus !== 'ALARMING') return res.status(400).json({ error: 'Tag is not currently alarming' });
    tag.silenced = true;
    await tag.save();
    res.json({ message: 'Alarm silenced', tag });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
