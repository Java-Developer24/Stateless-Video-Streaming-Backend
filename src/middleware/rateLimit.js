// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 429,
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  }
});

/**
 * Chunk delivery rate limiter (higher limit)
 */
const chunkLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.chunkMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Chunk request limit exceeded',
      code: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  }
});

module.exports = {
  apiLimiter,
  chunkLimiter
};