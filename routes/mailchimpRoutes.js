const express = require('express');
const router = express.Router();
const mailchimp = require('@mailchimp/mailchimp_marketing');
require('dotenv').config();

// Configure the Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

// Simplified approach - just use MAILCHIMP_AUDIENCE_ID which will be loaded from the appropriate .env file
const getAudienceId = () => {
  return process.env.MAILCHIMP_AUDIENCE_ID;
};

// Check Mailchimp connection status
router.get('/', async (req, res) => {
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
module.exports = router;
