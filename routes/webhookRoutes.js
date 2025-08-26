const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { handleSubscriberEvent } = require('./webhookHandlers/handleSubscriberEvent.js');
const { handleCampaignEvent } = require('./webhookHandlers/handleCampaignEvent.js');
const { handleEmailSend } = require('./webhookHandlers/handleEmailSend.js');
const { handleEmailOpen } = require('./webhookHandlers/handleEmailOpen.js');
const { handleEmailClick } = require('./webhookHandlers/handleEmailClick.js');
const { captureException, addBreadcrumb, startSpanManual, Sentry } = require('../utils/sentry');
const { processMondayWebhook } = require('../utils/mondayService');

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
    
    // Force a test event to Sentry for debugging
    if (req.body.type === 'test') {
      console.log('🔍 Sending test event to Sentry for debugging...');
      
      // Send multiple types of events to test Sentry
      captureException(new Error('Test webhook event for Sentry debugging'), {
        context: 'Test webhook debugging',
        webhookType: 'test',
        timestamp: new Date().toISOString()
      });
      
      // Also send a message event
      Sentry.captureMessage('Test webhook message from Mailchimp endpoint', 'info');
      
      // Add breadcrumb
      addBreadcrumb('Test webhook processed', 'webhook.test', {
        endpoint: '/api/webhooks/mailchimp',
        timestamp: new Date().toISOString()
      });
    }
    
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
    }).finally(() => {
      // Ensure span is always ended, even if processWebhook doesn't handle it
      if (span) {
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
    
    // Send error response to prevent hanging requests
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: 'Webhook processing failed'
      });
    }
  }
});

// Monday.com webhook endpoint
router.post('/monday', async (req, res) => {
  let span = null;
  
  try {
    // Handle webhook verification challenge
    if (req.body.challenge) {
      console.log('🔐 Monday.com webhook verification challenge received');
      console.log('Challenge token:', req.body.challenge);
      
      // Return the challenge token as required by Monday.com
      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Verify webhook signature (only if not a verification challenge)
    const signature = req.headers['x-monday-signature'];
    if (signature && process.env.MONDAY_WEBHOOK_SECRET) {
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', process.env.MONDAY_WEBHOOK_SECRET)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.error('Invalid Monday.com webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    // Start a Sentry span for performance monitoring
    span = startSpanManual({
      name: 'monday_webhook',
      op: 'webhook.receive',
      forceTransaction: true
    });
    
    // Add breadcrumb for webhook received
    addBreadcrumb(
      'Monday.com webhook received',
      'webhook',
      {
        type: req.body.type || 'unknown',
        eventType: req.body.event?.type || 'unknown',
        itemId: req.body.itemId || 'unknown'
      }
    );
    
    // Immediately acknowledge receipt
    res.status(200).json({ success: true, message: 'Monday.com webhook received, processing in background' });

    // Process the webhook asynchronously
    processMondayWebhookAsync(req, res, span).catch(error => {
      console.error('Error in background Monday.com processing:', error);
      captureException(error, {
        context: 'Background Monday.com webhook processing',
        webhookType: req.body.type || 'unknown'
      });
      
      if (span) {
        span.setStatus({ code: Sentry.SpanStatusType.ERROR });
        span.end();
      }
    }).finally(() => {
      // Ensure span is always ended, even if processMondayWebhookAsync doesn't handle it
      if (span) {
        span.end();
      }
    });
  } catch (error) {
    console.error('Error in Monday.com webhook endpoint:', error);
    captureException(error, {
      context: 'Monday.com webhook endpoint',
      body: req.body
    });
    
    if (span) {
      span.setStatus({ code: Sentry.SpanStatusType.ERROR });
      span.end();
    }
    
    // Send error response to prevent hanging requests
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: 'Monday.com webhook processing failed'
      });
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

// Process Monday.com webhooks asynchronously
async function processMondayWebhookAsync(req, res, span) {
  try {
    const result = await processMondayWebhook(req.body);
    
    if (result.success) {
      console.log(`✅ Successfully processed Monday.com webhook for item ${result.itemId}`);
      
      // Send success notification
      await sendDiscordNotification(
        '🎯 Monday.com Inquiry Processed',
        `Successfully processed new inquiry from Monday.com.`,
        {
          'Email': result.email,
          'Monday Item ID': result.itemId,
          'Enrollment Status': result.enrollmentResult.success ? 'Success' : 'Failed',
          'Processing Time': `${result.enrollmentResult.processingTime || 0}ms`,
          'Timestamp': new Date().toISOString()
        },
        result.enrollmentResult.success ? '57F287' : 'ED4245'
      );
    } else {
      console.log(`⚠️ Monday.com webhook processing skipped: ${result.reason}`);
      
      // Send notification for skipped processing
      await sendDiscordNotification(
        '⚠️ Monday.com Inquiry Skipped',
        `Monday.com webhook was received but processing was skipped.`,
        {
          'Reason': result.reason,
          'Monday Item ID': req.body.itemId || 'Unknown',
          'Event Type': req.body.event?.type || 'Unknown',
          'Timestamp': new Date().toISOString()
        },
        'FFA500' // Orange color for warnings
      );
    }
    
    if (span) span.end();
  } catch (error) {
    console.error('Error processing Monday.com webhook:', error);
    captureException(error, {
      context: 'Monday.com webhook processing'
    });
    
    // Send error notification
    await sendDiscordNotification(
      '❌ Monday.com Webhook Error',
      `An error occurred while processing a Monday.com webhook.`,
      {
        'Error': error.message,
        'Monday Item ID': req.body.itemId || 'Unknown',
        'Event Type': req.body.event?.type || 'Unknown',
        'Timestamp': new Date().toISOString()
      },
      'ED4245' // Red color for errors
    );
    
    if (span) {
      span.setStatus({ code: Sentry.SpanStatusType.ERROR });
      span.end();
    }
  }
}

module.exports = router; 