const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');
const { findMondayItemByEmail, getXMondayContacts, getAllMondayContacts } = require('../utils/mondayService');
const Sentry = require('@sentry/node');
const {logger}  = require('../utils/logger');

router.get('/', (req, res) => {
  res.json({
    message: 'OK'
  });
});


router.get('/test', (req, res) => {
  Sentry.captureMessage('TEST: Monday.com test endpoint called', 'info');
  logger.info('Monday.com test endpoint called', {
    endpoint: '/api/monday/test'
  });
  res.json({
    message: 'OK'
  });
});

router.get('/find-by-email', async (req, res) => {
  let span = null;
  
  try {

    logger.info('Monday.com find-by-email endpoint called', {
      email: req.query.email,
      endpoint: '/api/monday/find-by-email'
    });

    // Force a test Sentry event to verify it's working
    Sentry.captureMessage('TEST: Monday.com find-by-email endpoint called', 'info');
    
    const email = req.query.email;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    const result = await Sentry.startSpan({
      name: 'monday_find_by_email',
      op: 'api.monday.find',
      attributes: { email: email }
    }, async () => {
      const item = await findMondayItemByEmail(email);
      
      if (item) {
        
        return {
          success: true,
          item: {
            id: item.id,
            name: item.name
          }
        };
      } else {
        
        return {
          success: false,
          message: `No item found with email: ${email}`
        };
      }
    });
    
    // Return the result from the span
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    // Log error to Sentry
    Sentry.captureException(error, {
      context: 'Monday.com find by email',
      email: req.query.email,
      endpoint: '/api/monday/find-by-email'
    });
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/all-x-contacts', async (req, res) => {
  try {
    const x = req.query.quantity;
    
    const contacts = await Sentry.startSpan({
      name: 'monday_get_contacts',
      op: 'api.monday.contacts',
      attributes: { quantity: x }
    }, async () => {
      const contacts = await getAllMondayContacts(x);
      
      
      return contacts;
    });
    
    res.json(contacts);
  } catch (error) {
    // Log error to Sentry
    Sentry.captureException(error, {
      context: 'Monday.com get contacts',
      quantity: req.query.quantity,
      endpoint: '/api/monday/all-x-contacts'
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
