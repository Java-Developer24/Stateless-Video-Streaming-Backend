// src/middleware/errorHandler.js
const logger = require('../utils/logger');
const ResponseHelper = require('../utils/responseHelper');

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  ResponseHelper.error(res, 'Resource not found', 404);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Handle specific error types
  if (err.status) {
    return ResponseHelper.error(res, err.message, err.status, err.details);
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return ResponseHelper.error(res, 'Validation failed', 400, err.details);
  }

  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return ResponseHelper.error(res, 'Invalid JSON', 400);
  }

  // Default server error
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  ResponseHelper.error(res, message, 500);
};

module.exports = {
  notFoundHandler,
  errorHandler
};