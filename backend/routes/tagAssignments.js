const express = require('express');
const TagAssignment = require('../models/TagAssignment');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

router.use(auth);

// List all tag assignments with populated tag info
router.get('/', async (req, res, next) => {
  try {
    const assignments = await TagAssignment.find()
      .populate('tagId')
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// Get assignments for a specific group
router.get('/by-group/:groupId', async (req, res, next) => {
  try {
    const group = await require('../models/AlertTargetGroup').findById(req.params.groupId)
      .populate({
        path: 'tagAssignments',
        populate: { path: 'tagId' }
      });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group.tagAssignments || []);
  } catch (err) {
    next(err);
  }
});

// Create a tag assignment (admin only)
router.post('/', admin, async (req, res, next) => {
  try {
    const { tagId, personName, personEmail, notes } = req.body;
    if (!tagId || !personName || !personEmail) {
      return res.status(400).json({ error: 'tagId, personName, and personEmail are required' });
    }
    const assignment = await TagAssignment.create({
      tagId,
      personName,
      personEmail,
      notes: notes || '',
      assignedBy: req.user?._id || null
    });
    const populated = await TagAssignment.findById(assignment._id).populate('tagId');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// Update a tag assignment (admin only)
router.put('/:id', admin, async (req, res, next) => {
  try {
    const { personName, personEmail, notes, tagId } = req.body;
    const updates = {};
    if (personName) updates.personName = personName;
    if (personEmail) updates.personEmail = personEmail;
    if (notes !== undefined) updates.notes = notes;
    if (tagId) updates.tagId = tagId;

    const assignment = await TagAssignment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('tagId');
    if (!assignment) return res.status(404).json({ error: 'Tag assignment not found' });
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

// Delete a tag assignment (admin only)
router.delete('/:id', admin, async (req, res, next) => {
  try {
    const assignment = await TagAssignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Tag assignment not found' });

    // Remove reference from any alert target groups
    await require('../models/AlertTargetGroup').updateMany(
      { tagAssignments: req.params.id },
      { $pull: { tagAssignments: req.params.id } }
    );

    res.json({ message: 'Tag assignment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
