const express = require('express');
const MovementEvent = require('../models/MovementEvent');
const AlertLog = require('../models/AlertLog');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/movements', async (req, res, next) => {
  try {
    const { tagId, start, end } = req.query;
    const filter = {};
    if (tagId) filter.tagId = tagId;
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = new Date(start);
      if (end) filter.createdAt.$lte = new Date(end);
    }
    const events = await MovementEvent.find(filter).sort({ createdAt: -1 }).populate('tag');
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const { tagId, start, end } = req.query;
    const filter = {};
    if (tagId) filter.tagId = tagId;
    if (start || end) {
      filter.timestamp = {};
      if (start) filter.timestamp.$gte = new Date(start);
      if (end) filter.timestamp.$lte = new Date(end);
    }
    const alerts = await AlertLog.find(filter).sort({ timestamp: -1 }).populate('tag');
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;