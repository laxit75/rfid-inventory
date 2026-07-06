module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed';
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled error:', err);
  }
  res.status(statusCode).json({ error: message });
};
