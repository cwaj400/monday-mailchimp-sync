const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

// Get settings page
router.get('/', (req, res) => {
  // Get environment variables for display
  const settings = {
    monday: {
      apiKey: process.env.MONDAY_API_KEY ? '••••••••' : 'Not configured',
      boardId: process.env.MONDAY_BOARD_ID || 'Not configured'
    },
    mailchimp: {
      apiKey: process.env.MAILCHIMP_API_KEY ? '••••••••' : 'Not configured',
      audienceId: process.env.MAILCHIMP_AUDIENCE_ID || 'Not configured',
      serverPrefix: process.env.MAILCHIMP_SERVER_PREFIX || 'Not configured',
      webhookSecret: process.env.MAILCHIMP_WEBHOOK_SECRET ? '••••••••' : 'Not configured'
    }
  };
  
  // Generate webhook URL
  const host = req.get('host');
  const protocol = req.protocol;
  const webhookUrl = `${protocol}://${host}/api/webhooks/mailchimp`;
  
  res.render('settings', {
    title: 'Settings',
    settings,
    webhookUrl
  });
});

module.exports = router; 