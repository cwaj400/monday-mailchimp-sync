const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    services: {
      // Service status details
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 