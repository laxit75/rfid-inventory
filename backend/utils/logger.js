const isProduction = process.env.NODE_ENV === 'production';

function formatEntry(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };

  if (Object.keys(meta).length > 0) {
    entry.meta = meta;
  }

  return isProduction ? JSON.stringify(entry) : JSON.stringify(entry, null, 2);
}

function write(level, message, meta = {}) {
  const output = formatEntry(level, message, meta);
  if (level === 'error') {
    console.error(output);
    return;
  }
  if (level === 'warn') {
    console.warn(output);
    return;
  }
  console.log(output);
}

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta)
};

module.exports = logger;
