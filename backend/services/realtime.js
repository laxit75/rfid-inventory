let io = null;

function setIo(ioInstance) {
  io = ioInstance;
}

function getIo() {
  return io;
}

function emit(event, payload) {
  // If change-stream mode is enabled, avoid emitting from application code
  // to prevent duplicate messages when the change stream is the authoritative source.
  if (process.env.USE_CHANGE_STREAMS === 'true') return false;
  if (!io) return false;
  try {
    io.emit(event, payload);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { setIo, getIo, emit };
