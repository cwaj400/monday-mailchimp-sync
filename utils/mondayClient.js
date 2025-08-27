const axios = require('axios');
require('dotenv').config();
const Sentry = require('@sentry/node');
const { logger } = require('./logger');

// Export these for testing
const MONDAY_API_URL = 'https://api.monday.com/v2';

// Create a function to initialize the client
function createMondayClient() {
  // Always get the latest API key from environment
  const apiKey = process.env.MONDAY_API_KEY;
  
  if (!apiKey) {
    throw new Error('MONDAY_API_KEY environment variable is not set');
  }
  
  // Create an axios instance for Monday.com API
  return axios.create({
    baseURL: MONDAY_API_URL,
    timeout: 45000, // 45 second timeout (increased)
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey
    },
  });
}

// Initialize the client
let mondayClient = createMondayClient();

/**
 * Execute a GraphQL query against the Monday.com API
 * @param {string} query - GraphQL query
 * @param {object} variables - Query variables
 * @returns {Promise<object>} - Query result
 */
async function executeQuery(query, variables = {}) {
  try {
    // Remove any line breaks and extra spaces from the query
    const cleanQuery = query.replace(/\n\s*/g, ' ').trim();
    logger.info('Executing query now its cleaned', {
      query: cleanQuery,
      variables: variables,
      function: 'executeQuery'
    });
    
    const response = await mondayClient.post('', {
      query: cleanQuery,
      variables: variables
    });
    
    // Check for errors in the response
    if (response.data.errors) {
      const errorMessage = response.data.errors.map(e => e.message).join(', ');
      throw new Error(`Monday.com API error: ${errorMessage}`);
    }
    
    return response.data;
  } catch (error) {
    Sentry.captureException(error, { extra: { phase: 'executeQuery' } });
    logger.error('Monday.com API error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      timeout: error.code === 'ECONNABORTED'
    });
    throw error;
  }
}

// For testing purposes
function setMondayClient(mockClient) {
  mondayClient = mockClient;
}

function setApiKey(apiKey) {
  // Set the environment variable and recreate the client
  process.env.MONDAY_API_KEY = apiKey;
  mondayClient = createMondayClient();
}

module.exports = {
  mondayClient,
  executeQuery,
  setMondayClient, // Export for testing
  setApiKey // Export for testing
};
