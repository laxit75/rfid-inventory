const net = require('net');

const PORT = Number(process.env.MARKTRACE_LISTEN_PORT || 4600);
const HOST = '127.0.0.1';

function runMockClient() {
  const socket = new net.Socket();

  socket.connect(PORT, HOST, () => {
    console.log(`Mock reader connected to server at ${HOST}:${PORT}`);
    const frame = Buffer.from('MOCK_FRAME_0001\r\n');
    socket.write(frame);
  });

  socket.on('data', (data) => {
    console.log('Server response:', data.toString('hex'), data.toString('ascii'));
  });

  socket.on('error', (err) => {
    console.error('Mock reader client error:', err.message || err);
    process.exit(1);
  });

  setTimeout(() => {
    try { socket.end(); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
    console.log('Mock reader client disconnected after 2 seconds');
    process.exit(0);
  }, 2000);
}

if (require.main === module) runMockClient();

module.exports = { runMockClient };
