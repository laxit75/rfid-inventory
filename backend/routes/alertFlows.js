const express = require('express');
const AlertFlow = require('../models/AlertFlow');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

router.use(auth);

// List all alert flows with populated references
router.get('/', async (req, res, next) => {
  try {
    const flows = await AlertFlow.find()
      .populate([
        { path: 'sourceGroup', populate: ['readers', 'tags', 'speakers'] },
        { path: 'targetGroups', populate: 'recipients' },
        'speakerDevices'
      ])
      .sort({ name: 1 });
    res.json(flows);
  } catch (err) {
    next(err);
  }
});

// Get a single alert flow
router.get('/:id', async (req, res, next) => {
  try {
    const flow = await AlertFlow.findById(req.params.id)
      .populate([
        { path: 'sourceGroup', populate: ['readers', 'tags', 'speakers'] },
        { path: 'targetGroups', populate: 'recipients' },
        'speakerDevices'
      ]);
    if (!flow) return res.status(404).json({ error: 'Alert flow not found' });
    res.json(flow);
  } catch (err) {
    next(err);
  }
});

// Create alert flow (admin only)
router.post('/', admin, async (req, res, next) => {
  try {
    const { name, description, enabled, sourceGroup, targetGroups, speakerDevices, triggerOnExit, triggerOnOverdue, isResolutionRequired } = req.body;
    const flow = await AlertFlow.create({
      name,
      description: description || '',
      enabled: enabled !== undefined ? enabled : true,
      sourceGroup,
      targetGroups: Array.isArray(targetGroups) ? targetGroups : [],
      speakerDevices: Array.isArray(speakerDevices) ? speakerDevices : [],
      triggerOnExit: triggerOnExit !== undefined ? triggerOnExit : true,
      triggerOnOverdue: triggerOnOverdue !== undefined ? triggerOnOverdue : true,
      isResolutionRequired: isResolutionRequired || false
    });
    const populated = await AlertFlow.findById(flow._id)
      .populate([
        { path: 'sourceGroup', populate: ['readers', 'tags', 'speakers'] },
        { path: 'targetGroups', populate: 'recipients' },
        'speakerDevices'
      ]);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Alert flow name already exists' });
    next(err);
  }
});

// Update alert flow (admin only)
router.put('/:id', admin, async (req, res, next) => {
  try {
    // Whitelist only known fields to prevent overwriting protected properties
    const allowedFields = [
      'name', 'description', 'enabled', 'sourceGroup',
      'targetGroups', 'speakerDevices',
      'triggerOnExit', 'triggerOnOverdue', 'isResolutionRequired'
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const flow = await AlertFlow.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate([
      { path: 'sourceGroup', populate: ['readers', 'tags', 'speakers'] },
      { path: 'targetGroups', populate: 'recipients' },
      'speakerDevices'
    ]);
    if (!flow) return res.status(404).json({ error: 'Alert flow not found' });
    res.json(flow);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Alert flow name already exists' });
    next(err);
  }
});

// Toggle alert flow enabled/disabled
router.patch('/:id/toggle', admin, async (req, res, next) => {
  try {
    const flow = await AlertFlow.findById(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Alert flow not found' });
    flow.enabled = !flow.enabled;
    await flow.save();
    res.json({ enabled: flow.enabled, message: `Alert flow ${flow.enabled ? 'enabled' : 'disabled'}` });
  } catch (err) {
    next(err);
  }
});

// Delete alert flow (admin only)
router.delete('/:id', admin, async (req, res, next) => {
  try {
    const flow = await AlertFlow.findByIdAndDelete(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Alert flow not found' });
    res.json({ message: 'Alert flow deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
