const request = require('supertest');
const express = require('express');
const mailchimpRoutes = require('../routes/mailchimpRoutes');
const { mailchimpClient } = require('../utils/mailchimpClient');

// Log the structure of mailchimpClient to see what we're working with

// Mock the mailchimpClient
jest.mock('../utils/mailchimpClient', () => ({
  mailchimpClient: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/mailchimp', mailchimpRoutes);

describe('Mailchimp Routes API', () => {
  // Set up environment variables before all tests
  beforeAll(() => {
    // Store original env variables
    this.originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.MAILCHIMP_AUDIENCE_ID = 'test-audience-id';
    
    // Log to verify it's set
  });
  
  // Restore original env variables after all tests
  afterAll(() => {
    process.env = this.originalEnv;
  });

  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
});
