const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Missing token');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verr) {
      logger.warn('JWT verification failed', { error: verr.message });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.active) throw new Error('Inactive user');
    req.user = user;
    next();
  } catch (err) {
    logger.warn('Authentication failed', { error: err.message });
    res.status(401).json({ error: 'Authentication required' });
  }
};