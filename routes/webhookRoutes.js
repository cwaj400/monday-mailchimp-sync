const express = require('express');
const router = express.Router();
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { handleSubscriberEvent } = require('./webhookHandlers/handleSubscriberEvent.js');
const { handleCampaignEvent } = require('./webhookHandlers/handleCampaignEvent.js');
const { handleEmailSend } = require('./webhookHandlers/handleEmailSend.js');
const { handleEmailOpen } = require('./webhookHandlers/handleEmailOpen.js');
const { handleEmailClick } = require('./webhookHandlers/handleEmailClick.js');

const dotenv = require('dotenv');
dotenv.config();

router.get('/', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Webhook endpoint is active and ready to receive webhook events'
    });
  });

router.post('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Webhook endpoint is active and ready to receive webhook events'
  });
});

router.get('/mailchimp', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Mailchimp webhook endpoint is active and ready to receive webhook events'
    });
  });

// Mailchimp webhook endpoint
router.post('/mailchimp', async (req, res) => {
  try {
    console.log('payload received.');

    console.log('Received Mailchimp webhook payload:', JSON.stringify(req.body, null, 2));

    if (req.body.type === 'test') {
      console.log('Received Mailchimp test webhook');
      return res.status(200).json({ success: true, message: 'Test webhook received successfully' });
    }
    
    // Log the webhook event
    const eventType = req.body.type;
    console.log('Received Mailchimp webhook event:', eventType);
    
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
      
      case 'is sent':
        return await handleEmailSend(req, res);
      
      case 'is opened':
        return await handleEmailOpen(req, res);
      
      case 'is clicked':
        return await handleEmailClick(req, res);
      
      default:
        console.log('Received Mailchimp webhook event:', eventType);
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

module.exports = router; 