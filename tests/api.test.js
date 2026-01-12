// tests/api.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Video Streaming API', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  describe('GET /api/config', () => {
    it('should return public configuration', async () => {
      const res = await request(app)
        .get('/api/config')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('chunkDuration');
      expect(res.body.data).toHaveProperty('supportedQualities');
    });
  });

  describe('GET /api/videos', () => {
    it('should return list of videos', async () => {
      const res = await request(app)
        .get('/api/videos')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('videos');
      expect(Array.isArray(res.body.data.videos)).toBe(true);
    });
  });

  describe('GET /api/videos/:videoId', () => {
    it('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .get('/api/videos/non-existent-id')
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/chunks/:videoId/:quality/:chunkIndex', () => {
    it('should return 404 for non-existent chunk', async () => {
      const res = await request(app)
        .get('/api/chunks/non-existent/720p/0')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid chunk index', async () => {
      const res = await request(app)
        .get('/api/chunks/test-video/720p/-1')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/token', () => {
    it('should generate access token', async () => {
      const res = await request(app)
        .post('/api/auth/token')
        .send({ userId: 'test-user' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.type).toBe('Bearer');
    });
  });
});