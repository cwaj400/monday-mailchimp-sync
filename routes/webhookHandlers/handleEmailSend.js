const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');
const Sentry = require('@sentry/node');
const { startSpanManual, addBreadcrumb, captureException } = require('../../utils/sentry');

dotenv.config();

exports.handleEmailSend = async function(event, res) {
    console.log('handleEmailSend');
    const subject = event.msg.subject || 'Unknown Campaign';
    const campaignId = event.msg.campaign_id || 'unknown';
    
    // Create a span for this operation
    const span = startSpanManual({
      name: 'handle_email_send',
      op: 'webhook.mandrill.send',
      attributes: {
        campaignId,
        subject,
        email: event.msg.email
      }
    });
    
    // Add tags for easier filtering in Sentry
    Sentry.setTag('campaignId', campaignId);
    Sentry.setTag('mandrill.event.type', 'send');
    
    // Add breadcrumb for this event
    addBreadcrumb('Processing email send event', 'webhook.mandrill', {
      campaignId,
      subject,
      email: event.msg.email
    });
  
    try {
      // Common validation
      if (!event.msg.email) {
        console.error('Email not provided in webhook data');
        if (span) span.end();
        return res.status(400).json({ 
          error: 'Email not provided in webhook data',
          campaignId
        });
      }
      
      // Find Monday item and process
      const result = await processEmailEvent(event.msg.email, 'send', {
        campaignTitle: subject,
        campaignId,
        noteText: `📧 Email Sent: "${subject}" was sent to ${event.msg.email}`
      });
      
      if (span) span.end();
      return res.json(result);
    } catch (error) {
      // Capture error with campaign context
      captureException(error, {
        context: 'Email send processing',
        campaignId,
        subject,
        email: event.msg.email
      });
      
      // Add error details to span
      if (span) {
        span.setAttribute('error', true);
        span.setAttribute('error.message', error.message);
        span.setAttribute('error.type', error.name);
        span.end();
      }
      
      console.error('Error processing email send event:', error);
      return res.status(500).json({ 
        error: 'Error processing email send event', 
        message: error.message,
        campaignId
      });
    }
  }