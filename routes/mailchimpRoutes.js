const express = require('express');
const router = express.Router();
const { mailchimpClient } = require('../utils/mailchimpClient');
require('dotenv').config();

const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;

// Check Mailchimp connection status
router.get('/', async (req, res) => {
  try {
    req.json({
        connected: true,
        account: "test",
        totalSubscribers: 100
    })
    // Test the connection by getting account info
    // const response = await mailchimpClient.get('/');
    
    // res.json({
    //   connected: true,
    //   account: response.data.account_name,
    //   totalSubscribers: response.data.total_subscribers
    // });
  } catch (error) {
    res.json({
      connected: false,
      message: error.response?.data?.detail || error.message
    });
  }
});

// Get list information
router.get('/list', async (req, res) => {
  try {
    if (!MAILCHIMP_AUDIENCE_ID) {
      return res.status(400).json({ 
        error: 'MAILCHIMP_AUDIENCE_ID is not defined in environment variables' 
      });
    }
    
    const response = await mailchimpClient.get(`/lists/${MAILCHIMP_AUDIENCE_ID}`);
    
    res.json({
      id: response.data.id,
      name: response.data.name,
      memberCount: response.data.stats.member_count,
      unsubscribeCount: response.data.stats.unsubscribe_count,
      dateCreated: response.data.date_created
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp list information',
      details: error.response?.data?.detail || error.message
    });
  }
});

// Get list members (paginated)
router.get('/list/members', async (req, res) => {
  const { count = 10, offset = 0 } = req.query;
  
  try {
    if (!MAILCHIMP_AUDIENCE_ID) {
      return res.status(400).json({ 
        error: 'MAILCHIMP_AUDIENCE_ID is not defined in environment variables' 
      });
    }
    
    const response = await mailchimpClient.get(`/lists/${MAILCHIMP_AUDIENCE_ID}/members`, {
      params: {
        count,
        offset
      }
    });
    
    res.json({
      totalItems: response.data.total_items,
      members: response.data.members.map(member => ({
        id: member.id,
        email: member.email_address,
        status: member.status,
        fullName: `${member.merge_fields.FNAME || ''} ${member.merge_fields.LNAME || ''}`.trim(),
        lastChanged: member.last_changed
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp members',
      details: error.response?.data?.detail || error.message
    });
  }
});


// Add a single member to the list (for testing)
router.post('/list/members', async (req, res) => {
  const { email, firstName, lastName, status = 'subscribed' } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    if (!MAILCHIMP_AUDIENCE_ID) {
      return res.status(400).json({ 
        error: 'MAILCHIMP_AUDIENCE_ID is not defined in environment variables' 
      });
    }
    
    const response = await mailchimpClient.post(`/lists/${MAILCHIMP_AUDIENCE_ID}/members`, {
      email_address: email,
      status: status,
      merge_fields: {
        FNAME: firstName || '',
        LNAME: lastName || ''
      }
    });
    
    res.json({
      success: true,
      member: {
        id: response.data.id,
        email: response.data.email_address,
        status: response.data.status
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to add member to Mailchimp',
      details: error.response?.data?.detail || error.message
    });
  }
});

router.get('/list/mailing-logs', async (req, res) => {
    try {
        if (!MAILCHIMP_AUDIENCE_ID) {
          return res.status(400).json({ 
            error: 'MAILCHIMP_AUDIENCE_ID is not defined in environment variables' 
          });
        }
        
        const response = await mailchimpClient.get(`/lists/${MAILCHIMP_AUDIENCE_ID}`);
        
        res.json({
          id: response.data.id,
          name: response.data.name,
          memberCount: response.data.stats.member_count,
          unsubscribeCount: response.data.stats.unsubscribe_count,
          dateCreated: response.data.date_created
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to fetch Mailchimp list information',
          details: error.response?.data?.detail || error.message
        });
      }
})

module.exports = router;
