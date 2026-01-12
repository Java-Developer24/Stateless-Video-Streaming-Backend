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
    tempPath: process.env.TEMP_PATH || './temp',
    chunkDuration: parseInt(process.env.CHUNK_DURATION, 10) || 5,
    supportedQualities: ['360p', '480p', '720p', '1080p'],
    defaultQuality: '720p'
  },

  // Caching configuration
  cache: {
    maxAge: parseInt(process.env.CACHE_MAX_AGE, 10) || 86400,
    sMaxAge: parseInt(process.env.CACHE_S_MAX_AGE, 10) || 604800,
    staleWhileRevalidate: 86400
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY, 10) || 3600,
    enableAuth: process.env.ENABLE_AUTH === 'true'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    chunkMaxRequests: parseInt(process.env.CHUNK_RATE_LIMIT_MAX, 10) || 500
  },

  // CDN configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    baseUrl: process.env.CDN_BASE_URL || ''
  },

  // Upload configuration (NEW)
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 1073741824, // 1GB
    allowedTypes: (process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/quicktime').split(','),
    tempDir: process.env.TEMP_PATH || './temp'
  },

  // FFmpeg configuration (NEW)
  ffmpeg: {
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobePath: process.env.FFPROBE_PATH || 'ffprobe'
  }
};