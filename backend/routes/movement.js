const express = require('express');
const { handleExit, handleReturn } = require('../services/tagLogic');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

// Simulator routes (no auth required for demo, but should be protected in production)
router.post('/simulate/exit', validateBody(['tagId', 'readerId']), async (req, res, next) => {
  try {
    const { tagId, readerId } = req.body;
    if (!tagId || !readerId) return res.status(400).json({ error: 'tagId and readerId required' });
    const result = await handleExit(tagId, readerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/simulate/return', validateBody(['tagId', 'readerId']), async (req, res, next) => {
  try {
    const { tagId, readerId } = req.body;
    const result = await handleReturn(tagId, readerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;