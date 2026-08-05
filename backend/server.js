require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { startScheduler, stopScheduler } = require('./services/scheduler');
const { startAlarmScheduler, stopAlarmScheduler } = require('./services/alarmScheduler');
const { runHourlyDigest } = require('./jobs/hourlyAlertDigest');
const { runDailyDigest } = require('./jobs/dailyAlertDigest');
const { startEmailWorker, stopEmailWorker } = require('./workers/emailWorker');
const { startSpeakerWorker, stopSpeakerWorker } = require('./workers/speakerWorker');
const { startChangeStream, stopChangeStream } = require('./services/changeStream');
const { startServer: startMarktraceServer, stopServer: stopMarktraceServer } = require('./services/marktraceTcpServer');
const Zone = require('./models/Zone');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const morgan = require('morgan');

const defaultZones = [
  { name: 'Zone A - Test Bay', description: 'Primary test bay' },
  { name: 'Zone B - Paint Shop', description: 'Paint and finishing zone' }
];

async function ensureDefaultZones() {
  const existing = await Zone.find({ name: { $in: defaultZones.map(z => z.name) } });
  const existingNames = existing.map(zone => zone.name);
  const missing = defaultZones.filter(zone => !existingNames.includes(zone.name));
  if (missing.length > 0) {
    await Zone.insertMany(missing);
    logger.info('Created default zones', { zones: missing.map(z => z.name) });
  }
}

const app = express();
const http = require('http');
const { setIo } = require('./services/realtime');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean);

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = buffer.toString('utf8'); } }));

// HTTP request logging with morgan (pattern from sw attendance project)
const morganLogFormat = process.env.NODE_ENV === 'production'
  ? ':method :url :status :res[content-length] - :response-time ms'
  : 'dev';
