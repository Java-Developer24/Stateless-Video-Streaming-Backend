// src/routes/chunkRoutes.js
const express = require('express');
const router = express.Router();
const chunkController = require('../controllers/chunkController');
const { verifySignedUrl } = require('../middleware/auth');
const { chunkCache } = require('../middleware/cache');
const { chunkLimiter } = require('../middleware/rateLimit');

// Chunk delivery routes
router.get(
  '/:videoId/:quality/:chunkIndex',
  chunkLimiter,
  verifySignedUrl,
  chunkCache,
  chunkController.getChunk.bind(chunkController)
);

router.head(
  '/:videoId/:quality/:chunkIndex',
  chunkLimiter,
  verifySignedUrl,
  chunkController.headChunk.bind(chunkController)
);

// Chunk by timestamp
router.get(
  '/:videoId/:quality/by-time/:timestamp',
  chunkLimiter,
  verifySignedUrl,
  chunkController.getChunkByTime.bind(chunkController)
);

// Chunk range info (for prefetching)
router.get(
  '/:videoId/:quality/range',
  chunkLimiter,
  chunkController.getChunkRange.bind(chunkController)
);

module.exports = router;