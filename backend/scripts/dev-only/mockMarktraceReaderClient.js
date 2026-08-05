const net = require('net');

const PORT = Number(process.env.MARKTRACE_LISTEN_PORT || 4600);
const HOST = process.env.MARKTRACE_HOST || '127.0.0.1';

/**
 * Mock Marktrace MR7901P Reader Client
 *
 * Simulates one or more RFID readers sending tag reads over TCP.
 * Useful for testing the TCP server pipeline without physical hardware.
 *
 * Usage:
 *   node scripts/dev-only/mockMarktraceReaderClient.js
 *   node scripts/dev-only/mockMarktraceReaderClient.js --continuous
 *   node scripts/dev-only/mockMarktraceReaderClient.js --reader Shutter-1 --tag TAG-001
 */

// Simulated readers with their antenna ports and zones
const READERS = {
  'Shutter-1':    { port: 1, zone: 'Zone A - Test Bay', direction: 'EXIT' },
  'Shutter-2':    { port: 3, zone: 'Zone B - Paint Shop', direction: 'EXIT' },
  'Shutter-3':    { port: 5, zone: 'Zone A - Test Bay', direction: 'EXIT' },
  'Reader-C1':    { port: 7, zone: 'Zone C - Assembly Line', direction: 'EXIT' },
  'Tool-Crib-Exit': { port: 9, zone: 'Zone D - Tool Crib', direction: 'EXIT' }
};

// Simulated tag EPCs (realistic RFID EPC format: hex 24 chars)
const TAGS = [
  { epc: 'E2003412B0A001B4', rssi: -62, label: 'Torque Wrench #1' },
  { epc: 'E2003412B0A001B5', rssi: -58, label: 'Torque Wrench #2' },
  { epc: 'E2003412B0A001B6', rssi: -71, label: 'Diagnostic Scanner' },
  { epc: 'E2003412B0A001B7', rssi: -65, label: 'Safety Vest #1' },
  { epc: 'E2003412B0A001B8', rssi: -60, label: 'Calibration Gauge' },
  { epc: 'E2003412B0A001B9', rssi: -73, label: 'Impact Driver' },
  { epc: 'E2003412B0A001C0', rssi: -55, label: 'Multimeter Pro' }
];

function buildFrame(readerId, tag) {
  const readerInfo = READERS[readerId] || READERS['Shutter-1'];
  // Simulate a Marktrace binary-like frame.
  // Real frames would be binary, but for testing we send a structured JSON line
  // that the TCP server can parse.
  const frame = JSON.stringify({
    readerId,
    antennaPort: readerInfo.port,
    epc: tag.epc,
    rssi: tag.rssi,
    timestamp: new Date().toISOString()
  }) + '\n';
  return Buffer.from(frame);
}

function sendRead(socket, readerId, tag) {
  const frame = buildFrame(readerId, tag);
  console.log(`[${readerId}] Sending ${tag.label} (${tag.epc}) on antenna port ${READERS[readerId].port}`);
  socket.write(frame);
}

function runSingleShot() {
  const socket = new net.Socket();
  const args = process.argv.slice(2);
  const readerArg = args.find(a => a.startsWith('--reader='));
  const tagArg = args.find(a => a.startsWith('--tag='));

  const readerId = readerArg ? readerArg.split('=')[1] : 'Shutter-1';
  const tagEpc = tagArg ? tagArg.split('=')[1] : null;

  const tag = tagEpc
    ? { epc: tagEpc, rssi: -60, label: 'Custom tag' }
    : TAGS[Math.floor(Math.random() * TAGS.length)];

  if (!READERS[readerId]) {
    console.error(`Unknown reader: ${readerId}. Available: ${Object.keys(READERS).join(', ')}`);
    process.exit(1);
  }

  socket.connect(PORT, HOST, () => {
    console.log(`Mock reader connected to ${HOST}:${PORT}`);
    console.log(`Simulating: ${readerId} → ${tag.label}`);
    sendRead(socket, readerId, tag);
  });

  socket.on('data', (data) => {
    console.log('Server response:', data.toString('hex'), data.toString('ascii'));
  });

  socket.on('error', (err) => {
    console.error('Mock reader error:', err.message || err);
    process.exit(1);
  });

  setTimeout(() => {
    try { socket.end(); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
    console.log('Mock reader disconnected');
    process.exit(0);
  }, 2000);
}

function runContinuous() {
  console.log(`Starting continuous mock reader. Connecting to ${HOST}:${PORT}`);
  console.log(`Readers: ${Object.keys(READERS).join(', ')}`);
  console.log('Sending one random tag read every 3 seconds. Press Ctrl+C to stop.\n');

  const socket = new net.Socket();

  socket.connect(PORT, HOST, () => {
    console.log('Connected! Starting tag stream...');
    tick(socket);
  });

  let interval;

  function tick(sock) {
    const readerIds = Object.keys(READERS);
    const readerId = readerIds[Math.floor(Math.random() * readerIds.length)];
    const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
    sendRead(sock, readerId, tag);
    interval = setTimeout(() => tick(sock), 3000);
  }

  socket.on('error', (err) => {
    console.error('Connection error:', err.message);
    clearTimeout(interval);
    console.log('Reconnecting in 5 seconds...');
    setTimeout(() => {
      socket.connect(PORT, HOST);
    }, 5000);
  });

  socket.on('close', () => {
    clearTimeout(interval);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping mock reader...');
    clearTimeout(interval);
    try { socket.end(); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
    process.exit(0);
  });
}

function runAllReaders() {
  // Open one connection per reader and send one batch of reads
  console.log('Simulating all readers with a tag burst...');
  const readerIds = Object.keys(READERS);
  let remaining = readerIds.length;

  for (const readerId of readerIds) {
    const socket = new net.Socket();
    socket.connect(PORT, HOST, () => {
      const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
      sendRead(socket, readerId, tag);
    });
    socket.on('data', (data) => {
      console.log(`  Response from ${readerId}:`, data.toString('ascii').trim());
    });
    socket.on('error', (err) => {
      console.error(`Error on ${readerId}:`, err.message);
    });
    socket.on('close', () => {
      remaining--;
      if (remaining === 0) {
        console.log('All readers done. Exiting.');
        process.exit(0);
      }
    });
    setTimeout(() => {
      try { socket.end(); } catch (e) {}
    }, 1500);
  }
}

// Parse command line
const args = process.argv.slice(2);
if (args.includes('--continuous') || args.includes('-c')) {
  runContinuous();
} else if (args.includes('--all') || args.includes('-a')) {
  runAllReaders();
} else {
  runSingleShot();
}

module.exports = { runMockClient: runSingleShot, runContinuous, runAllReaders, READERS, TAGS };
