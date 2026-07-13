const express = require('express');
const Tag = require('../models/Tag');
const AlertLog = require('../models/AlertLog');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const toDateOnly = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// GET /api/reports/summary
// returns totals by tag status, violations today/week, and avg time-to-resolution (ms)
router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = toDateOnly(now);
    const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalsAgg = await Tag.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const totals = { ACTIVE: 0, TEMP_DISABLED: 0, PERMANENT_DISABLED: 0 };
    for (const t of totalsAgg) totals[t._id] = t.count;

    const alertAgg = await Tag.aggregate([
      { $group: { _id: '$alertStatus', count: { $sum: 1 } } }
    ]);
    const alertCounts = { NONE: 0, ALARMING: 0, OVERDUE: 0 };
    for (const a of alertAgg) alertCounts[a._id] = a.count;

    const outsideCount = await Tag.countDocuments({ currentZone: null });
    const violationsToday = await AlertLog.countDocuments({ type: 'ALARM_BEEP', timestamp: { $gte: startOfToday } });
    const violationsWeek = await AlertLog.countDocuments({ type: 'ALARM_BEEP', timestamp: { $gte: weekAgo } });

    const resolved = await AlertLog.find({ type: 'ALARM_RESOLVED' }).sort({ timestamp: -1 }).limit(500).lean();
    const beeps = await AlertLog.find({ type: 'ALARM_BEEP' }).sort({ timestamp: -1 }).limit(2000).lean();
    const beepMap = {};
    for (const b of beeps) {
      const key = String(b.tagId || b.tag);
      if (!beepMap[key]) beepMap[key] = [];
      beepMap[key].push(new Date(b.timestamp));
    }

    let totalMs = 0;
    let pairs = 0;
    for (const r of resolved) {
      const key = String(r.tagId || r.tag);
      const rts = new Date(r.timestamp);
      const list = beepMap[key];
      if (!list || list.length === 0) continue;
      const prior = list.find(d => d <= rts);
      if (!prior) continue;
      totalMs += (rts - prior);
      pairs += 1;
    }

    res.json({ totals, alertCounts, outsideCount, violationsToday, violationsWeek, avgResolutionMs: pairs > 0 ? Math.round(totalMs / pairs) : null });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/trends?days=30
// returns daily violation counts for the last N days
router.get('/trends', async (req, res, next) => {
  try {
    // Support either ?days=N OR ?start=YYYY-MM-DD&end=YYYY-MM-DD
    if (req.query.start || req.query.end) {
      const start = req.query.start ? new Date(req.query.start) : new Date(0);
      const end = req.query.end ? new Date(req.query.end) : new Date();
      // normalize to date-only bounds
      const startDate = toDateOnly(start);
      const endDate = toDateOnly(end);
      // build pipeline for given range
      const pipeline = [
        { $match: { type: 'ALARM_BEEP', timestamp: { $gte: startDate, $lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) } } },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ];
      const agg = await AlertLog.aggregate(pipeline);

      const counts = {};
      agg.forEach(item => {
        const { year, month, day } = item._id;
        const dateKey = new Date(year, month - 1, day).toISOString().slice(0, 10);
        counts[dateKey] = item.count;
      });

      const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
      const trend = [];
      for (let i = 0; i < days; i += 1) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().slice(0, 10);
        trend.push({ date: key, total: counts[key] || 0 });
      }

      res.json({ trend, days, start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) });
      return;
    }

    // fallback: days-based query (existing behavior)
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const today = toDateOnly(new Date());
    const startDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { type: 'ALARM_BEEP', timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ];
    const agg = await AlertLog.aggregate(pipeline);

    const counts = {};
    agg.forEach(item => {
      const { year, month, day } = item._id;
      const dateKey = new Date(year, month - 1, day).toISOString().slice(0, 10);
      counts[dateKey] = item.count;
    });

    const trend = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      trend.push({ date: key, total: counts[key] || 0 });
    }

    res.json({ trend, days });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/audit.csv?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/audit.csv', async (req, res, next) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : new Date(0);
    const end = req.query.end ? new Date(req.query.end) : new Date();
    end.setHours(23, 59, 59, 999);

    const logs = await AlertLog.find({ timestamp: { $gte: start, $lte: end } }).sort({ timestamp: 1 }).lean();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rfid-audit-${req.query.start || 'all'}-${req.query.end || 'latest'}.csv"`);

    const headers = ['timestamp', 'type', 'tagId', 'details'];
    res.write(headers.join(',') + '\n');
    for (const log of logs) {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.type,
        log.tagId,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ];
      res.write(row.join(',') + '\n');
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
