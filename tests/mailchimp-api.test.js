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

  describe('GET /api/mailchimp/list/members', () => {
    it('should return list members when the API call is successful', async () => {
      // Mock data that simulates a successful API response
      const mockMembersData = {
        data: {
          total_items: 2,
          members: [
            {
              id: 'member1',
              email_address: 'test@example.com',
              status: 'subscribed',
              merge_fields: {
                FNAME: 'John',
                LNAME: 'Doe'
              },
              last_changed: '2023-01-01T00:00:00Z'
            },
            {
              id: 'member2',
              email_address: 'another@example.com',
              status: 'subscribed',
              merge_fields: {
                FNAME: 'Jane',
                LNAME: 'Smith'
              },
              last_changed: '2023-01-02T00:00:00Z'
            }
          ]
        }
      };

      // Set up the mock to return our test data
      mailchimpClient.get.mockResolvedValue(mockMembersData);

      // Make the API request using Supertest
      const response = await request(app)
        .get('/api/mailchimp/list/members')
        .query({ count: 10, offset: 0 });

      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.totalItems).toBe(2);
      expect(response.body.members.length).toBe(2);
      expect(response.body.members[0].email).toBe('test@example.com');
      expect(response.body.members[0].fullName).toBe('John Doe');
    });
  });

  describe('POST /api/mailchimp/list/members', () => {
    it('should add a member successfully', async () => {
      // Mock data for a successful member addition
      const mockAddMemberResponse = {
        data: {
          id: 'new-member-id',
          email_address: 'new@example.com',
          status: 'subscribed'
        }
      };

      // Set up the mock
      mailchimpClient.post.mockResolvedValue(mockAddMemberResponse);

      // Make the API request
      const response = await request(app)
        .post('/api/mailchimp/list/members')
        .send({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User'
        });

      // Log the response for debugging

      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.member.email).toBe('new@example.com');
    });

    it('should return 400 when email is not provided', async () => {
      // Make the API request without email
      const response = await request(app)
        .post('/api/mailchimp/list/members')
        .send({
          firstName: 'New',
          lastName: 'User'
        });

      // Verify the response
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('GET /api/mailchimp/list/mailing-logs', () => {
    it('should check api call is successful', async () => {
        const response = await request(app)
        .get('/api/mailchimp/list/mailing-logs')
        .query({ count: 10, offset: 0 });

      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.totalItems).toBe(2);
    })

    it('should return people who have received an email', async () => {
      // Mock data that simulates a successful API response
      const mockMembersData = {
        data: {
          total_items: 2,
          received: [
            {
              id: 'received1',
              email_address: 'received@example.com',
              status: 'subscribed'
            }
          ]
        }
      };

      // Set up the mock
      mailchimpClient.get.mockResolvedValue(mockReceivedData);

      // Make the API request
      const response = await request(app)
        .get('/api/mailchimp/list/received')
        .query({ count: 10, offset: 0 });

      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.totalItems).toBe(2);
      expect(response.body.received.length).toBe(2);
      expect(response.body.received[0].email).toBe('received@example.com');
    });
  });
});
