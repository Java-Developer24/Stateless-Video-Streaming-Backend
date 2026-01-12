// src/controllers/chunkController.js
const chunkService = require('../services/chunkService');
const ResponseHelper = require('../utils/responseHelper');
const TimeUtils = require('../utils/timeUtils');
const logger = require('../utils/logger');

class ChunkController {
  /**
   * GET /api/chunks/:videoId/:quality/:chunkIndex
   * Get video chunk by index
   */
  async getChunk(req, res, next) {
    try {
      const { videoId, quality, chunkIndex } = req.params;
      const index = parseInt(chunkIndex, 10);

      if (isNaN(index) || index < 0) {
        return ResponseHelper.error(res, 'Invalid chunk index', 400);
      }

      const chunk = await chunkService.getChunkByIndex(videoId, quality, index);
      
      // Parse range header for partial content
      const range = chunkService.parseRange(req.headers.range, chunk.size);

      // Set common headers
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('X-Chunk-Index', index);
      res.setHeader('X-Video-Id', videoId);
      res.setHeader('X-Quality', chunk.quality);

      if (range) {
        // Partial content response
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${chunk.size}`);
        res.setHeader('Content-Length', range.length);
        
        const stream = chunk.getStream(range);
        stream.on('error', (err) => {
          logger.error('Stream error', { error: err.message, videoId, chunkIndex: index });
          if (!res.headersSent) {
            ResponseHelper.error(res, 'Stream error', 500);
          }
        });
        stream.pipe(res);
      } else {
        // Full content response
        res.status(200);
        res.setHeader('Content-Length', chunk.size);
        
        const stream = chunk.getStream();
        stream.on('error', (err) => {
          logger.error('Stream error', { error: err.message, videoId, chunkIndex: index });
          if (!res.headersSent) {
            ResponseHelper.error(res, 'Stream error', 500);
          }
        });
        stream.pipe(res);
      }
    } catch (error) {
      if (error.status) {
        return ResponseHelper.error(res, error.message, error.status, error.details);
      }
      next(error);
    }
  }

  /**
   * GET /api/chunks/:videoId/:quality/by-time/:timestamp
   * Get video chunk by timestamp
   */
  async getChunkByTime(req, res, next) {
    try {
      const { videoId, quality, timestamp } = req.params;
      
      let seconds;
      if (timestamp.includes(':')) {
        seconds = TimeUtils.parseTimeString(timestamp);
      } else {
        seconds = parseFloat(timestamp);
      }

      if (isNaN(seconds) || seconds < 0) {
        return ResponseHelper.error(res, 'Invalid timestamp', 400);
      }

      const chunk = await chunkService.getChunkByTimestamp(videoId, quality, seconds);
      
      // Redirect to chunk by index endpoint
      const redirectUrl = `/api/chunks/${videoId}/${chunk.quality}/${chunk.chunkIndex}`;
      
      // Include original range header if present
      if (req.headers.range) {
        res.setHeader('X-Original-Range', req.headers.range);
      }
      
      res.redirect(307, redirectUrl);
    } catch (error) {
      if (error.status) {
        return ResponseHelper.error(res, error.message, error.status, error.details);
      }
      next(error);
    }
  }

  /**
   * GET /api/chunks/:videoId/:quality/range
   * Get information about multiple chunks (for prefetching)
   */
  async getChunkRange(req, res, next) {
    try {
      const { videoId, quality } = req.params;
      const { start = 0, count = 5 } = req.query;

      const startIndex = parseInt(start, 10);
      const chunkCount = Math.min(parseInt(count, 10), 20); // Max 20 chunks

      if (isNaN(startIndex) || startIndex < 0) {
        return ResponseHelper.error(res, 'Invalid start index', 400);
      }

      const chunks = await chunkService.getChunkRange(videoId, quality, startIndex, chunkCount);

      ResponseHelper.success(res, {
        videoId,
        quality,
        chunks
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * HEAD /api/chunks/:videoId/:quality/:chunkIndex
   * Get chunk metadata without body
   */
  async headChunk(req, res, next) {
    try {
      const { videoId, quality, chunkIndex } = req.params;
      const index = parseInt(chunkIndex, 10);

      if (isNaN(index) || index < 0) {
        return res.status(400).end();
      }

      const chunk = await chunkService.getChunkByIndex(videoId, quality, index);

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Content-Length', chunk.size);
      res.setHeader('X-Chunk-Index', index);
      res.setHeader('X-Video-Id', videoId);
      res.setHeader('X-Quality', chunk.quality);
      
      res.status(200).end();
    } catch (error) {
      res.status(error.status || 500).end();
    }
  }
}

module.exports = new ChunkController();