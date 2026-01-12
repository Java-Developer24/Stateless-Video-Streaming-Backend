// src/routes/videoRoutes.js

const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const videoController = require('../controllers/videoController');
const uploadController = require('../controllers/uploadController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { metadataCache, noCache } = require('../middleware/cache');
const { apiLimiter } = require('../middleware/rateLimit');

// ============================================
// Public routes
// ============================================
router.get('/health', videoController.healthCheck);
router.get('/config', videoController.getConfig);

// Auth route
router.post('/auth/token', apiLimiter, videoController.generateToken);

// ============================================
// Video listing and metadata
// ============================================
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

// ============================================
// NEW: Video Upload & URL Processing
// ============================================

// Process video from URL (async - returns job ID)
router.post(
  '/videos/from-url',
  apiLimiter,
  optionalAuth,
  uploadController.processFromUrl.bind(uploadController)
);

// Process video from URL (sync - waits for completion)
router.post(
  '/videos/from-url/sync',
  apiLimiter,
  optionalAuth,
  uploadController.processFromUrlSync.bind(uploadController)
);

// Upload video file directly
router.post(
  '/videos/upload',
  apiLimiter,
  optionalAuth,
  uploadController.getUploadMiddleware(),
  uploadController.uploadVideo.bind(uploadController)
);

// ============================================
// NEW: Job Management
// ============================================

// Get all processing jobs
router.get(
  '/videos/jobs',
  apiLimiter,
  optionalAuth,
  noCache,
  uploadController.listJobs.bind(uploadController)
);

// Get specific job status
router.get(
  '/videos/jobs/:jobId',
  apiLimiter,
  noCache,
  uploadController.getJobStatus.bind(uploadController)
);

// Delete/cancel job
router.delete(
  '/videos/jobs/:jobId',
  apiLimiter,
  optionalAuth,
  uploadController.deleteJob.bind(uploadController)
);

module.exports = router;