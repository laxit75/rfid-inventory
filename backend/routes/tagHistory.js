const express = require('express');
const Tag = require('../models/Tag');
const MovementEvent = require('../models/MovementEvent');
const AlertLog = require('../models/AlertLog');
const TagLifecycle = require('../models/TagLifecycle');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/:id/history', async (req, res, next) => {
  try {
    const tag = await Tag.findById(req.params.id).lean();
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const [movements, alerts, lifecycle] = await Promise.all([
      MovementEvent.find({ tag: tag._id }).sort({ createdAt: -1 }).lean(),
      AlertLog.find({ tag: tag._id }).sort({ timestamp: -1 }).lean(),
      TagLifecycle.find({ tag: tag._id }).sort({ createdAt: -1 }).lean()
    ]);

    res.json({ tag, movements, alerts, lifecycle });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
