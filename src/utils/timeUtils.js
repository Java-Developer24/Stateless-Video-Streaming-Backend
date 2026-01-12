// src/utils/timeUtils.js

class TimeUtils {
  /**
   * Convert timestamp (seconds) to chunk index
   */
  static timestampToChunkIndex(timestamp, chunkDuration) {
    return Math.floor(timestamp / chunkDuration);
  }

  /**
   * Convert chunk index to start timestamp
   */
  static chunkIndexToTimestamp(index, chunkDuration) {
    return index * chunkDuration;
  }

  /**
   * Parse time string (HH:MM:SS or MM:SS or SS) to seconds
   */
  static parseTimeString(timeString) {
    const parts = timeString.split(':').map(Number);
    
    if (parts.some(isNaN)) {
      throw new Error('Invalid time format');
    }

    switch (parts.length) {
      case 1:
        return parts[0];
      case 2:
        return parts[0] * 60 + parts[1];
      case 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      default:
        throw new Error('Invalid time format');
    }
  }

  /**
   * Format seconds to HH:MM:SS
   */
  static formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = TimeUtils;