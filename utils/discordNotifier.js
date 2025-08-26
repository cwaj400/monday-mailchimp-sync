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

  console.log('About to send Discord notification');
  console.log('Sending Discord notification to:', webhookUrl);
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
    console.log('Fields:', embedFields);

    // Create the payload
    const payload = {
      embeds: [{
        title: title,
        description: message,
        color: parseInt(color, 16), // Convert hex to decimal
        fields: embedFields,
        timestamp: new Date().toISOString()
      }]
    };
    console.log('Payload:', payload);
    // Send the notification
    const response = await axios.post(webhookUrl, payload);
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
      response: error.response?.data
    });
    Sentry.captureException(error, {
      context: 'Failed to send Discord notification',
      title: title,
      message: message,
      fields: fields,
      color: color
    });
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