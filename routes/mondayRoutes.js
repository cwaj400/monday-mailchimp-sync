const express = require('express');
const { getMondayLeads, updateTouchpoints } = require('../controllers/mondayController');
const { handleMondayWebhook } = require('../controllers/mondayController');
const { validateMondayWebhook } = require('../controllers/mondayController');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');

router.get('/getLeads', getMondayLeads);
router.post('/updateTouchpoints', updateTouchpoints);

router.post('/webhook', validateMondayWebhook, handleMondayWebhook);

// Check Monday.com connection status
router.get('/', async (req, res) => {
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
        user: result.data.me.name,
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
