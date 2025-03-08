const express = require('express');
const router = express.Router();
const mailchimp = require('@mailchimp/mailchimp_marketing');
const { executeQuery } = require('../utils/mondayClient');

// Configure the Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

// Status API endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    environment: process.env.VERCEL_ENV === 'preview' ? 'preview' : process.env.NODE_ENV || 'development',
    services: {
      configured: !!process.env.MAILCHIMP_API_KEY && !!process.env.MAILCHIMP_AUDIENCE_ID && !!process.env.MAILCHIMP_AUDIENCE_NAME && !!process.env.MONDAY_API_KEY && !!process.env.MONDAY_BOARD_ID && !!process.env.DISCORD_WEBHOOK_URL,
    },
    timestamp: new Date().toISOString()
  });
});



const getAudienceId = () => {
  return process.env.MAILCHIMP_AUDIENCE_ID;
};

// Check Mailchimp connection status
router.get('/mailchimp', async (req, res) => {
  try {
    // Test the connection by getting account info
    const response = await mailchimp.ping.get();
    
    if (response && response.health_status === "Everything's Chimpy!") {
      // Get current audience info
      const audienceId = getAudienceId();
      let currentAudience = null;
      let subscriberCount = 0;
      
      if (audienceId) {
        try {
          currentAudience = await mailchimp.lists.getList(audienceId);
          subscriberCount = currentAudience.stats.member_count;
        } catch (err) {
          console.warn(`Could not fetch audience with ID ${audienceId}:`, err.message);
        }
      }
      
      res.json({
        connected: true,
        environment: process.env.NODE_ENV || 'development',
        currentAudience: currentAudience ? {
          memberCount: subscriberCount
        } : null
      });
    } else {
      res.json({
        connected: false,
        message: "Mailchimp API is not responding correctly"
      });
    }
  } catch (error) {
    console.error('Mailchimp connection error:', error.message);
    res.json({
      connected: false,
      message: error.response?.data?.detail || error.message
    });
  }
});

// Check Monday.com connection status
router.get('/monday', async (req, res) => {
  try {
    // Simple query to test the connection
    const query = `
      query {
        me {
          id
          name
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (result.data && result.data.me) {
      res.json({
        connected: true,
      });
    } else {
      res.json({
        connected: false,
        message: 'Could not retrieve user information'
      });
    }
  } catch (error) {
    console.error('Monday.com connection error:', error);
    res.json({
      connected: false,
      message: error.response?.data?.error_message || error.message
    });
  }
});

module.exports = router; 