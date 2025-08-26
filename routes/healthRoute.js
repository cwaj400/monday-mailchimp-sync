const express = require('express');
const router = express.Router();
const {logger} = require('../utils/logger');

router.get('/', (req, res) => {
  logger.info('Health check endpoint called', {
    endpoint: '/api/health'
  });
  res.status(200).send('OK');
});

module.exports = router;