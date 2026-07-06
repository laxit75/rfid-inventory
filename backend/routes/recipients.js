const express = require('express');
const Recipient = require('../models/Recipient');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.use(auth);
router.use(admin); // All recipient management is admin-only

router.get('/', async (req, res, next) => {
  try {
    const recipients = await Recipient.find();
    res.json(recipients);
  } catch (err) {
    next(err);
  }
});

router.post('/', validateBody(['email', 'name']), async (req, res, next) => {
  try {
    const { email, name } = req.body;
    const recipient = await Recipient.create({ email, name });
    res.status(201).json(recipient);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validateBody(['email', 'name']), async (req, res, next) => {
  try {
    const { email, name } = req.body;
    const recipient = await Recipient.findByIdAndUpdate(req.params.id, { email, name }, { new: true });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    res.json(recipient);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Recipient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Recipient deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;