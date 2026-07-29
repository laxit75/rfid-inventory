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

// Password strength validation
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

/**
 * Validate that a password meets minimum strength requirements.
 * Returns an error message string or null if valid.
 */
function validatePasswordStrength(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

// Create user
router.post('/', validateBody(['username', 'password']), async (req, res, next) => {
  try {
    const { username, password, role, zones } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    // Validate password strength
    const pwError = validatePasswordStrength(password);
    if (pwError) return res.status(400).json({ error: pwError });

    // Validate username format
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(username)) {
      return res.status(400).json({ error: 'Username must start with a letter and contain only letters, numbers, underscores, and hyphens.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash: hash, role: role || 'USER', zones: zones || [] });
    res.status(201).json({ id: user._id, username: user.username, role: user.role, zones: user.zones });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.role) updates.role = req.body.role;
    if (req.body.hasOwnProperty('active')) updates.active = req.body.active;
    if (req.body.hasOwnProperty('zones')) updates.zones = req.body.zones;

    // If password is being set, validate and hash it
    if (req.body.password) {
      const pwError = validatePasswordStrength(req.body.password);
      if (pwError) return res.status(400).json({ error: pwError });
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-passwordHash').populate('zones');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;