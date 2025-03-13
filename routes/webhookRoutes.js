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

    if (req.body.type === 'test') {
      console.log('Received Mailchimp test webhook');
      return res.status(200).json({ success: true, message: 'Test webhook received successfully' });
    }

    if (req.body.mandrill_events) {
      const mandrillEvents = JSON.parse(req.body.mandrill_events);
      console.log(`processing ${mandrillEvents.length} mandrill events`);
    
      // Log the webhook event
    // Handle different event types
    for (const event of mandrillEvents) {
      console.log('Received Mailchimp webhook event:', event.event);
      switch (event.event) {
        case 'subscribe':
          return await handleSubscriberEvent(event, res, 'subscribe');
        
        case 'campaign':
          return await handleCampaignEvent(event, res);
        
        case 'send':
          return await handleEmailSend(event, res);
        
        case 'open':
          return await handleEmailOpen(event, res);
        
        default:
          console.log('Received Mailchimp webhook event:', event.event);
          // For other event types, just acknowledge receipt
          return res.json({ success: true, message: 'Webhook received', event: event.event });
        }
      }
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