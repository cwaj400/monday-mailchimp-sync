const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');

router.get('/', (req, res) => {
  res.json({
    message: 'OK'
  });
});

module.exports = router;
