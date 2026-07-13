const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const authorize = require('../middleware/authorize');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.use(auth);
router.use(admin); // All user management routes admin-only

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').populate('zones');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Create user
router.post('/', validateBody(['username', 'password']), async (req, res, next) => {
  try {
    const { username, password, role, zones } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash: hash, role: role || 'USER', zones: zones || [] });
    res.status(201).json({ id: user._id, username: user.username, role: user.role, zones: user.zones });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.role) updates.role = req.body.role;
    if (req.body.hasOwnProperty('active')) updates.active = req.body.active;
    if (req.body.hasOwnProperty('zones')) updates.zones = req.body.zones;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-passwordHash').populate('zones');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;