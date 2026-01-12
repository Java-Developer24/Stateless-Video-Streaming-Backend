// src/controllers/videoController.js
const storageService = require('../services/storageService');
const tokenService = require('../services/tokenService');
const ResponseHelper = require('../utils/responseHelper');
const config = require('../config');

class VideoController {
  /**
   * POST /api/auth/token
   * Generate access token (for demo purposes)
   */
  async generateToken(req, res, next) {
    try {
      const { userId = 'anonymous', permissions = ['read'] } = req.body;

      const token = tokenService.generateAccessToken({
        userId,
        permissions,
        type: 'access'
      });

      ResponseHelper.success(res, {
        token,
        type: 'Bearer',
        expiresIn: config.security.jwtExpiry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(req, res) {
    ResponseHelper.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }

  /**
   * GET /api/config
   * Get public configuration
   */
  async getConfig(req, res) {
    ResponseHelper.success(res, {
      chunkDuration: config.storage.chunkDuration,
      supportedQualities: config.storage.supportedQualities,
      defaultQuality: config.storage.defaultQuality,
      authEnabled: config.security.enableAuth,
      cdnEnabled: config.cdn.enabled,
      cdnBaseUrl: config.cdn.enabled ? config.cdn.baseUrl : null
    });
  }
}

module.exports = new VideoController();