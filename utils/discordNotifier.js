const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Get the webhook URL from environment variables
const webhookUrl = process.env.NODE_ENV === 'test' ? process.env.DISCORD_WEBHOOK_URL_TEST : process.env.DISCORD_WEBHOOK_URL;
/**
 * Send a notification to Discord
 * @param {string} title - The notification title
 * @param {string} message - The message text
 * @param {Object} [fields] - Optional fields to include
 * @param {string} [color] - Hex color for the embed (default: blue)
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
async function sendDiscordNotification(title, message, fields = {}, color = '3447003') {

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

    // Send the notification
    const response = await axios.post(webhookUrl, payload);
    return {
        success: true,
        response: response.data
    };
  } catch (error) {
    console.error('Error sending Discord notification:', error.message);
    if (error.response) {
      console.error('Discord API response:', error.response.data);
    }
    return false;
  }
}

module.exports = {
  sendDiscordNotification
}; 