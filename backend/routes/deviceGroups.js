const express = require('express');
const DeviceGroup = require('../models/DeviceGroup');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

router.use(auth);

// List all device groups with populated references
router.get('/', async (req, res, next) => {
  try {
    const groups = await DeviceGroup.find()
      .populate(['readers', 'tags', 'speakers'])
      .sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Get a single device group
router.get('/:id', async (req, res, next) => {
  try {
    const group = await DeviceGroup.findById(req.params.id)
      .populate(['readers', 'tags', 'speakers']);
    if (!group) return res.status(404).json({ error: 'Device group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// Create device group (admin only)
router.post('/', admin, async (req, res, next) => {
  try {
    const { name, description, readers, tags, speakers } = req.body;
    const group = await DeviceGroup.create({
      name,
      description: description || '',
      readers: Array.isArray(readers) ? readers : [],
      tags: Array.isArray(tags) ? tags : [],
      speakers: Array.isArray(speakers) ? speakers : []
    });
    const populated = await DeviceGroup.findById(group._id)
      .populate(['readers', 'tags', 'speakers']);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Group name already exists' });
    next(err);
  }
});

// Update device group (admin only)
router.put('/:id', admin, async (req, res, next) => {
  try {
    const { name, description, readers, tags, speakers } = req.body;
    const group = await DeviceGroup.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description: description || '',
        readers: Array.isArray(readers) ? readers : [],
        tags: Array.isArray(tags) ? tags : [],
        speakers: Array.isArray(speakers) ? speakers : []
      },
      { new: true, runValidators: true }
    ).populate(['readers', 'tags', 'speakers']);
    if (!group) return res.status(404).json({ error: 'Device group not found' });
    res.json(group);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Group name already exists' });
    next(err);
  }
});

// Delete device group (admin only)
router.delete('/:id', admin, async (req, res, next) => {
  try {
    const group = await DeviceGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: 'Device group not found' });

    // Remove references from alert flows that use this group as source
    await require('../models/AlertFlow').deleteMany({ sourceGroup: req.params.id });

    res.json({ message: 'Device group deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
