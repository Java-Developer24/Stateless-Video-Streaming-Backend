// src/controllers/metadataController.js
const storageService = require('../services/storageService');
const tokenService = require('../services/tokenService');
const ResponseHelper = require('../utils/responseHelper');
const TimeUtils = require('../utils/timeUtils');
const config = require('../config');
const logger = require('../utils/logger');

class MetadataController {
  /**
   * GET /api/videos
   * List all available videos
   */
  async listVideos(req, res, next) {
    try {
      const videos = await storageService.listVideos();
      
      const formattedVideos = videos.map(video => ({
        id: video.videoId,
        title: video.title,
        duration: video.duration,
        formattedDuration: TimeUtils.formatDuration(video.duration),
        thumbnail: video.thumbnail,
        qualities: video.qualities
      }));

      ResponseHelper.success(res, { 
        videos: formattedVideos,
        total: formattedVideos.length 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/videos/:videoId
   * Get video metadata
   */
  async getVideoMetadata(req, res, next) {
    try {
      const { videoId } = req.params;

      const exists = await storageService.videoExists(videoId);
      if (!exists) {
        return ResponseHelper.error(res, 'Video not found', 404);
      }

      const metadata = await storageService.getMetadata(videoId);
      const qualities = await storageService.getAvailableQualities(videoId);

      const response = {
        id: videoId,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        formattedDuration: TimeUtils.formatDuration(metadata.duration),
        chunkDuration: metadata.chunkDuration,
        totalChunks: metadata.totalChunks,
        qualities: qualities.map(q => ({
          name: q,
          resolution: metadata.resolutions?.[q] || q,
          bitrate: metadata.bitrates?.[q]
        })),
        defaultQuality: qualities.includes(config.storage.defaultQuality) 
          ? config.storage.defaultQuality 
          : qualities[0],
        thumbnail: metadata.thumbnail,
        createdAt: metadata.createdAt
      };

      // Add CDN base URL if enabled
      if (config.cdn.enabled) {
        response.cdnBaseUrl = config.cdn.baseUrl;
      }

      ResponseHelper.success(res, response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/videos/:videoId/manifest
   * Get video manifest (chunk list)
   */
  async getManifest(req, res, next) {
    try {
      const { videoId } = req.params;
      const { quality } = req.query;

      const exists = await storageService.videoExists(videoId);
      if (!exists) {
        return ResponseHelper.error(res, 'Video not found', 404);
      }

      const metadata = await storageService.getMetadata(videoId);
      const qualities = await storageService.getAvailableQualities(videoId);
      
      const selectedQuality = quality && qualities.includes(quality) 
        ? quality 
        : config.storage.defaultQuality;

      // Generate chunk list
      const chunks = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunk = {
          index: i,
          startTime: TimeUtils.chunkIndexToTimestamp(i, metadata.chunkDuration),
          duration: i === metadata.totalChunks - 1 
            ? metadata.duration - (i * metadata.chunkDuration)
            : metadata.chunkDuration
        };

        // Add signed URL if auth is enabled
        if (config.security.enableAuth) {
          const signed = tokenService.generateSignedUrl(videoId, selectedQuality, i);
          chunk.url = `/api/chunks/${videoId}/${selectedQuality}/${i}?expires=${signed.expires}&signature=${signed.signature}`;
        } else {
          chunk.url = `/api/chunks/${videoId}/${selectedQuality}/${i}`;
        }

        chunks.push(chunk);
      }

      ResponseHelper.success(res, {
        videoId,
        quality: selectedQuality,
        availableQualities: qualities,
        totalDuration: metadata.duration,
        chunkDuration: metadata.chunkDuration,
        totalChunks: metadata.totalChunks,
        chunks
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/videos/:videoId/signed-urls
   * Get batch signed URLs for chunks
   */
  async getSignedUrls(req, res, next) {
    try {
      const { videoId } = req.params;
      const { 
        quality = config.storage.defaultQuality,
        start = 0,
        count = 10,
        expiresIn = config.security.signedUrlExpiry
      } = req.query;

      const exists = await storageService.videoExists(videoId);
      if (!exists) {
        return ResponseHelper.error(res, 'Video not found', 404);
      }

      const metadata = await storageService.getMetadata(videoId);
      const startIndex = parseInt(start, 10);
      const chunkCount = Math.min(parseInt(count, 10), metadata.totalChunks - startIndex);

      const signedUrls = tokenService.generateBatchSignedUrls(
        videoId,
        quality,
        startIndex,
        chunkCount,
        parseInt(expiresIn, 10)
      );

      ResponseHelper.success(res, {
        videoId,
        quality,
        signedUrls: signedUrls.map(url => ({
          chunkIndex: url.chunkIndex,
          url: `/api/chunks/${videoId}/${quality}/${url.chunkIndex}?expires=${url.expires}&signature=${url.signature}`,
          expires: url.expires
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MetadataController();