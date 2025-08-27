const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Sentry = require('@sentry/node');

const { sendDiscordNotification } = require('../utils/discordNotifier');
const { handleSubscriberEvent } = require('./webhookHandlers/handleSubscriberEvent.js');
const { handleCampaignEvent } = require('./webhookHandlers/handleCampaignEvent.js');
const { handleEmailSend } = require('./webhookHandlers/handleEmailSend.js');
const { handleEmailOpen } = require('./webhookHandlers/handleEmailOpen.js');
const { handleEmailClick } = require('./webhookHandlers/handleEmailClick.js');
const { processMondayWebhook } = require('../utils/mondayService');
const { logger } = require('../utils/logger');

// -- Simple health endpoints
router.get('/', (_req, res) => {
  res.status(200).json({ status: 'success', message: 'Webhook endpoint ready' });
});

router.post('/', (_req, res) => {
  res.status(200).json({ status: 'success', message: 'Webhook endpoint ready' });
});

router.get('/mailchimp', (_req, res) => {
  res.status(200).json({ status: 'success', message: 'Mailchimp webhook ready' });
});

// -----------------------------
// Mailchimp webhook
// -----------------------------
router.post('/mailchimp', async (req, res) => {
  try {
    // Likely verification call (some providers ping an empty JSON)
    if (!req.body || Object.keys(req.body).length === 0) {
      Sentry.addBreadcrumb({
        category: 'webhook.mailchimp',
        message: 'Verification/empty webhook body',
        level: 'info',
        data: { headers: Object.keys(req.headers) }
      });
      return res.status(200).json({ success: true, message: 'Verified' });
    }

    // Fire-and-forget acknowledgement ASAP
    res.status(200).json({ success: true, message: 'Webhook received, processing' });

    // Process in background with a parent span
    const span = Sentry.startInactiveSpan({
      name: 'mailchimp_webhook',
      op: 'webhook.receive',
      attributes: {
        type: req.body.type || 'unknown',
        hasMandrill: !!req.body.mandrill_events,
        bodyKeys: Object.keys(req.body)
      }
    });

    try {
      Sentry.addBreadcrumb({
        category: 'webhook.mailchimp',
        message: 'Webhook received',
        level: 'info',
        data: {
          type: req.body.type || 'unknown',
          hasMandrill: !!req.body.mandrill_events
        }
      });

      if (req.body.type === 'test') {
        Sentry.captureMessage('WEBHOOK TEST: Mailchimp endpoint called', 'info');
        Sentry.addBreadcrumb({
          category: 'webhook.mailchimp',
          message: 'Test webhook processed',
          level: 'info',
          data: { ts: new Date().toISOString() }
        });
        span.setStatus('ok');
        span.end();
        return;
      }

      Sentry.captureMessage('Processing Mailchimp webhiik', {
        extra: {
          type: req.body.type,
          mandrillEvent: req.body.mandrill_events,
        }
      });
      await processMailchimpWebhook(req, span);
      span.setStatus('ok');
      span.end();
    } catch (error) {
      span.setStatus('error');
      span.end();
      throw error;
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/webhooks/mailchimp', bodyKeys: Object.keys(req.body || {}) }
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', message: 'Mailchimp webhook failed' });
    }
  }
});

async function processMailchimpWebhook(req, span) {
  // Mandrill (transactional) events arrive as a JSON string in mandrill_events
  if (req.body.mandrill_events) {
    const mandrillSpan = Sentry.startInactiveSpan({
      name: 'process_mandrill_events', 
      op: 'webhook.mandrill'
    });

    try {
      
        Sentry.addBreadcrumb({
          category: 'webhook.mandrill',
          message: 'Processing Mandrill events',
          level: 'info'
        });

        await sendDiscordNotification(
          '📧 Mandrill Webhook Received',
          'Received Mandrill events',
          { 'Mandrill Events (truncated)': String(req.body.mandrill_events).slice(0, 500) + '…' },
          '0099FF'
        );

          mandrillSpan.setAttribute('custom_data', 'This is custom data');
          mandrillSpan.setAttribute('custom_tag', 'test_value');
          const parsedEvents = JSON.parse(req.body.mandrill_events);

        for (const event of parsedEvents) {
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
                case 'click':
                  await handleEmailClick(event, null);
                  break;
                default:
                  Sentry.addBreadcrumb({
                    category: 'webhook.mandrill',
                    message: 'Unhandled Mandrill event',
                    level: 'warning',
                    data: { event: event.event }
                  });
              }
            }
      
      mandrillSpan.setStatus('ok');
      mandrillSpan.end();
    } catch (error) {
      mandrillSpan.setStatus('error');
      mandrillSpan.end();
      throw error;
    }
    return;
  }

  // Regular Mailchimp campaign/lists webhooks
  if (req.body.type) {

        switch (req.body.type) {
          case 'subscribe':
            await handleSubscriberEvent(req.body, null, 'subscribe');
            break;
          case 'unsubscribe':
            await handleSubscriberEvent(req.body, null, 'unsubscribe');
            break;
          case 'campaign':
            await handleCampaignEvent(req.body, null);
            break;
          case 'send':
            await handleEmailSend(req.body, null);
            break;
          case 'open':
            await handleEmailOpen(req.body, null);
            break;
          case 'click':
            await handleEmailClick(req.body, null);
            break;
          default:
            break;
        }
    return;
  }

  // Unknown/empty body with fields but no type
  Sentry.addBreadcrumb({
    category: 'webhook.mailchimp',
    message: 'Webhook without type field',
    level: 'warning',
    data: { bodyKeys: Object.keys(req.body || {}) }
  });
  Sentry.captureMessage('Webhook received without type field', 'warning');
}

