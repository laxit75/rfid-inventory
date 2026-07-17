const express = require('express');
const Reader = require('../models/Reader');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    res.json(await Reader.find().populate('zone').sort({ name: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post('/', admin, validateBody(['readerId', 'name']), async (req, res, next) => {
  try {
    const reader = await Reader.create(req.body);
    res.status(201).json(await reader.populate('zone'));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', admin, validateBody(['readerId', 'name']), async (req, res, next) => {
  try {
    const reader = await Reader.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('zone');
    if (!reader) return res.status(404).json({ error: 'Reader not found' });
    res.json(reader);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
