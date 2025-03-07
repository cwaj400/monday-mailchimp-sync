// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

// Import the Discord notifier
const { sendDiscordNotification } = require('../utils/discordNotifier');

// Test the Discord notification
async function runTest() {
  console.log('Testing Discord notification...');
  console.log('Webhook URL:', process.env.NODE_ENV.slice(0, 5) + '...');
  
  try {
    // Send a test notification
    const result = await sendDiscordNotification(
      '🧪 Test Notification',
      'This is a test notification from your Monday-Mailchimp integration.',
      {
        'Test Time': new Date().toISOString(),
        'Environment': process.env.NODE_ENV || 'development',
        'Webhook URL': process.env.DISCORD_WEBHOOK_URL ? 'Configured ✅' : 'Not configured ❌'
      },
      '5865F2' // Discord Blurple color
    );
    
    if (result) {
      console.log('✅ Discord notification sent successfully!');
    } else {
      console.error('❌ Failed to send Discord notification');
    }
  } catch (error) {
    console.error('Error testing Discord notification:', error);
  }
}

// Run the test
runTest(); 