const express = require('express');
const Equipment = require('../models/Equipment');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const equipment = await Equipment.find().sort({ name: 1 });
    res.json(equipment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
