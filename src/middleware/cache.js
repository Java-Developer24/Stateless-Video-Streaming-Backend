// src/middleware/cache.js
const config = require('../config');

/**
 * Set caching headers for CDN and browser caching
 */
const setCacheHeaders = (options = {}) => {
  return (req, res, next) => {
    const {
      maxAge = config.cache.maxAge,
      sMaxAge = config.cache.sMaxAge,
      staleWhileRevalidate = config.cache.staleWhileRevalidate,
      isPrivate = false,
      isImmutable = false
    } = options;

    let cacheControl = [];

    if (isPrivate) {
      cacheControl.push('private');
    } else {
      cacheControl.push('public');
    }

    cacheControl.push(`max-age=${maxAge}`);
    
    if (!isPrivate && sMaxAge) {
      cacheControl.push(`s-maxage=${sMaxAge}`);
    }

    if (staleWhileRevalidate) {
      cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    if (isImmutable) {
      cacheControl.push('immutable');
    }

    res.setHeader('Cache-Control', cacheControl.join(', '));
    
    // Add Vary header for proper caching
    res.setHeader('Vary', 'Accept-Encoding');
    
    next();
  };
};

/**
 * No-cache headers for dynamic content
 */
const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

/**
 * Chunk-specific cache headers (long-lived, immutable)
 */
const chunkCache = setCacheHeaders({
  maxAge: 31536000, // 1 year
  sMaxAge: 31536000,
  isImmutable: true
});

/**
 * Metadata cache headers (shorter lived)
 */
const metadataCache = setCacheHeaders({
  maxAge: 300, // 5 minutes
  sMaxAge: 3600, // 1 hour
  staleWhileRevalidate: 86400
});

module.exports = {
  setCacheHeaders,
  noCache,
  chunkCache,
  metadataCache
};