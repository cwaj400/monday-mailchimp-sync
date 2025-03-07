const express = require('express');
const router = express.Router();

// Status API endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    services: {
      monday: {
        configured: !!process.env.MONDAY_API_KEY,
        boardId: process.env.MONDAY_BOARD_ID ? 'configured' : 'not configured'
      },
      mailchimp: {
        configured: !!process.env.MAILCHIMP_API_KEY,
        audienceId: process.env.MAILCHIMP_AUDIENCE_ID ? 'configured' : 'not configured',
        audienceName: process.env.MAILCHIMP_AUDIENCE_NAME || 'not specified'
      },
      discord: {
        configured: !!process.env.DISCORD_WEBHOOK_URL
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 