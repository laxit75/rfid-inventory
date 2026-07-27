const express = require('express');
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBody } = require('../middleware/validateRequest');
const { publishSpeakerJob } = require('../services/queue');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find().populate('zone');
    res.json(devices);
  } catch (err) {
    next(err);
  }
});

router.post('/', admin, validateBody(['name', 'type', 'endpoint', 'secret']), async (req, res, next) => {
  try {
    const { name, type, endpoint, secret, zone, active } = req.body;
    const device = await Device.create({ name, type, endpoint, secret, zone: zone || null, active: typeof active === 'boolean' ? active : true });
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', admin, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    const device = await Device.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', admin, async (req, res, next) => {
  try {
    await Device.findByIdAndDelete(req.params.id);
    res.json({ message: 'Device deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', admin, async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    publishSpeakerJob({ deviceId: device._id.toString(), type: 'TEST' });
    res.json({ message: 'Speaker test job published', deviceId: device._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
