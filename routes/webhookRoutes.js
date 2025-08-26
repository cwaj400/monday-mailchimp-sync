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
    await Sentry.startSpan(
      {
        name: 'mailchimp_webhook',
        op: 'webhook.receive',
        attributes: {
          type: req.body.type || 'unknown',
          hasMandrill: !!req.body.mandrill_events,
          bodyKeys: Object.keys(req.body)
        }
      },
      async () => {
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
          return;
        }

        await processMailchimpWebhook(req);
      }
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/webhooks/mailchimp', bodyKeys: Object.keys(req.body || {}) }
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', message: 'Mailchimp webhook failed' });
    }
  }
});

async function processMailchimpWebhook(req) {
  // Mandrill (transactional) events arrive as a JSON string in mandrill_events
  if (req.body.mandrill_events) {
    await Sentry.startSpan(
      { name: 'process_mandrill_events', op: 'webhook.mandrill' },
      async () => {
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

        const events = await Sentry.startSpan(
          { name: 'parse_mandrill_json', op: 'json.parse' },
          async () => JSON.parse(req.body.mandrill_events)
        );

        for (const event of events) {
          await Sentry.startSpan(
            {
              name: `mandrill_${event.event}`,
              op: `webhook.mandrill.${event.event}`,
              attributes: { email: event.msg?.email || null }
            },
            async () => {
              Sentry.addBreadcrumb({
                category: 'webhook.mandrill',
                message: `Processing ${event.event}`,
                level: 'info',
                data: { email: event.msg?.email }
              });

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
          );
        }
      }
    );
    return;
  }

  // Regular Mailchimp campaign/lists webhooks
  if (req.body.type) {
    await Sentry.startSpan(
      {
        name: `mailchimp_${req.body.type}`,
        op: `webhook.mailchimp.${req.body.type}`,
        attributes: { type: req.body.type }
      },
      async () => {
        Sentry.addBreadcrumb({
          category: 'webhook.mailchimp',
          message: 'Processing Mailchimp webhook',
          level: 'info',
          data: { type: req.body.type }
        });

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
            Sentry.addBreadcrumb({
              category: 'webhook.mailchimp',
              message: 'Unhandled Mailchimp type',
              level: 'warning',
              data: { type: req.body.type }
            });
        }
      }
    );
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
    // Verification challenge
    if (req.body?.challenge) {
      Sentry.addBreadcrumb({
        category: 'webhook.monday',
        message: 'Verification challenge',
        level: 'info',
        data: { challenge: req.body.challenge }
      });
      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Signature verification (when configured)
    const signature = req.headers['x-monday-signature'];
    if (signature && process.env.MONDAY_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', process.env.MONDAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('base64');

      if (signature !== expected) {
        Sentry.captureMessage('Invalid Monday.com webhook signature', 'error');
        return res.status(403).json({ error: 'Invalid signature' });
      }

      Sentry.addBreadcrumb({
        category: 'webhook.monday',
        message: 'Signature verified',
        level: 'info'
      });
    } else {
      Sentry.addBreadcrumb({
        category: 'webhook.monday',
        message: 'Skipping signature verification',
        level: 'warning',
        data: { hasSignature: !!signature, hasSecret: !!process.env.MONDAY_WEBHOOK_SECRET }
      });
    }

    // Acknowledge fast
    res.status(200).json({ success: true, message: 'Monday webhook received, processing' });

    // Process in background with a parent span
    await Sentry.startSpan(
      {
        name: `monday_webhook_${req.body.event?.type || 'unknown'}_${req.body.event?.pulseId || 'no_id'}`,
        op: 'webhook.receive',
        attributes: {
          type: req.body.type || 'unknown',
          eventType: req.body.event?.type || 'unknown',
          itemId: req.body.itemId || req.body.event?.pulseId || 'unknown'
        }
      },
      async () => {
        Sentry.addBreadcrumb({
          category: 'webhook.monday',
          message: 'Webhook received',
          level: 'info',
          data: {
            eventType: req.body.event?.type || 'unknown',
            itemId: req.body.itemId || req.body.event?.pulseId || 'unknown'
          }
        });

        await processMondayWebhookSpanWrapped(req.body);
      }
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: { endpoint: '/api/webhooks/monday', bodyKeys: Object.keys(req.body || {}) }
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', message: 'Monday webhook failed' });
    }
  }
});

async function processMondayWebhookSpanWrapped(body) {
  Sentry.addBreadcrumb({
    category: 'webhook.monday',
    message: 'Starting processMondayWebhook',
    level: 'info',
    data: { bodyPreview: JSON.stringify(body).slice(0, 500) + '…' }
  });

  try {
    const result = await Sentry.startSpan(
      { name: 'processMondayWebhook', op: 'service.monday' },
      async () => processMondayWebhook(body)
    );

    Sentry.addBreadcrumb({
      category: 'webhook.monday',
      message: 'processMondayWebhook completed',
      level: 'info',
      data: { resultSummary: { success: !!result?.success, itemId: result?.itemId, email: result?.email } }
    });

    if (result?.success) {
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
  } catch (error) {
    Sentry.addBreadcrumb({
      category: 'webhook.monday',
      message: 'Error in processMondayWebhook',
      level: 'error',
      data: { error: error.message }
    });

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