const axios = require('axios');
const dotenv = require('dotenv');
const { logger } = require('./logger');
const Sentry = require('@sentry/node');
dotenv.config();

// Get the webhook URL from environment variables
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
/**
 * Send a notification to Discord
 * @param {string} title - The notification title
 * @param {string} message - The message text
 * @param {Object} [fields] - Optional fields to include
 * @param {string} [color] - Hex color for the embed (default: blue)
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
async function sendDiscordNotification(title, message, fields = {}, color = '3447003') {
  logger.info('sendDiscordNotification called', {
    title: title,
    message: message,
    fields: fields,
    color: color
  });

  logger.info('Sending Discord notification to:', {
    webhookUrl: webhookUrl
  });
  if (!webhookUrl) {
    return false;
  }

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
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        });
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        logger.warn(`Discord notification attempt ${attempt} failed:`, {
          error: error.message,
          attempt: attempt,
          maxAttempts: 3
        });
        
        if (attempt < 3) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
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
    logger.error('Error sending Discord notification:', {
      error: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      socketHangUp: error.code === 'ECONNRESET' || error.message.includes('socket hang up')
    });
    
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