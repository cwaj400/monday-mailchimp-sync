const express = require('express');
const router = express.Router();
const mailchimp = require('@mailchimp/mailchimp_marketing');
const { executeQuery } = require('../utils/mondayClient');
const Sentry = require('@sentry/node');

// Configure the Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

// Status API endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    environment: process.env.VERCEL_ENV === 'preview' ? 'preview' : process.env.NODE_ENV || 'development',
    services: {
      configured: !!process.env.MAILCHIMP_API_KEY && !!process.env.MAILCHIMP_AUDIENCE_ID  && !!process.env.MONDAY_API_KEY && !!process.env.MONDAY_BOARD_ID && !!process.env.DISCORD_WEBHOOK_URL,
    },
    timestamp: new Date().toISOString()
  });
});



const getAudienceId = () => {
  return process.env.MAILCHIMP_AUDIENCE_ID;
};

// Check Mailchimp connection status
router.get('/mailchimp', async (req, res) => {
  try {
    // Add breadcrumb for request
    Sentry.addBreadcrumb({
      category: 'api.status',
      message: 'Mailchimp status check request',
      data: {
        endpoint: '/api/status/mailchimp'
      }
    });
    
    const mailchimpResult = await Sentry.startSpan({
      name: 'status_mailchimp_check',
      op: 'api.status.mailchimp',
      attributes: {
        endpoint: '/api/status/mailchimp'
      }
    }, async () => {
      // Test the connection by getting account info
      const response = await mailchimp.ping.get();
      
      if (response && response.health_status === "Everything's Chimpy!") {
        // Get current audience info
        const audienceId = getAudienceId();
        let currentAudience = null;
        let subscriberCount = 0;
        
        if (audienceId) {
          try {
            currentAudience = await mailchimp.lists.getList(audienceId);
            subscriberCount = currentAudience.stats.member_count;
            
            // Add breadcrumb for success
            Sentry.addBreadcrumb({
              category: 'api.status',
              message: 'Mailchimp status check successful',
              data: {
                audienceId,
                subscriberCount
              }
            });
          } catch (err) {
            console.warn(`Could not fetch audience with ID ${audienceId}:`, err.message);
            
            // Add breadcrumb for warning
            Sentry.addBreadcrumb({
              category: 'api.status',
              message: 'Mailchimp audience fetch warning',
              data: {
                audienceId,
                error: err.message
              }
            });
          }
        }
        
        return {
          connected: true,
          environment: process.env.NODE_ENV || 'development',
          currentAudience: currentAudience ? {
            memberCount: subscriberCount
          } : null
        };
      } else {
        // Add breadcrumb for failure
        Sentry.addBreadcrumb({
          category: 'api.status',
          message: 'Mailchimp status check failed',
          data: {
            healthStatus: response?.health_status
          }
        });
        
        return {
          connected: false,
          message: "Mailchimp API is not responding correctly"
        };
      }
    });
    
    res.json(mailchimpResult);
  } catch (error) {
    // Log error to Sentry
    Sentry.captureException(error, {
      context: 'Mailchimp status check',
      endpoint: '/api/status/mailchimp'
    });
    
    console.error('Mailchimp connection error:', error.message);
    res.json({
      connected: false,
      message: error.response?.data?.detail || error.message
    });
  }
});

// Check Monday.com connection status
router.get('/monday', async (req, res) => {
  try {
    // Add breadcrumb for request
    Sentry.addBreadcrumb({
      category: 'api.status',
      message: 'Monday.com status check request',
      data: {
        endpoint: '/api/status/monday'
      }
    });
    
    // Simple query to test the connection
    const query = `
      query {
        me {
          id
          name
        }
      }
    `;
    
    const mondayResult = await Sentry.startSpan({
      name: 'status_monday_check',
      op: 'api.status.monday',
      attributes: {
        endpoint: '/api/status/monday'
      }
    }, async () => {
      const result = await executeQuery(query);
      
      if (result.data && result.data.me) {
        // Add breadcrumb for success
        Sentry.addBreadcrumb({
          category: 'api.status',
          message: 'Monday.com status check successful',
          data: {
            userId: result.data.me.id,
            userName: result.data.me.name
          }
        });
        
        return {
          connected: true,
          user: result.data.me
        };
      } else {
        // Add breadcrumb for failure
        Sentry.addBreadcrumb({
          category: 'api.status',
          message: 'Monday.com status check failed',
          data: {
            result: result
          }
        });
        
        return {
          connected: false,
          message: 'Could not retrieve user information'
        };
      }
    });
    
    res.json(mondayResult);
  } catch (error) {
    // Log error to Sentry
    Sentry.captureException(error, {
      context: 'Monday.com status check',
      endpoint: '/api/status/monday'
    });
    
    console.error('Monday.com connection error:', error);
    res.json({
      connected: false,
      message: error.response?.data?.error_message || error.message
    });
  }
});

module.exports = router; 