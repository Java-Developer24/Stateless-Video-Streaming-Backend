// src/services/chunkService.js
const storageService = require('./storageService');
const config = require('../config');
const logger = require('../utils/logger');
const TimeUtils = require('../utils/timeUtils');

class ChunkService {
  /**
   * Get chunk by index
   */
  async getChunkByIndex(videoId, quality, chunkIndex) {
    // Validate video exists
    const exists = await storageService.videoExists(videoId);
    if (!exists) {
      throw { status: 404, message: 'Video not found' };
    }

    // Get metadata to validate chunk index
    const metadata = await storageService.getMetadata(videoId);
    
    if (chunkIndex < 0 || chunkIndex >= metadata.totalChunks) {
      throw { status: 404, message: 'Chunk not found', details: { 
        requestedIndex: chunkIndex, 
        totalChunks: metadata.totalChunks 
      }};
    }

    // Validate quality
    const availableQualities = await storageService.getAvailableQualities(videoId);
    const selectedQuality = availableQualities.includes(quality) 
      ? quality 
      : config.storage.defaultQuality;

    if (!availableQualities.includes(selectedQuality)) {
      throw { status: 404, message: 'Quality not available', details: {
        requested: quality,
        available: availableQualities
      }};
    }

    // Check chunk exists
    const chunkExists = await storageService.chunkExists(videoId, selectedQuality, chunkIndex);
    if (!chunkExists) {
      throw { status: 404, message: 'Chunk file not found' };
    }

    // Get chunk stats
    const stats = await storageService.getChunkStats(videoId, selectedQuality, chunkIndex);

    return {
      videoId,
      quality: selectedQuality,
      chunkIndex,
      size: stats.size,
      getStream: (range) => storageService.getChunkStream(videoId, selectedQuality, chunkIndex, range)
    };
  }

  /**
   * Get chunk by timestamp
   */
  async getChunkByTimestamp(videoId, quality, timestamp) {
    const metadata = await storageService.getMetadata(videoId);
    const chunkIndex = TimeUtils.timestampToChunkIndex(timestamp, metadata.chunkDuration);
    
    return this.getChunkByIndex(videoId, quality, chunkIndex);
  }

  /**
   * Get multiple chunks (for prefetching)
   */
  async getChunkRange(videoId, quality, startIndex, count = 3) {
    const metadata = await storageService.getMetadata(videoId);
    const chunks = [];

    for (let i = 0; i < count && (startIndex + i) < metadata.totalChunks; i++) {
      try {
        const chunk = await this.getChunkByIndex(videoId, quality, startIndex + i);
        chunks.push({
          index: startIndex + i,
          size: chunk.size,
          timestamp: TimeUtils.chunkIndexToTimestamp(startIndex + i, metadata.chunkDuration)
        });
      } catch (error) {
        logger.warn(`Failed to get chunk ${startIndex + i}`, { error: error.message });
      }
    }

    return chunks;
  }

  /**
   * Parse range header
   */
  parseRange(rangeHeader, fileSize) {
    if (!rangeHeader) return null;

    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) return null;

    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return null;
    }

    return { start, end, length: end - start + 1 };
  }
}

module.exports = new ChunkService();