app.use('/api', morgan(morganLogFormat, {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

const loginRateLimitWindowMs = process.env.LOGIN_LIMIT_WINDOW_MS ? Number(process.env.LOGIN_LIMIT_WINDOW_MS) : 15 * 60 * 1000;
const loginRateLimitMax = process.env.LOGIN_LIMIT_MAX ? Number(process.env.LOGIN_LIMIT_MAX) : 10;

const loginLimiter = rateLimit({
  windowMs: loginRateLimitWindowMs,
  max: loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

// General API rate limiter (100 requests per minute per IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api', apiLimiter);

// Stricter rate limit for admin operations
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please slow down.' }
});

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api', require('./routes/movement'));
app.use('/api/rfid', require('./routes/rfidIngest'));
app.use('/api/settings', adminLimiter, require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/recipients', adminLimiter, require('./routes/recipients'));
app.use('/api/users', adminLimiter, require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/readers', require('./routes/readers'));
app.use('/api/devices', adminLimiter, require('./routes/devices'));
app.use('/api/device-groups', adminLimiter, require('./routes/deviceGroups'));
app.use('/api/alert-target-groups', adminLimiter, require('./routes/alertTargetGroups'));
app.use('/api/alert-flows', adminLimiter, require('./routes/alertFlows'));
app.use('/api/tag-assignments', adminLimiter, require('./routes/tagAssignments'));
app.use('/api/tag-alert-states', require('./routes/tagAlertStates'));
app.use(errorHandler);

let server;

function connectWithRetry() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000
  })
    .then(async () => {
        logger.info('Connected to MongoDB');
        await ensureDefaultZones();
        // start leader election to control scheduler and change-stream
        const leader = require('./services/leader');
        leader.start({
          onAcquire: async () => {
            try { await startChangeStream(); } catch (e) {}
            try { startScheduler(); } catch (e) {}
            try { startAlarmScheduler(); } catch (e) { logger.warn('Alarm scheduler unavailable', { error: e.message }); }
            try { await startEmailWorker(); } catch (e) {}
            try { await startSpeakerWorker(); } catch (e) {}
            try { startMarktraceServer(); } catch (e) { logger.warn('Marktrace TCP server unavailable', { error: e.message }); }
            // Schedule hourly digest — fires at the start of each hour
            _digestTimers = _digestTimers || [];
            try {
              const now = new Date();
              const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
              const hourlyTimeout = setTimeout(() => {
                runHourlyDigest().catch((err) => logger.error('Hourly digest failed', { error: err.message }));
                const hourlyInterval = setInterval(() => {
                  runHourlyDigest().catch((err) => logger.error('Hourly digest failed', { error: err.message }));
                }, 60 * 60 * 1000);
                _digestTimers.push(hourlyInterval);
              }, msUntilNextHour);
              _digestTimers.push(hourlyTimeout);
              logger.info('Hourly digest scheduled', { firstRunInMs: msUntilNextHour });
            } catch (e) {
              logger.warn('Failed to schedule hourly digest', { error: e.message });
            }
            // Schedule daily digest — fires at 8 PM every day
            try {
              const now = new Date();
              const targetHour = 20; // 8 PM
              const msUntilNextDaily = (
                ((targetHour - now.getHours() + 24) % 24) * 60 * 60 * 1000
                - now.getMinutes() * 60 * 1000
                - now.getSeconds() * 1000
                - now.getMilliseconds()
              );
              const dailyTimeout = setTimeout(() => {
                runDailyDigest().catch((err) => logger.error('Daily digest failed', { error: err.message }));
                const dailyInterval = setInterval(() => {
                  runDailyDigest().catch((err) => logger.error('Daily digest failed', { error: err.message }));
                }, 24 * 60 * 60 * 1000);
                _digestTimers.push(dailyInterval);
              }, msUntilNextDaily);
              _digestTimers.push(dailyTimeout);
              logger.info('Daily digest scheduled', { firstRunInMs: msUntilNextDaily });
            } catch (e) {
              logger.warn('Failed to schedule daily digest', { error: e.message });
            }
          },
          onRelease: async () => {
            try { stopChangeStream(); } catch (e) {}
            try { stopScheduler(); } catch (e) {}
            try { stopAlarmScheduler(); } catch (e) {}
            try { await stopEmailWorker(); } catch (e) {}
            try { await stopSpeakerWorker(); } catch (e) {}
            try { stopMarktraceServer(); } catch (e) {}
            // Clear digest timers
            _digestTimers = _digestTimers || [];
            for (const t of _digestTimers) {
              try { clearTimeout(t); } catch (e) {}
              try { clearInterval(t); } catch (e) {}
            }
            _digestTimers = [];
          }
        });
      const PORT = process.env.PORT || 5000;
      server = app.listen(PORT, () => logger.info('Backend running', { port: PORT }));
      // attach socket.io for realtime updates
      try {
        const { Server } = require('socket.io');
        const io = new Server(server, {
          cors: {
            origin: allowedOrigins,
            credentials: true
          }
        });
        setIo(io);
        io.on('connection', (socket) => {
          logger.info('Client connected to realtime', { id: socket.id });
          socket.on('disconnect', () => logger.info('Client disconnected', { id: socket.id }));
        });
      } catch (err) {
        logger.warn('Socket.io not available', { error: err.message });
      }
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error('Port already in use', { port: PORT });
          process.exit(1);
        }
        logger.error('Server error', { error: err.message });
        process.exit(1);
      });
    })
    .catch((err) => {
      logger.error('MongoDB connection error', { error: err.message });
      setTimeout(connectWithRetry, 5000);
    });
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected; attempting reconnect');
  setTimeout(connectWithRetry, 5000);
});

connectWithRetry();

async function shutdown(signal) {
  logger.info('Shutting down gracefully', { signal });

  // Force shutdown after 15 seconds
  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
  forceExit.unref();

  try {
    const leader = require('./services/leader');
    await leader.stop();
  } catch (e) {}

  if (server) {
    server.close(() => {
      clearTimeout(forceExit);
      logger.info('HTTP server closed');
      mongoose.connection.close(false).then(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
  } else {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

// Handle SIGUSR2 for nodemon compatibility
process.once('SIGUSR2', () => {
  shutdown('SIGUSR2').then(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

let _digestTimers = [];

require('./models/Equipment');
require('./models/Tag');
require('./models/MovementEvent');
require('./models/AlertLog');
require('./models/User');
require('./models/Recipient');
require('./models/Settings');
require('./models/Zone');
require('./models/Device');
require('./models/DeviceGroup');
require('./models/AlertTargetGroup');
require('./models/AlertFlow');
require('./models/TagAssignment');
