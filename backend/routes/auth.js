const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.post('/login', validateBody(['username', 'password']), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, active: true });
    if (!user || !(await user.comparePassword(password))) {
      logger.warn('Failed login attempt', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    logger.info('User logged in', { username: user.username, role: user.role });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// Optional: admin can create users (implemented in /api/users)
module.exports = router;