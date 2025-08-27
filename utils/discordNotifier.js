const dotenv = require('dotenv');
dotenv.config();
const Sentry = require('@sentry/node');
const axios = require('axios');
const { logger } = require('./logger');

/**
 * Validate Discord webhook URL format
 * @param {string} webhookUrl - The webhook URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
function isValidDiscordWebhook(webhookUrl) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return false;
  }
  
  // Check if it's a valid Discord webhook URL format
  const discordWebhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;
  return discordWebhookRegex.test(webhookUrl);
}

/**
 * Send a notification to Discord (non-blocking)
 * @param {string} title - The notification title
 * @param {string} message - The message text
 * @param {Object} [fields] - Optional fields to include
 * @param {string} [color] - Hex color for the embed (default: blue)
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
async function sendDiscordNotification(title, message, fields = {}, color = '3447003') {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  logger.info('sendDiscordNotification called', {
    title: title,
    message: message,
    fields: fields,
    color: color
  });

  if (!webhookUrl) {
    logger.error('Discord webhook URL not configured');
    Sentry.captureException(new Error('Discord webhook URL not configured'));
    return false;
  }

  // Validate webhook URL format
  if (!isValidDiscordWebhook(webhookUrl)) {
    logger.error('Invalid Discord webhook URL format', {
      webhookUrl: webhookUrl
    });
    Sentry.captureException(new Error('Invalid Discord webhook URL format'));
    return false;
  }

  logger.info('Sending Discord notification to:', {
    webhookUrl: webhookUrl
  });


  try {
    // Format fields as Discord embed fields
    const embedFields = Object.entries(fields).map(([name, value]) => ({
      name,
      value: String(value),
      inline: true
    }));
    logger.info('Fields:', embedFields);

    // Create the payload (simplified to avoid socket hang up)
    const payload = {
      content: `**${title}**\n${message}`,
      embeds: [{
        title: title,
        description: message,
        color: parseInt(color, 16), // Convert hex to decimal
        fields: embedFields.slice(0, 3), // Limit to 3 fields to reduce payload size
        timestamp: new Date().toISOString()
      }]
    };
    logger.info('Payload:', payload);
    
    // Send the notification with retry logic
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await axios.post(webhookUrl, payload, {
          timeout: 15000, // 15 second timeout (increased)
          headers: {
            'Content-Type': 'application/json'
          }
        });
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        logger.warn(`Discord notification attempt ${attempt} failed:`, {
          error: error.message,
          webhookUrl: webhookUrl,
          attempt: attempt,
          maxAttempts: 3
        });
        
        if (attempt < 3) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 2000)); // Increased delay
        }
      }
    }
    
    if (!response) {
      throw lastError; // All attempts failed
    }
    logger.info('Discord notification sent successfully', {
      response: response.data
    });
    return {
        success: true,
        response: response.data
    };
  } catch (error) {
    console.error('Error sending Discord notification:', error.message);
    
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      logger.error('Discord webhook timeout - possible causes:', {
        error: error.message,
        webhookUrl: webhookUrl,
        possibleCauses: [
          'Discord API is slow or overloaded',
          'Webhook URL is invalid or disabled',
          'Network connectivity issues',
          'Rate limiting by Discord'
        ]
      });
    } else if (error.response?.status === 404) {
      logger.error('Discord webhook not found (404):', {
        error: error.message,
        webhookUrl: webhookUrl,
        cause: 'Webhook URL is invalid or has been deleted'
      });
    } else if (error.response?.status === 429) {
      logger.error('Discord rate limit exceeded (429):', {
        error: error.message,
        webhookUrl: webhookUrl,
        cause: 'Too many requests to Discord webhook'
      });
    } else {
      logger.error('Error sending Discord notification:', {
        error: error.message,
        code: error.code,
        webhookUrl: webhookUrl,
        response: error.response?.data,
        status: error.response?.status,
        socketHangUp: error.code === 'ECONNRESET' || error.message.includes('socket hang up')
      });
    }
    
    // Don't capture Discord errors in Sentry (they're not critical)
    if (error.response) {
      console.error('Discord API response:', error.response.data);
      logger.error('Discord API response:', {
        response: error.response.data
      });
    }
    return false;
  }
}

module.exports = {
  sendDiscordNotification
}; 