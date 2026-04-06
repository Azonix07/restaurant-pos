const logger = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
  // Log with structured data
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id,
  });

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Validation Error', errors: messages });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ message: `Duplicate value for ${field}` });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired, please login again' });
  }

  // Don't leak stack traces in production
  const response = {
    message: err.message || 'Internal Server Error',
  };
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(err.statusCode || 500).json(response);
};

module.exports = errorHandler;
