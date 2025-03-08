const express = require('express');
const router = express.Router();
const mailchimp = require('@mailchimp/mailchimp_marketing');
require('dotenv').config();

router.get('/', (req, res) => {
  res.json({
    message: 'OK'
  });
});

module.exports = router;
