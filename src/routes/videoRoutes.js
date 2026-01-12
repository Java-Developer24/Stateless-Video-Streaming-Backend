// src/routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const videoController = require('../controllers/videoController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { metadataCache, noCache } = require('../middleware/cache');
const { apiLimiter } = require('../middleware/rateLimit');

// Public routes
router.get('/health', videoController.healthCheck);
router.get('/config', videoController.getConfig);

// Auth route
router.post('/auth/token', apiLimiter, videoController.generateToken);

// Video listing and metadata
router.get(
  '/videos',
  apiLimiter,
  optionalAuth,
  metadataCache,
  metadataController.listVideos.bind(metadataController)
);

router.get(
  '/videos/:videoId',
  apiLimiter,
  optionalAuth,
  metadataCache,
  metadataController.getVideoMetadata.bind(metadataController)
);

router.get(
  '/videos/:videoId/manifest',
  apiLimiter,
  optionalAuth,
  metadataCache,
  metadataController.getManifest.bind(metadataController)
);

// Signed URLs (requires auth when enabled)
router.get(
  '/videos/:videoId/signed-urls',
  apiLimiter,
  authenticateToken,
  noCache,
  metadataController.getSignedUrls.bind(metadataController)
);

module.exports = router;