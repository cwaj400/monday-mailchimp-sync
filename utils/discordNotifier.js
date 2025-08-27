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
    
    // Send the notification with minimal retry logic (non-blocking)
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await axios.post(webhookUrl, payload, {
          timeout: 5000, // 5 second timeout (very short)
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
          maxAttempts: 2
        });
        
        if (attempt < 2) {
          // Wait before retry (very short delay)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    if (!response) {
      // Don't throw error, just log and return false
      logger.warn('Discord notification failed after all attempts, but continuing with main functionality');
      return false;
    }
    logger.info('Discord notification sent successfully', {
      response: response.data
    });
    return {
        success: true,
        response: response.data
    };
  } catch (error) {
    // Log error and capture in Sentry for monitoring
    logger.warn('Discord notification failed, but main functionality continues:', {
      error: error.message,
      code: error.code,
      webhookUrl: webhookUrl,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Capture Discord errors in Sentry for monitoring
    Sentry.captureException(error, {
      tags: {
        component: 'discord_notification',
        webhook_url: webhookUrl ? 'configured' : 'missing'
      },
      extra: {
        title,
        message,
        webhookUrl: webhookUrl,
        error_code: error.code,
        response_status: error.response?.status,
        response_data: error.response?.data
      }
    });
    
    return false;
  }
}

module.exports = {
  sendDiscordNotification
}; 