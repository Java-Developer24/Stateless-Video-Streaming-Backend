// src/middleware/auth.js
const tokenService = require('../services/tokenService');
const ResponseHelper = require('../utils/responseHelper');
const config = require('../config');

/**
 * JWT authentication middleware
 */
const authenticateToken = (req, res, next) => {
  if (!config.security.enableAuth) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return ResponseHelper.error(res, 'Access token required', 401);
  }

  const payload = tokenService.verifyAccessToken(token);
  if (!payload) {
    return ResponseHelper.error(res, 'Invalid or expired token', 403);
  }

  req.user = payload;
  next();
};

/**
 * Signed URL verification middleware
 */
const verifySignedUrl = (req, res, next) => {
  if (!config.security.enableAuth) {
    return next();
  }

  const { videoId, quality, chunkIndex } = req.params;
  const { expires, signature } = req.query;

  if (!expires || !signature) {
    return ResponseHelper.error(res, 'Signed URL parameters required', 401);
  }

  const result = tokenService.verifySignedUrl(
    videoId,
    quality,
    parseInt(chunkIndex, 10),
    parseInt(expires, 10),
    signature
  );

  if (!result.valid) {
    return ResponseHelper.error(res, result.reason, 403);
  }

  next();
};

/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = tokenService.verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
};

module.exports = {
  authenticateToken,
  verifySignedUrl,
  optionalAuth
};