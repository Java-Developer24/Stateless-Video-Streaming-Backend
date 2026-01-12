// src/services/tokenService.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

class TokenService {
  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, config.security.jwtSecret, {
      expiresIn: config.security.jwtExpiry
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.security.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate signed URL for chunk access
   */
  generateSignedUrl(videoId, quality, chunkIndex, expiresIn = config.security.signedUrlExpiry) {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const data = `${videoId}:${quality}:${chunkIndex}:${expires}`;
    const signature = this.createSignature(data);

    return {
      signature,
      expires,
      params: { videoId, quality, chunkIndex, expires, signature }
    };
  }

  /**
   * Verify signed URL
   */
  verifySignedUrl(videoId, quality, chunkIndex, expires, signature) {
    // Check expiration
    if (Math.floor(Date.now() / 1000) > expires) {
      return { valid: false, reason: 'URL expired' };
    }

    // Verify signature
    const data = `${videoId}:${quality}:${chunkIndex}:${expires}`;
    const expectedSignature = this.createSignature(data);

    if (signature !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }

  /**
   * Create HMAC signature
   */
  createSignature(data) {
    return crypto
      .createHmac('sha256', config.security.jwtSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate batch signed URLs
   */
  generateBatchSignedUrls(videoId, quality, startIndex, count, expiresIn) {
    const urls = [];
    for (let i = 0; i < count; i++) {
      urls.push({
        chunkIndex: startIndex + i,
        ...this.generateSignedUrl(videoId, quality, startIndex + i, expiresIn)
      });
    }
    return urls;
  }
}

module.exports = new TokenService();