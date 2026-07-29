const express = require('express');
const AlertTargetGroup = require('../models/AlertTargetGroup');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

router.use(auth);

// List all alert target groups with populated recipients and tag assignments
router.get('/', async (req, res, next) => {
  try {
    const groups = await AlertTargetGroup.find()
      .populate([
        'recipients',
        { path: 'tagAssignments', populate: { path: 'tagId' } }
      ])
      .sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Get a single alert target group
router.get('/:id', async (req, res, next) => {
  try {
    const group = await AlertTargetGroup.findById(req.params.id)
      .populate([
        'recipients',
        { path: 'tagAssignments', populate: { path: 'tagId' } }
      ]);
    if (!group) return res.status(404).json({ error: 'Alert target group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// Create alert target group (admin only)
router.post('/', admin, async (req, res, next) => {
  try {
    const { name, description, recipients, tagAssignments } = req.body;
    const group = await AlertTargetGroup.create({
      name,
      description: description || '',
      recipients: Array.isArray(recipients) ? recipients : [],
      tagAssignments: Array.isArray(tagAssignments) ? tagAssignments : []
    });
    const populated = await AlertTargetGroup.findById(group._id)
      .populate([
        'recipients',
        { path: 'tagAssignments', populate: { path: 'tagId' } }
      ]);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Group name already exists' });
    next(err);
  }
});

// Update alert target group (admin only)
router.put('/:id', admin, async (req, res, next) => {
  try {
    const { name, description, recipients, tagAssignments } = req.body;
    const group = await AlertTargetGroup.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description: description || '',
        recipients: Array.isArray(recipients) ? recipients : [],
        tagAssignments: Array.isArray(tagAssignments) ? tagAssignments : []
      },
      { new: true, runValidators: true }
    ).populate([
      'recipients',
      { path: 'tagAssignments', populate: { path: 'tagId' } }
    ]);
    if (!group) return res.status(404).json({ error: 'Alert target group not found' });
    res.json(group);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Group name already exists' });
    next(err);
  }
});

// Delete alert target group (admin only)
router.delete('/:id', admin, async (req, res, next) => {
  try {
    const group = await AlertTargetGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: 'Alert target group not found' });

    // Remove references from alert flows
    await require('../models/AlertFlow').updateMany(
      { targetGroups: req.params.id },
      { $pull: { targetGroups: req.params.id } }
    );

    res.json({ message: 'Alert target group deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
