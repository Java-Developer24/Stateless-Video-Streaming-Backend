// src/services/downloadService.js - Replace the entire file

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class DownloadService {
  constructor() {
    this.tempDir = config.upload.tempDir;
    this.ensureTempDir();
  }

  async ensureTempDir() {
    const fsPromises = require('fs').promises;
    try {
      await fsPromises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message });
    }
  }

  /**
   * Download video from URL
   */
  async downloadFromUrl(url, videoId, onProgress = null) {
    const outputPath = path.join(this.tempDir, `${videoId}_source.mp4`);

    // Check if YouTube URL - not supported in this environment
    if (this.isYouTubeUrl(url)) {
      throw new Error(
        'YouTube URLs are not supported due to bot protection. ' +
        'Please use a direct video URL (e.g., .mp4, .webm files). ' +
        'Try: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      );
    }

    // Download direct URL
    return this.downloadDirect(url, outputPath, onProgress);
  }

  /**
   * Check if URL is YouTube
   */
  isYouTubeUrl(url) {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/;
    return ytRegex.test(url);
  }

  /**
   * Download direct video URL
   */
  async downloadDirect(url, outputPath, onProgress) {
    logger.info('Downloading video', { url });

    // Update progress
    if (onProgress) {
      onProgress({ stage: 'downloading', progress: 0, message: 'Starting download...' });
    }

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 300000, // 5 minute timeout
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
        }
      });

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('video') && !contentType.includes('octet-stream')) {
        throw new Error(`Invalid content type: ${contentType}. Expected video file.`);
      }

      const totalLength = parseInt(response.headers['content-length'], 10);
      let downloadedLength = 0;
      let lastProgressUpdate = 0;

      const writer = fs.createWriteStream(outputPath);

      response.data.on('data', (chunk) => {
        downloadedLength += chunk.length;
        
        if (onProgress && totalLength) {
          const progress = Math.round((downloadedLength / totalLength) * 100);
          
          // Update every 5%
          if (progress >= lastProgressUpdate + 5 || progress === 100) {
            lastProgressUpdate = progress;
            onProgress({
              stage: 'downloading',
              progress,
              downloaded: downloadedLength,
              total: totalLength,
              message: `Downloaded ${(downloadedLength / 1024 / 1024).toFixed(1)} MB / ${(totalLength / 1024 / 1024).toFixed(1)} MB`
            });
          }
        }
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info('Download completed', { 
            outputPath, 
            size: `${(downloadedLength / 1024 / 1024).toFixed(2)} MB` 
          });
          resolve(outputPath);
        });
        
        writer.on('error', (error) => {
          fs.unlink(outputPath, () => {});
          reject(new Error(`Write error: ${error.message}`));
        });
        
        response.data.on('error', (error) => {
          fs.unlink(outputPath, () => {});
          reject(new Error(`Download error: ${error.message}`));
        });
      });

    } catch (error) {
      // Clean up partial file
      fs.unlink(outputPath, () => {});
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Download timed out. The video file may be too large or the server is slow.');
      }
      
      if (error.response) {
        throw new Error(`Server returned ${error.response.status}: ${error.response.statusText}`);
      }
      
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Get video info without downloading
   */
  async getVideoInfo(url) {
    // Check YouTube
    if (this.isYouTubeUrl(url)) {
      return {
        url,
        title: 'YouTube Video (Not Supported)',
        error: 'YouTube URLs are not supported. Use direct video URLs.'
      };
    }

    try {
      const response = await axios.head(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const contentType = response.headers['content-type'] || '';
      const contentLength = parseInt(response.headers['content-length'], 10) || null;
      
      // Extract filename from URL
      const urlPath = new URL(url).pathname;
      const filename = path.basename(urlPath, path.extname(urlPath)) || 'video';

      return {
        url,
        title: this.formatTitle(filename),
        contentType,
        contentLength,
        size: contentLength ? `${(contentLength / 1024 / 1024).toFixed(2)} MB` : 'Unknown'
      };
      
    } catch (error) {
      logger.warn('Failed to get video info', { url, error: error.message });
      
      // Return basic info even if HEAD request fails
      const urlPath = new URL(url).pathname;
      const filename = path.basename(urlPath, path.extname(urlPath)) || 'video';
      
      return {
        url,
        title: this.formatTitle(filename)
      };
    }
  }

  /**
   * Format title from filename
   */
  formatTitle(filename) {
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Cleanup temp file
   */
  async cleanup(filePath) {
    try {
      await fs.promises.unlink(filePath);
      logger.info('Cleaned up temp file', { filePath });
    } catch (error) {
      // Ignore if file doesn't exist
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to cleanup', { filePath, error: error.message });
      }
    }
  }
}

module.exports = new DownloadService();