const net = require('net');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const DEBUG_RAW = process.env.DEBUG_RAW_FRAMES === 'true';

const DEFAULT_LISTEN_HOST = process.env.MARKTRACE_LISTEN_HOST || '0.0.0.0';
const DEFAULT_LISTEN_PORT = Number(process.env.MARKTRACE_LISTEN_PORT || 4600);

// File logging setup (only used when DEBUG_RAW is true). Writes JSONL
// entries to logs/marktrace-raw-frames.log. NOTE: This is intended for
// development/protocol reverse-engineering and should be disabled or
// rotated in production to avoid unbounded disk growth.
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'marktrace-raw-frames.log');
if (DEBUG_RAW) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    logger.warn('Failed to create logs directory', { error: err && err.message });
  }
}

// EventEmitter: emits 'tag' with parsed payloads when parseTagFrame returns a value
const emitter = new EventEmitter();

// Track active sockets so we can clean up if needed
const activeSockets = new Set();

// Helper: pretty-print buffer as spaced hex bytes
function hexDump(buf) {
  return Buffer.from(buf).toString('hex').match(/.{1,2}/g).join(' ');
}

// Helper: printable ASCII fallback (non-printable -> '.')
function asciiDump(buf) {
  return Buffer.from(buf).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
}


function parseTagFrame(buffer) {
  // Currently a stub — returns null until parsing logic is implemented
  // Example expected return shape once implemented:
  // return { tagId: 'E200001...', rssi: -65, antenna: 2, rawBuffer: buffer };
  return null;
}

// Handle incoming raw data: log raw bytes (hex + ascii) when debugging,
// and attempt to parse with parseTagFrame. When parseTagFrame returns a
// value, emit a 'tag' event with the parsed payload for consumers.
function handleData(socket, data) {
  try {
    if (DEBUG_RAW) {
      logger.info('Marktrace raw data (hex): ' + hexDump(data));
      logger.info('Marktrace raw data (ascii): ' + asciiDump(data));
      // Append raw frame to JSONL log for offline analysis
      try {
        const entry = {
          ts: new Date().toISOString(),
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort,
          hex: hexDump(data),
          ascii: asciiDump(data)
        };
        // Use async append to avoid blocking the TCP handler; log errors via logger
        fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
          if (err) logger.warn('Failed to append marktrace raw frame to log', { error: err && err.message });
        });
      } catch (err) {
        logger.warn('Error while writing raw-frame log', { error: err && err.message });
      }
    }

    const parsed = parseTagFrame(data);
    if (parsed) {
      // Attach metadata about the source connection
      parsed._source = { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort };
      emitter.emit('tag', parsed);
    }
  } catch (err) {
    logger.error('Error handling marktrace data', { error: err && err.message });
  }
}

// Create a server that accepts incoming connections from the reader (reader dials out)
const server = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
  logger.info(`Client connected from ${clientAddr}`);

  logger.info('Marktrace reader connected', { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort });
  activeSockets.add(socket);

  socket.on('data', (data) => handleData(socket, data));

  socket.on('close', (hadError) => {
    logger.info('Marktrace reader connection closed', { remoteAddress: socket.remoteAddress, hadError });
    activeSockets.delete(socket);
  });

  socket.on('error', (err) => {
    logger.warn('Marktrace reader connection error', { remoteAddress: socket.remoteAddress, error: err && err.message });
    activeSockets.delete(socket);
    try { socket.destroy(); } catch (e) {}
  });
});

// Keep the server listening; reader will reconnect as a client when it can.
function startServer(port = DEFAULT_LISTEN_PORT, host = DEFAULT_LISTEN_HOST) {
  const listenPort = Number(port);
  const listenHost = host || DEFAULT_LISTEN_HOST;

  server.listen(listenPort, listenHost, () => {
    const address = `${listenHost}:${listenPort}`;
    logger.info('Marktrace TCP server listening', { listenAddress: address });
    logger.info('Reader must dial this public address over cellular; ensure cloud host/public IP and security group port are configured');
  });

  server.on('error', (err) => {
    logger.error('Marktrace TCP server error', { error: err && err.message });
  });

  return server;
}

let stopping = false;

// Stop server and destroy active sockets
async function stopServer() {
  if (stopping) return;
  stopping = true;

  for (const s of activeSockets) {
    try { s.destroy(); } catch (e) {}
  }
  activeSockets.clear();

  return new Promise((resolve) => {
    server.close(() => {
      logger.info('Marktrace TCP server stopped');
      resolve();
    });
  });
}

// NOTE: Shutdown signal handling is managed by server.js.
// Do NOT register duplicate process.on('SIGINT'/'SIGTERM') handlers here.
// This module exports the raw server so server.js can manage its lifecycle.

// Exported API: startServer, stopServer, parseTagFrame placeholder, and an EventEmitter
module.exports = {
  startServer,
  stopServer,
  parseTagFrame,
  emitter
};
