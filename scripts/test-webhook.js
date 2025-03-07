// Create a test script in your project
// test-webhook.js
const axios = require('axios');
const { sendDiscordNotification } = require('../utils/discordNotifier');

// Sample Mailchimp webhook payload for a "send" event
const testPayload = {
  type: "send",
  fired_at: "2023-04-05T15:30:00Z",
  data: {
    id: "test-campaign-id",
    list_id: "test-list-id",
    email: "angelljamesw@gmail.com", // Use an email that exists in your Monday.com board
    campaign_id: "test-campaign"
  }
};

// Send the test payload to your webhook endpoint
async function testWebhook() {
  try {
    // Notify Discord that we're starting the test
    await sendDiscordNotification(
      '🧪 Starting Webhook Test',
      'Sending a test Mailchimp webhook payload to your endpoint.',
      {
        'Event Type': testPayload.type,
        'Email': testPayload.data.email,
        'Test Time': new Date().toISOString()
      },
      '5865F2' // Discord Blurple color
    );
    
    console.log('Sending test webhook to your endpoint...');
    
    // Replace with your actual webhook URL
    const response = await axios.post('https://40ad-185-214-220-197.ngrok-free.app/api/webhooks/mailchimp', testPayload);
    
    console.log('Test webhook response:', response.data);
    
    // Notify Discord of the test result
    if (response.data.success) {
      await sendDiscordNotification(
        '✅ Webhook Test Successful',
        'The test webhook was processed successfully.',
        {
          'Email': testPayload.data.email,
          'Monday ID': response.data.itemId,
          'Previous Value': response.data.previousValue,
          'New Value': response.data.newValue,
          'Response Time': `${response.status} ${response.statusText}`
        },
        '57F287' // Green color for success
      );
    } else {
      await sendDiscordNotification(
        '⚠️ Webhook Test Completed with Issues',
        'The webhook endpoint responded, but indicated an issue.',
        {
          'Email': testPayload.data.email,
          'Message': response.data.message,
          'Response Code': `${response.status} ${response.statusText}`
        },
        'FFA500' // Orange color for warnings
      );
    }
  } catch (error) {
    console.error('Error testing webhook:', error.response?.data || error.message);
    
    // Notify Discord of the error
    await sendDiscordNotification(
      '❌ Webhook Test Failed',
      'An error occurred while testing the webhook.',
      {
        'Error': error.message,
        'Response Data': error.response?.data ? JSON.stringify(error.response.data).substring(0, 1000) : 'No response data',
        'Email Used': testPayload.data.email
      },
      'ED4245' // Red color for errors
    );
  }
}

testWebhook();