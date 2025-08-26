const axios = require('axios');
require('dotenv').config();

// Export these for testing
let MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const MONDAY_API_URL = 'https://api.monday.com/v2';

// Create a function to initialize the client
function createMondayClient() {
    
  // Create an axios instance for Monday.com API
  return axios.create({
    baseURL: MONDAY_API_URL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      'Authorization': MONDAY_API_KEY
    }
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
    console.error('Monday.com API error:', {
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
  MONDAY_API_KEY = apiKey;
  mondayClient = createMondayClient();
}

module.exports = {
  mondayClient,
  executeQuery,
  setMondayClient, // Export for testing
  setApiKey // Export for testing
};
