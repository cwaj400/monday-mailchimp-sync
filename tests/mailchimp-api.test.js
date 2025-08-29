const request = require('supertest');
const express = require('express');
const mailchimpRoutes = require('../routes/mailchimpRoutes');
const { apiKeyAuth } = require('../utils/authMiddleware');

// Mock the mailchimpClient
jest.mock('../utils/mailchimpClient', () => ({
  getMailchimpClient: jest.fn(() => ({
    batches: {
      list: jest.fn().mockResolvedValue({
        batches: [
          {
            id: 'test-batch-1',
            status: 'finished',
            total_operations: 1,
            finished_operations: 1,
            errored_operations: 0
          },
          {
            id: 'test-batch-2',
            status: 'processing',
            total_operations: 1,
            finished_operations: 0,
            errored_operations: 0
          }
        ],
        total_items: 2
      }),
      status: jest.fn().mockResolvedValue({
        id: 'test-batch-1',
        status: 'finished',
        total_operations: 1,
        finished_operations: 1,
        errored_operations: 0
      })
    }
  }))
}));

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/mailchimp', apiKeyAuth, mailchimpRoutes);

describe('Mailchimp Routes API', () => {
  // Set up environment variables before all tests
  beforeAll(() => {
    // Store original env variables
    this.originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.MAILCHIMP_AUDIENCE_ID = 'test-audience-id';
    process.env.APP_API_KEY = 'test-api-key';
  });
  
  // Restore original env variables after all tests
  afterAll(() => {
    process.env = this.originalEnv;
  });

  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/mailchimp/batches', () => {
    it('should return all batches when authenticated', async () => {
      const response = await request(app)
        .get('/api/mailchimp/batches')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('batches');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.batches)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/mailchimp/batches')
        .expect(401);
    });
  });

  describe('GET /api/mailchimp/batches/:batchId', () => {
    it('should return specific batch status when authenticated', async () => {
      const response = await request(app)
        .get('/api/mailchimp/batches/test-batch-1')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('batch');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.batch).toHaveProperty('id', 'test-batch-1');
    });

    it('should return 400 for invalid batch ID', async () => {
      await request(app)
        .get('/api/mailchimp/batches/ab')
        .set('x-api-key', 'test-api-key')
        .expect(400);
    });
  });

  describe('GET /api/mailchimp/batches/active', () => {
    it('should return active batches when authenticated', async () => {
      const response = await request(app)
        .get('/api/mailchimp/batches/active')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('batches');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.batches)).toBe(true);
    });
  });
});
