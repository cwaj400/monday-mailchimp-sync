const express = require('express');
const router = express.Router();

// Status API endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    services: {
      monday: {
        configured: !!process.env.MONDAY_API_KEY && !!process.env.MONDAY_BOARD_ID,
      },
      mailchimp: {
        configured: !!process.env.MAILCHIMP_API_KEY && !!process.env.MAILCHIMP_AUDIENCE_ID && !!process.env.MAILCHIMP_AUDIENCE_NAME,
      },
      discord: {
        configured: !!process.env.DISCORD_WEBHOOK_URL
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 