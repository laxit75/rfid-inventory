const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const router = express.Router();

router.post('/login', validateBody(['username', 'password']), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, active: true });
    if (!user || !(await user.comparePassword(password))) {
      logger.warn('Failed login attempt', { username, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Track last login activity
    user.lastLoginAt = new Date();
    user.lastIpAddress = req.ip || req.connection?.remoteAddress || '';
    await user.save().catch(e => logger.warn('Could not update lastLogin', { error: e.message }));

    logger.info('User logged in', { username: user.username, role: user.role, ip: req.ip });
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// Resolves the current user from both legacy tokens and tokens issued with role claims.
router.get('/me', auth, (req, res) => {
  res.json({ id: req.user._id, username: req.user.username, role: req.user.role });
});

// Issue a fresh access token. Accepts the current token in the body and
// returns a new 8-hour token. We allow verifying expired access tokens
// here so clients can refresh after expiry (uses ignoreExpiration).
router.post('/refresh', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    // Verify token but allow expired tokens for the purpose of refresh
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

    const user = await User.findById(decoded.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User no longer active' });
    }

    const newToken = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token: newToken });
  } catch (err) {
    logger.warn('Refresh failed (invalid token)', { error: err.message });
    return res.status(401).json({ error: 'Refresh failed' });
  }
});

// Optional: admin can create users (implemented in /api/users)
module.exports = router;
