const net = require('net');

const PORT = Number(process.env.MARKTRACE_LISTEN_PORT || 4600);
const HOST = '127.0.0.1';

function runTest() {
  const socket = new net.Socket();

  socket.connect(PORT, HOST, () => {
    console.log(`Connected to server successfully (${HOST}:${PORT})`);
    const buf = Buffer.from('TEST_FRAME_123\r\n');
    socket.write(buf);
  });

  socket.on('data', (data) => {
    console.log('Received data from server:', data.toString('hex'), data.toString('ascii'));
  });

  socket.on('error', (err) => {
    if (err && err.code === 'ECONNREFUSED') {
      console.error(`Connection refused: server not listening on ${HOST}:${PORT}`);
    } else {
      console.error('Socket error:', err && err.message ? err.message : err);
    }
    process.exit(1);
  });

  // Close after 2 seconds and exit cleanly
  setTimeout(() => {
    try { socket.end(); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
    console.log('Test client closed connection and will exit');
    process.exit(0);
  }, 2000);
}

if (require.main === module) runTest();

module.exports = { runTest };
