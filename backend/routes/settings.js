const express = require('express');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.use(auth);

// Get current settings (any authenticated user)
router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// Update settings (admin only, password-protected via admin middleware)
router.put('/', admin, validateBody(['alarmDurationSec', 'alarmRepeatIntervalSec', 'alarmVolume', 'alarmMuted', 'emailRepeatIntervalSec', 'overdueEmailRepeatIntervalSec']), async (req, res, next) => {
  try {
    const updates = req.body;
    const settings = await Settings.findOneAndUpdate({}, updates, { new: true, upsert: true });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
