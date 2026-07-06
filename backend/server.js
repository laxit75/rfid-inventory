require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { startScheduler, stopScheduler } = require('./services/scheduler');
const Zone = require('./models/Zone');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

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
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api', require('./routes/movement'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/recipients', require('./routes/recipients'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/zones', require('./routes/zones'));
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
      startScheduler();
      const PORT = process.env.PORT || 5000;
      server = app.listen(PORT, () => logger.info('Backend running', { port: PORT }));
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

function shutdown(signal) {
  logger.info('Shutting down gracefully', { signal });
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  if (typeof stopScheduler === 'function') {
    stopScheduler();
  }
}

process.once('SIGUSR2', () => {
  shutdown('SIGUSR2');
  process.kill(process.pid, 'SIGUSR2');
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

require('./models/Equipment');
require('./models/Tag');
require('./models/MovementEvent');
require('./models/AlertLog');
require('./models/User');
require('./models/Recipient');
require('./models/Settings');
require('./models/Zone');