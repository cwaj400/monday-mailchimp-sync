const { sendDiscordNotification } = require('../../utils/discordNotifier');
const dotenv = require('dotenv');
const logger = require('../../utils/logger');
dotenv.config();

// Error handler
exports.handleWebhookError = async function(error, req, res) {
    logger.error('Error processing Mailchimp webhook:', {
      error: error.message,
      eventType: req.body?.type || 'Unknown',
      stackTrace: error.stack?.substring(0, 300) + '...'
    });
    
    // Send Discord notification for errors
    await sendDiscordNotification(
      '🚨 Error Processing Mailchimp Webhook',
      'An error occurred while processing a Mailchimp webhook event.',
      {
        'Error': error.message,
        'Event Type': req.body?.type || 'Unknown',
        'Stack Trace': error.stack?.substring(0, 300) + '...'
      },
      'ED4245' // Red color for errors
    );
    
    return res.status(500).json({ error: 'Failed to process webhook', details: error.message });
  }