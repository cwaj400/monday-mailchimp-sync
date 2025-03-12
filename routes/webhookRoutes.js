const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { handleSubscriberEvent } = require('./webhookHandlers/handleSubscriberEvent.js');
const { handleCampaignEvent } = require('./webhookHandlers/handleCampaignEvent.js');
const { handleEmailSend } = require('./webhookHandlers/handleEmailSend.js');
const { handleEmailOpen } = require('./webhookHandlers/handleEmailOpen.js');
const { handleEmailClick } = require('./webhookHandlers/handleEmailClick.js');

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
  
  // Check normalized headers first
  let mailchimpSignature = req.headers['x-mailchimp-signature'] || 
                          req.headers['X-Mailchimp-Signature'];
  
  let mandrillSignature = req.headers['x-mandrill-signature'] || 
                         req.headers['X-Mandrill-Signature'];
  
  // If not found in normalized headers, check raw headers
  if (!mailchimpSignature && req.rawHeaders) {
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (req.rawHeaders[i].toLowerCase() === 'x-mailchimp-signature') {
        mailchimpSignature = req.rawHeaders[i + 1];
        console.log('Found x-mailchimp-signature in raw headers');
      }
      if (req.rawHeaders[i].toLowerCase() === 'x-mandrill-signature') {
        mandrillSignature = req.rawHeaders[i + 1];
        console.log('Found x-mandrill-signature in raw headers');
      }
    }
  }
  
  // Log which signatures are present (without exposing values)
  console.log('Signature headers present:', {
    mailchimp: !!mailchimpSignature,
    mandrill: !!mandrillSignature
  });
  
  // If neither signature is present, log available headers and fail verification
  if (!mailchimpSignature && !mandrillSignature) {
    console.error('No signature headers found. Available header names:', Object.keys(req.headers));
    return false;
  }
  
  // If we have a Mailchimp signature, verify it using the standard method
  if (mailchimpSignature) {
    try {
      // Create HMAC hash of the request body
      const hmac = crypto.createHmac('sha256', MAILCHIMP_WEBHOOK_SECRET);
      hmac.update(JSON.stringify(req.body));
      const calculatedSignature = hmac.digest('hex');
      
      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(mailchimpSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying Mailchimp signature:', error.message);
      return false;
    }
  }
  
  // If we have a Mandrill signature, verify it using the Mandrill method
  if (mandrillSignature) {
    try {
      // Get the webhook URL from the request
      const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      
      // Generate signature using the Mandrill method
      let signedData = webhookUrl;
      const paramKeys = Object.keys(req.body).sort();
      
      paramKeys.forEach(function(key) {
        signedData += key + req.body[key];
      });
      
      const hmac = crypto.createHmac('sha1', MAILCHIMP_WEBHOOK_SECRET);
      hmac.update(signedData);
      const calculatedSignature = hmac.digest('base64');
      
      // Compare signatures
      return calculatedSignature === mandrillSignature;
    } catch (error) {
      console.error('Error verifying Mandrill signature:', error.message);
      return false;
    }
  }
  
  return false;
}


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
    console.log('Received Mailchimp webhook payload:', req.body);
    // Log the webhook event
    const eventType = req.body.event;
    const md = req.body.mandrill_events.event;

    console.log('Received Mailchimp webhook event:', eventType);
    console.log('Received Mailchimp webhook event:', md);
    
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