const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios'); // Make sure to install axios if not already done
const { executeQuery } = require('../utils/mondayClient');
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { 
  findMondayItemByEmail, 
  incrementTouchpoints,
  addNoteToMondayItem, // Import the existing function
  MONDAY_BOARD_ID,
  TOUCHPOINTS_COLUMN_ID 
} = require('../utils/mondayService');
const { handleSubscriberEvent } = require('./webhookHandlers.js/handleSubscriberEvent');
const { handleCampaignEvent } = require('./webhookHandlers.js/handleCampaignEvent');
const { handleEmailSend } = require('./webhookHandlers.js/handleEmailSend');
const { handleEmailOpen } = require('./webhookHandlers.js/handleEmailOpen');
const { handleEmailClick } = require('./webhookHandlers.js/handleEmailClick');
const { handleWebhookError } = require('./webhookHandlers.js/handleWebhookError');

const dotenv = require('dotenv');
dotenv.config();

// Get environment variables
const MAILCHIMP_WEBHOOK_SECRET = process.env.MAILCHIMP_WEBHOOK_SECRET;
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = MAILCHIMP_API_KEY ? MAILCHIMP_API_KEY.split('-')[1] : null;

// Verify Mailchimp webhook signature
function verifyMailchimpSignature(req) {
  if (!MAILCHIMP_WEBHOOK_SECRET) {
    console.warn('MAILCHIMP_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }
  
  const signature = req.headers['x-mailchimp-signature'];
  if (!signature) {
    console.error('No Mailchimp signature provided');
    return false;
  }
  
  // Create HMAC hash of the request body
  const hmac = crypto.createHmac('sha256', MAILCHIMP_WEBHOOK_SECRET);
  hmac.update(JSON.stringify(req.body));
  const calculatedSignature = hmac.digest('hex');
  
  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

router.get('/mailchimp', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Mailchimp webhook endpoint is active and ready to receive webhook events'
    });
  });

// Mailchimp webhook endpoint
router.post('/mailchimp', async (req, res) => {
  try {
    //Verify webhook signature
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log('Development environment, skipping signature verification');
    } else {
      if (!verifyMailchimpSignature(req)) {
        console.error('Invalid Mailchimp webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Log the webhook event
    const eventType = req.body.type;
    
    // Handle different event types
    switch (eventType) {
      case 'subscribe':
        return await handleSubscriberEvent(req, res, 'subscribe');
      
      case 'unsubscribe':
        return await handleSubscriberEvent(req, res, 'unsubscribe');
      
      case 'profile':
        return await handleSubscriberEvent(req, res, 'profile');
      
      case 'cleaned':
        return await handleSubscriberEvent(req, res, 'cleaned');
      
      case 'campaign':
        return await handleCampaignEvent(req, res);
      
      case 'send':
        return await handleEmailSend(req, res);
      
      case 'open':
        return await handleEmailOpen(req, res);
      
      case 'click':
        return await handleEmailClick(req, res);
      
      default:
        // For other event types, just acknowledge receipt
        return res.json({ success: true, message: 'Webhook received', event: eventType });
    }
  } catch (error) {
    await sendDiscordNotification(
      '❌ Mailchimp Webhook Error',
      `An error occurred while processing a Mailchimp webhook event.`,
      {
        'Error': error.message,
        'Webhook Payload': JSON.stringify(req.body, null, 2),
        'Event Type': req.body?.type || 'Unknown',
        'Stack Trace': error.stack?.substring(0, 300) + '...'
      },
      'ED4245' // Red color for errors
    );
    
    return res.status(500).json({
      error: 'Failed to process webhook',
      details: error.message
    });
  }
});





// Add this route to manually process a campaign
router.get('/process-campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }
    
    // Create a mock request object with the campaign data
    const mockReq = {
      body: {
        type: 'campaign',
        data: {
          id: campaignId,
          status: 'sent'
        }
      }
    };
    
    // Call the campaign handler
    return await handleCampaignEvent(mockReq, res);
  } catch (error) {
    console.error('Error processing campaign:', error.message);
    return res.status(500).json({
      error: 'Failed to process campaign',
      details: error.message
    });
  }
});

module.exports = router; 