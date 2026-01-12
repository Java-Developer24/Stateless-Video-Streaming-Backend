// src/controllers/uploadController.js

const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const config = require('../config');
const logger = require('../utils/logger');
const ResponseHelper = require('../utils/responseHelper');
const downloadService = require('../services/downloadService');
const { segmentVideo, updateMetadata } = require('../../scripts/segmentVideo');

// Store processing jobs status
const processingJobs = new Map();

/**
 * Configure multer for file uploads
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = config.upload.tempDir;
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const videoId = uuidv4();
    const ext = path.extname(file.originalname);
    req.videoId = videoId;
    cb(null, `${videoId}_upload${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = config.upload.allowedTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter
});

class UploadController {
  /**
   * POST /api/videos/from-url
   * Process video from external URL
   */
  async processFromUrl(req, res, next) {
    const jobId = uuidv4();
    const videoId = uuidv4();

    try {
      const { url, title, description, qualities } = req.body;

      // Validate URL
      if (!url) {
        return ResponseHelper.error(res, 'Video URL is required', 400);
      }

      try {
        new URL(url);
      } catch {
        return ResponseHelper.error(res, 'Invalid URL format', 400);
      }

      logger.info('Processing video from URL', { jobId, videoId, url });

      // Initialize job status
      processingJobs.set(jobId, {
        jobId,
        videoId,
        status: 'initializing',
        progress: 0,
        stage: 'starting',
        url,
        startedAt: new Date().toISOString()
      });

      // Return immediately with job ID
      res.status(202).json({
        success: true,
        data: {
          jobId,
          videoId,
          status: 'processing',
          message: 'Video processing started',
          statusUrl: `/api/videos/jobs/${jobId}`,
          estimatedTime: 'Depends on video length and quality'
        }
      });

      // Process asynchronously
      this.processVideoAsync(jobId, videoId, url, { title, description, qualities });

    } catch (error) {
      processingJobs.set(jobId, {
        ...processingJobs.get(jobId),
        status: 'failed',
        error: error.message
      });
      logger.error('Failed to start video processing', { jobId, error: error.message });
    }
  }

  /**
   * Async video processing
   */
  async processVideoAsync(jobId, videoId, url, options) {
    let tempFilePath = null;

    try {
      // Update status: Downloading
      this.updateJobStatus(jobId, {
        status: 'downloading',
        stage: 'Downloading video from URL',
        progress: 0
      });

      // Get video info first
      const videoInfo = await downloadService.getVideoInfo(url);
      this.updateJobStatus(jobId, {
        title: options.title || videoInfo.title,
        sourceInfo: videoInfo
      });

      // Download video
      tempFilePath = await downloadService.downloadFromUrl(url, videoId, (progress) => {
        this.updateJobStatus(jobId, {
          status: 'downloading',
          stage: 'Downloading video',
          progress: progress.progress,
          downloaded: progress.downloaded,
          total: progress.total
        });
      });

      logger.info('Download completed', { jobId, videoId, tempFilePath });

      // Update status: Processing
      this.updateJobStatus(jobId, {
        status: 'processing',
        stage: 'Encoding video chunks',
        progress: 0
      });

      // Segment video
      const result = await segmentVideo(
        tempFilePath,
        config.storage.basePath,
        videoId,
        {
          title: options.title || videoInfo.title,
          description: options.description || videoInfo.description || '',
          qualities: options.qualities || ['720p', '480p', '360p'],
          onProgress: (progress) => {
            this.updateJobStatus(jobId, {
              status: 'processing',
              stage: `Encoding ${progress.quality} (${progress.currentQuality}/${progress.totalQualities})`,
              progress: progress.overallProgress,
              currentQuality: progress.quality,
              qualityProgress: progress.qualityProgress
            });
          }
        }
      );

      // Update metadata with source URL
      await updateMetadata(videoId, {
        sourceUrl: url,
        sourceTitle: videoInfo.title
      });

      // Update status: Completed
      this.updateJobStatus(jobId, {
        status: 'completed',
        stage: 'Processing complete',
        progress: 100,
        completedAt: new Date().toISOString(),
        result: {
          videoId,
          streamUrl: `/api/videos/${videoId}`,
          manifestUrl: `/api/videos/${videoId}/manifest`,
          ...result.metadata
        }
      });

      logger.info('Video processing completed', { jobId, videoId });

    } catch (error) {
      logger.error('Video processing failed', { jobId, videoId, error: error.message });

      this.updateJobStatus(jobId, {
        status: 'failed',
        stage: 'Error',
        error: error.message,
        failedAt: new Date().toISOString()
      });

    } finally {
      // Cleanup temp file
      if (tempFilePath) {
        await downloadService.cleanup(tempFilePath);
      }
    }
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId, updates) {
    const current = processingJobs.get(jobId) || {};
    processingJobs.set(jobId, { ...current, ...updates, updatedAt: new Date().toISOString() });
  }

  /**
   * GET /api/videos/jobs/:jobId
   * Get processing job status
   */
  async getJobStatus(req, res) {
    const { jobId } = req.params;

    const job = processingJobs.get(jobId);

    if (!job) {
      return ResponseHelper.error(res, 'Job not found', 404);
    }

    ResponseHelper.success(res, job);
  }

  /**
   * GET /api/videos/jobs
   * List all processing jobs
   */
  async listJobs(req, res) {
    const jobs = Array.from(processingJobs.values())
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 50); // Last 50 jobs

    ResponseHelper.success(res, { jobs, total: jobs.length });
  }

  /**
   * POST /api/videos/upload
   * Upload video file directly
   */
  getUploadMiddleware() {
    return upload.single('video');
  }

  async uploadVideo(req, res, next) {
    const jobId = uuidv4();

    try {
      if (!req.file) {
        return ResponseHelper.error(res, 'No video file uploaded', 400);
      }

      const videoId = req.videoId;
      const { title, description, qualities } = req.body;

      logger.info('Processing uploaded video', { jobId, videoId, filename: req.file.originalname });

      // Initialize job status
      processingJobs.set(jobId, {
        jobId,
        videoId,
        status: 'processing',
        progress: 0,
        stage: 'Starting',
        filename: req.file.originalname,
        startedAt: new Date().toISOString()
      });

      // Return immediately
      res.status(202).json({
        success: true,
        data: {
          jobId,
          videoId,
          status: 'processing',
          message: 'Video upload processing started',
          statusUrl: `/api/videos/jobs/${jobId}`
        }
      });

      // Process asynchronously
      this.processUploadAsync(jobId, videoId, req.file.path, {
        title: title || req.file.originalname,
        description,
        qualities: qualities ? qualities.split(',') : ['720p', '480p', '360p']
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Async upload processing
   */
  async processUploadAsync(jobId, videoId, filePath, options) {
    try {
      const result = await segmentVideo(
        filePath,
        config.storage.basePath,
        videoId,
        {
          ...options,
          onProgress: (progress) => {
            this.updateJobStatus(jobId, {
              status: 'processing',
              stage: `Encoding ${progress.quality}`,
              progress: progress.overallProgress,
              currentQuality: progress.quality
            });
          }
        }
      );

      this.updateJobStatus(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
        result: {
          videoId,
          streamUrl: `/api/videos/${videoId}`,
          manifestUrl: `/api/videos/${videoId}/manifest`,
          ...result.metadata
        }
      });

    } catch (error) {
      this.updateJobStatus(jobId, {
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });
    } finally {
      // Cleanup uploaded file
      await fs.unlink(filePath).catch(() => {});
    }
  }

  /**
   * POST /api/videos/from-url/sync
   * Process video synchronously (waits for completion)
   * Use only for short videos or testing
   */
  async processFromUrlSync(req, res, next) {
    let tempFilePath = null;

    try {
      const { url, title, description, qualities } = req.body;
      const videoId = uuidv4();

      if (!url) {
        return ResponseHelper.error(res, 'Video URL is required', 400);
      }

      logger.info('Processing video synchronously', { videoId, url });

      // Download
      const videoInfo = await downloadService.getVideoInfo(url);
      tempFilePath = await downloadService.downloadFromUrl(url, videoId);

      // Process
      const result = await segmentVideo(
        tempFilePath,
        config.storage.basePath,
        videoId,
        {
          title: title || videoInfo.title,
          description: description || '',
          qualities: qualities || ['720p', '480p']
        }
      );

      ResponseHelper.success(res, {
        videoId,
        streamUrl: `/api/videos/${videoId}`,
        manifestUrl: `/api/videos/${videoId}/manifest`,
        ...result.metadata
      }, 201);

    } catch (error) {
      next(error);
    } finally {
      if (tempFilePath) {
        await downloadService.cleanup(tempFilePath);
      }
    }
  }

  /**
   * DELETE /api/videos/jobs/:jobId
   * Cancel/delete processing job
   */
  async deleteJob(req, res) {
    const { jobId } = req.params;

    if (!processingJobs.has(jobId)) {
      return ResponseHelper.error(res, 'Job not found', 404);
    }

    processingJobs.delete(jobId);
    ResponseHelper.success(res, { message: 'Job deleted' });
  }
}

module.exports = new UploadController();