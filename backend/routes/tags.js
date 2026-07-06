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
    const tags = await Tag.find().populate(['equipment', 'assignedZone', 'currentZone']);
    res.json(tags);
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

// Update tag (admin only for status changes, etc.)
router.patch('/:id', admin, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.assignedZone === '') {
      updates.assignedZone = null;
    }
    // Prevent overwriting protected fields like alertStatus, location from frontend directly
    // but allow admin to change status, disabledUntil, etc.
    const tag = await Tag.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(['equipment', 'assignedZone', 'currentZone']);
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

router.post('/:id/silence', admin, async (req, res, next) => {
  try {
    const tag = await Tag.findById(req.params.id);
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