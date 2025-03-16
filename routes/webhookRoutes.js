const express = require('express');
const router = express.Router();
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { handleSubscriberEvent } = require('./webhookHandlers/handleSubscriberEvent.js');
const { handleCampaignEvent } = require('./webhookHandlers/handleCampaignEvent.js');
const { handleEmailSend } = require('./webhookHandlers/handleEmailSend.js');
const { handleEmailOpen } = require('./webhookHandlers/handleEmailOpen.js');
const { handleEmailClick } = require('./webhookHandlers/handleEmailClick.js');
const { captureException, addBreadcrumb, startSpanManual, Sentry } = require('../utils/sentry');

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
  // Create a span for performance monitoring
  let span = null;
  
  try {
    // Start a Sentry span for performance monitoring (no callback in v9.x)
    span = startSpanManual({
      name: 'mailchimp_webhook',
      op: 'webhook.receive',
      forceTransaction: true
    });
    
    // Add breadcrumb for webhook received
    addBreadcrumb(
      'Mailchimp webhook received',
      'webhook',
      {
        type: req.body.type || 'unknown',
        hasMandrill: !!req.body.mandrill_events
      }
    );
    
    // Immediately acknowledge receipt to prevent timeout
    res.status(200).json({ success: true, message: 'Webhook received, processing in background' });

    // Process the webhook asynchronously
    processWebhook(req, res, span).catch(error => {
      console.error('Error in background processing:', error);
      captureException(error, {
        context: 'Background webhook processing',
        webhookType: req.body.type || 'unknown',
        hasMandrill: !!req.body.mandrill_events
      });
      
      // Make sure to end the span in case of error
      if (span) {
        span.setStatus({ code: Sentry.SpanStatusType.ERROR });
        span.end();
      }
    });
  } catch (error) {
    console.error('Error in webhook endpoint:', error);
    captureException(error, {
      context: 'Webhook endpoint',
      body: req.body
    });
    
    // Make sure to end the span in case of error
    if (span) {
      span.setStatus({ code: Sentry.SpanStatusType.ERROR });
      span.end();
    }
  }
});

// Separate function to process webhooks asynchronously
async function processWebhook(req, res, span) {
  try {
    if (req.body.type === 'test') {
      console.log('Received Mailchimp test webhook');
      addBreadcrumb('Test webhook received', 'webhook', { body: req.body });
      
      if (span) {
        span.end();
      }
      return;
    }

    // Handle Mandrill events (transactional emails)
    if (req.body.mandrill_events) {
      // Create a child span for Mandrill processing
      const mandrillSpan = span ? Sentry.startInactiveSpan({
        name: 'process_mandrill_events',
        op: 'webhook.mandrill',
      }) : null;
      
      addBreadcrumb('Processing Mandrill events', 'webhook', { 
        body: req.body.mandrill_events.substring(0, 200) + '...' 
      });
      
      sendDiscordNotification(
        '📧 Mandrill Webhook Received',
        `Received Mandrill events`,
        {
          'Mandrill Events': req.body.mandrill_events
        },
        '0099FF' // Blue color for Mandrill events
      );

      // Create a child span for JSON parsing
      const parseSpan = mandrillSpan ? Sentry.startInactiveSpan({
        name: 'parse_mandrill_json',
        op: 'json.parse',
      }) : null;
      
      const mandrillEvents = JSON.parse(req.body.mandrill_events);
      
      if (parseSpan) {
        parseSpan.end();
      }

      console.log(`Processing ${mandrillEvents.length} Mandrill events`);
    
      for (const event of mandrillEvents) {
        console.log('Processing Mandrill event:', event.event);
        addBreadcrumb(`Processing Mandrill ${event.event}`, 'webhook.mandrill', { 
          eventType: event.event,
          email: event.msg?.email
        });
        
        // Create a child span for each event type
        const eventSpan = mandrillSpan ? Sentry.startInactiveSpan({
          name: `process_mandrill_${event.event}`,
          op: `webhook.mandrill.${event.event}`,
          attributes: {
            email: event.msg?.email,
            eventType: event.event
          }
        }) : null;
        
        try {
          switch (event.event) {
            case 'subscribe':
              await handleSubscriberEvent(event, null, 'subscribe');
              break;
            
            case 'campaign':
              await handleCampaignEvent(event, null);
              break;
            
            case 'send':
              await handleEmailSend(event, null);
              break;
            
            case 'open':
              await handleEmailOpen(event, null);
              break;
            
            default:
              console.log('Unhandled Mandrill event type:', event.event);
              addBreadcrumb('Unhandled Mandrill event', 'webhook.mandrill', { 
                eventType: event.event 
              }, 'warning');
          }
        } finally {
          if (eventSpan) {
            eventSpan.end();
          }
        }
      }
      
      if (mandrillSpan) {
        mandrillSpan.end();
      }
    } 
    // Handle regular Mailchimp campaign webhooks
    else if (req.body.type) {
      // Create a child span for Mailchimp processing
      const mailchimpSpan = span ? Sentry.startInactiveSpan({
        name: `process_mailchimp_${req.body.type}`,
        op: `webhook.mailchimp.${req.body.type}`,
        attributes: {
          type: req.body.type,
          data: req.body.data
        }
      }) : null;
      
      console.log('Processing Mailchimp campaign webhook:', req.body.type);
      addBreadcrumb('Processing Mailchimp webhook', 'webhook.mailchimp', { 
        type: req.body.type,
        data: req.body.data
      });
      
      try {
        switch (req.body.type) {
          case 'subscribe':
            await handleSubscriberEvent(req.body, null, 'subscribe');
            break;
          
          case 'unsubscribe':
            await handleSubscriberEvent(req.body, null, 'unsubscribe');
            break;
          
          case 'campaign':
            console.log('campaign', req);
            await handleCampaignEvent(req.body, null);
            break;
          
          case 'send':
            await handleEmailSend(req.body, null);
            break;
          
          case 'open':
            await handleEmailOpen(req.body, null);
            break;
          
          default:
            console.log('Unhandled Mailchimp webhook type:', req.body.type);
            addBreadcrumb('Unhandled Mailchimp webhook type', 'webhook.mailchimp', { 
              type: req.body.type 
            }, 'warning');
        }
      } finally {
        if (mailchimpSpan) {
          mailchimpSpan.end();
        }
      }
    } else {
      console.log('No Type Given in webhook:', req.body);
      addBreadcrumb('No Type Given in webhook', 'webhook', { 
        body: JSON.stringify(req.body).substring(0, 200) + '...' 
      }, 'warning');
    }
    
    // Finish the span
    if (span) {
      span.end();
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Capture the exception with context
    captureException(error, {
      context: 'Webhook processing',
      webhookType: req.body?.type || 'unknown',
      hasMandrill: !!req.body?.mandrill_events
    });
    
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
    
    // Finish the span with error status
    if (span) {
      span.setStatus({ code: Sentry.SpanStatusType.ERROR });
      span.end();
    }
  }
}

module.exports = router; 