// src/config/index.js
require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // Storage configuration
  storage: {
    basePath: process.env.STORAGE_PATH || './storage/videos',
    chunkDuration: parseInt(process.env.CHUNK_DURATION, 10) || 5, // seconds
    supportedQualities: ['360p', '480p', '720p', '1080p'],
    defaultQuality: '720p'
  },

  // Caching configuration
  cache: {
    maxAge: parseInt(process.env.CACHE_MAX_AGE, 10) || 86400, // 24 hours
    sMaxAge: parseInt(process.env.CACHE_S_MAX_AGE, 10) || 604800, // 7 days
    staleWhileRevalidate: 86400
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY, 10) || 3600, // 1 hour
    enableAuth: process.env.ENABLE_AUTH === 'true'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    chunkMaxRequests: parseInt(process.env.CHUNK_RATE_LIMIT_MAX, 10) || 500
  },

  // CDN configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    baseUrl: process.env.CDN_BASE_URL || ''
  }
};