// -----------------------------
// Monday.com webhook
// -----------------------------
router.post('/monday', async (req, res) => {
  try {

    logger.info('Monday webhook received', {
      eventType: req.body.event?.type,
      pulseId: req.body.event?.pulseId,
      boardId: req.body.event?.boardId,
      route: '/api/webhooks/monday'
    });

    // Verification challenge
    if (req.body?.challenge) {
      logger.info('Monday webhook verification challenge', {
        challenge: req.body.challenge,
        route: '/api/webhooks/monday'
      });

      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Signature verification (when configured)
    logger.info('Checking signature verification', {
      hasSignature: !!req.headers['x-monday-signature'],
      hasSecret: !!process.env.MONDAY_WEBHOOK_SECRET,
      route: '/api/webhooks/monday'
    });
    
    const signature = req.headers['x-monday-signature'];
    if (signature && process.env.MONDAY_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', process.env.MONDAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('base64');

      if (signature !== expected) {
        logger.error('Invalid Monday.com webhook signature', {
          route: '/api/webhooks/monday'
        });

        Sentry.captureMessage('Invalid Monday.com webhook signature', 'error');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    // Acknowledge fast
    logger.info('Sending webhook acknowledgment', {
      route: '/api/webhooks/monday'
    });
    res.status(200).json({ success: true, message: 'Monday webhook received, processing' });

    // Process in background with a parent span
    logger.info('Creating parent span for processing', {
      eventType: req.body.event?.type,
      pulseId: req.body.event?.pulseId,
      route: '/api/webhooks/monday',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });
    const span = Sentry.startInactiveSpan({
      name: `monday_webhook_${req.body.event?.type || 'unknown'}_${req.body.event?.pulseId || 'no_id'}`,
      op: 'webhook.receive',
      attributes: {
        type: req.body.type || 'unknown',
        eventType: req.body.event?.type || 'unknown',
        itemId: req.body.itemId || req.body.event?.pulseId || 'unknown'
      }
    });

    try {
      logger.info('About to call processMondayWebhookSpanWrapped', {
        route: '/api/webhooks/monday'
      });

      await processMondayWebhookSpanWrapped(req.body, span);
      logger.info('processMondayWebhookSpanWrapped completed successfully', {
        route: '/api/webhooks/monday'
      });
      span.setStatus('ok');
      span.end();
    } catch (error) {
      logger.error('Error in processMondayWebhookSpanWrapped', {
        error: error.message,
        stack: error.stack,
        route: '/api/webhooks/monday'
      });
      span.setStatus('error');
      span.end();
      Sentry.captureException(error, {
        extra: { endpoint: '/api/webhooks/monday', bodyKeys: Object.keys(req.body || {}) },
        context: 'processMondayWebhookSpanWrapped'
      });
      throw error;
    }
      
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/webhooks/monday', bodyKeys: Object.keys(req.body || {}) }
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', message: 'Monday webhook failed' });
    }
  }
});

async function processMondayWebhookSpanWrapped(body, parentSpan) {

  logger.info('Starting processMondayWebhookSpanWrapped', {
    eventType: body.event?.type,
    pulseId: body.event?.pulseId,
    boardId: body.event?.boardId,
    route: '/api/webhooks/monday',
  });


  try {

    

    
    logger.info('Calling processMondayWebhook', {
      eventType: body.event?.type,
      pulseId: body.event?.pulseId,
      boardId: body.event?.boardId,
      event: JSON.stringify(body.event),
      route: '/api/webhooks/monday'
    });
    let result = null;

    await Sentry.startSpan(
      { name: 'processMondayWebhookSpanWrapped', op: 'webhook.monday' }, // parent
      async () => {
        result = await processMondayWebhook(body);
      });
    
    logger.info('processMondayWebhook completed', {
      success: result?.success,
      reason: result?.reason,
      email: result?.email,
      itemId: result?.itemId,
      route: '/api/webhooks/monday'
    });

    Sentry.captureMessage('processMondayWebhookSpanWrapped called and completed', 'info');
      

    if (result?.success) {
      logger.info('Sending Discord notification for successful enrollment', {
        email: result.email,
        itemId: result.itemId,
        enrollmentResult: result.enrollmentResult,
        route: '/api/webhooks/monday'
      });
      
      await sendDiscordNotification(
        '🎯 Monday.com Inquiry Processed',
        'Successfully processed new inquiry from Monday.com.',
        {
          'Email': result.email,
          'Monday Item ID': result.itemId,
          'Enrollment Status': result.enrollmentResult?.success ? 'Success' : 'Failed',
          'Processing Time': `${result.enrollmentResult?.processingTime || 0}ms`,
          'Timestamp': new Date().toISOString()
        },
        result.enrollmentResult?.success ? '57F287' : 'ED4245'
      );
    } else {
      await sendDiscordNotification(
        '⚠️ Monday.com Inquiry Skipped',
        'Monday.com webhook was received but processing was skipped.',
        {
          'Reason': result?.reason || 'Unknown',
          'Monday Item ID': body.itemId || 'Unknown',
          'Event Type': body.event?.type || 'Unknown',
          'Timestamp': new Date().toISOString()
        },
        'FFA500'
      );
    }
    
  try { await Sentry.flush(2000); } catch {}
  } catch (error) {
    Sentry.captureException(error, { extra: { phase: 'processMondayWebhook' } });

    await sendDiscordNotification(
      '❌ Monday.com Webhook Error',
      'An error occurred while processing a Monday.com webhook.',
      {
        'Error': error.message,
        'Timestamp': new Date().toISOString()
      },
      'ED4245'
    );
  }
}

module.exports = router; 