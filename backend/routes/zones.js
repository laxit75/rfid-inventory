const express = require('express');
const Zone = require('../models/Zone');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const zones = await Zone.find().sort({ name: 1 });
    res.json(zones);
  } catch (err) {
    next(err);
  }
});

router.post('/', admin, validateBody(['name']), async (req, res, next) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', admin, validateBody(['name']), async (req, res, next) => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    res.json(zone);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', admin, async (req, res, next) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
