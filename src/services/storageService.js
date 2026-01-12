// src/services/storageService.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class StorageService {
  constructor() {
    this.basePath = config.storage.basePath;
    this.metadataCache = new Map();
  }

  /**
   * Get video directory path
   */
  getVideoPath(videoId) {
    return path.join(this.basePath, videoId);
  }

  /**
   * Get chunk file path
   */
  getChunkPath(videoId, quality, chunkIndex) {
    const paddedIndex = String(chunkIndex).padStart(6, '0');
    return path.join(
      this.basePath,
      videoId,
      'chunks',
      quality,
      `chunk_${paddedIndex}.ts`
    );
  }

  /**
   * Get metadata file path
   */
  getMetadataPath(videoId) {
    return path.join(this.basePath, videoId, 'metadata.json');
  }

  /**
   * Check if video exists
   */
  async videoExists(videoId) {
    try {
      const metadataPath = this.getMetadataPath(videoId);
      await fs.access(metadataPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if chunk exists
   */
  async chunkExists(videoId, quality, chunkIndex) {
    try {
      const chunkPath = this.getChunkPath(videoId, quality, chunkIndex);
      await fs.access(chunkPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get video metadata
   */
  async getMetadata(videoId) {
    // Check cache first
    if (this.metadataCache.has(videoId)) {
      return this.metadataCache.get(videoId);
    }

    const metadataPath = this.getMetadataPath(videoId);
    
    try {
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      
      // Cache the metadata
      this.metadataCache.set(videoId, metadata);
      
      return metadata;
    } catch (error) {
      logger.error(`Failed to read metadata for video ${videoId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get chunk stream
   */
  getChunkStream(videoId, quality, chunkIndex, range = null) {
    const chunkPath = this.getChunkPath(videoId, quality, chunkIndex);
    
    const options = {};
    if (range) {
      options.start = range.start;
      options.end = range.end;
    }

    return fsSync.createReadStream(chunkPath, options);
  }

  /**
   * Get chunk file stats
   */
  async getChunkStats(videoId, quality, chunkIndex) {
    const chunkPath = this.getChunkPath(videoId, quality, chunkIndex);
    return fs.stat(chunkPath);
  }

  /**
   * List all videos
   */
  async listVideos() {
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      const videoIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      const videos = await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            const metadata = await this.getMetadata(videoId);
            return { videoId, ...metadata };
          } catch {
            return null;
          }
        })
      );

      return videos.filter(Boolean);
    } catch (error) {
      logger.error('Failed to list videos', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available qualities for a video
   */
  async getAvailableQualities(videoId) {
    const chunksPath = path.join(this.basePath, videoId, 'chunks');
    
    try {
      const entries = await fs.readdir(chunksPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Clear metadata cache
   */
  clearCache(videoId = null) {
    if (videoId) {
      this.metadataCache.delete(videoId);
    } else {
      this.metadataCache.clear();
    }
  }
}

module.exports = new StorageService();