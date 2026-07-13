const logger = require('../utils/logger');

/**
 * authorize(requiredRoles, options)
 * requiredRoles: string or array of strings
 * options: { zoneParam: 'zoneId'|'body.zone'|'params.zone', allowZoneScope: boolean }
 */
module.exports = function authorize(requiredRoles, options = {}) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      // Admin bypass
      if (req.user.role === 'ADMIN') return next();

      // Direct role match
      if (roles.includes(req.user.role)) return next();

      // Zone-scoped manager support: if role required includes ZONE_MANAGER and user is ZONE_MANAGER
      if (options.allowZoneScope && req.user.role === 'ZONE_MANAGER') {
        const zoneId = (req.params && req.params[options.zoneParam]) || (req.body && req.body[options.zoneParam]) || req.query[options.zoneParam];
        if (!zoneId) return res.status(403).json({ error: 'Zone-scoped permission requires zone identifier' });
        const owns = (req.user.zones || []).map(String).includes(String(zoneId));
        if (owns) return next();
      }

      logger.warn('Unauthorized access attempt', { userId: req.user._id, requiredRoles: roles });
      return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      next(err);
    }
  };
};
