const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');
const { findMondayItemByEmail, getXMondayContacts, getAllMondayContacts } = require('../utils/mondayService');
const { addBreadcrumb, startSpanManual, Sentry } = require('../utils/sentry');

router.get('/', (req, res) => {
  res.json({
    message: 'OK'
  });
});

router.get('/find-by-email', async (req, res) => {
  let span = null;
  
  try {
    // Start Sentry span for performance monitoring
    span = startSpanManual({
      name: 'monday_find_by_email',
      op: 'api.monday.find',
      forceTransaction: true
    });
    
    const email = req.query.email;
    
    // Add breadcrumb for request
    addBreadcrumb('Monday.com find by email request', 'api.monday', {
      email: email || 'not_provided',
      endpoint: '/api/monday/find-by-email'
    });
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    const item = await findMondayItemByEmail(email);
    
    if (item) {
      // Add breadcrumb for success
      addBreadcrumb('Monday.com item found', 'api.monday', {
        email,
        itemId: item.id,
        itemName: item.name
      });
      
      return res.json({
        success: true,
        item: {
          id: item.id,
          name: item.name
        }
      });
    } else {
      // Add breadcrumb for not found
      addBreadcrumb('Monday.com item not found', 'api.monday', {
        email
      });
      
      return res.status(404).json({
        success: false,
        message: `No item found with email: ${email}`
      });
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
  } finally {
    if (span) {
      span.end();
    }
  }
});

router.get('/all-x-contacts', async (req, res) => {
  let span = null;
  
  try {
    // Start Sentry span for performance monitoring
    span = startSpanManual({
      name: 'monday_get_contacts',
      op: 'api.monday.contacts',
      forceTransaction: true
    });
    
    const x = req.query.quantity;
    
    // Add breadcrumb for request
    addBreadcrumb('Monday.com get contacts request', 'api.monday', {
      quantity: x || 'not_provided',
      endpoint: '/api/monday/all-x-contacts'
    });
    
    const contacts = await getAllMondayContacts(x);
    
    // Add breadcrumb for success
    addBreadcrumb('Monday.com contacts retrieved', 'api.monday', {
      quantity: x,
      contactCount: contacts.length || 0
    });
    
    res.json(contacts);
  } catch (error) {
    // Log error to Sentry
    Sentry.captureException(error, {
      context: 'Monday.com get contacts',
      quantity: req.query.quantity,
      endpoint: '/api/monday/all-x-contacts'
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (span) {
      span.end();
    }
  }
});

module.exports = router;
