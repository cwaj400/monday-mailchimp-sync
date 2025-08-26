// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

// Import the Discord notifier
const { sendDiscordNotification } = require('../utils/discordNotifier');

async function testDiscordWebhook() {
  console.log('🧪 Testing Discord webhook...\n');

  // Test 1: Simple notification
  console.log('📋 Test 1: Simple notification');
  const result1 = await sendDiscordNotification(
    '🧪 Discord Webhook Test',
    'This is a test notification from your Monday.com to Mailchimp sync system.',
    {
      'Test Type': 'Simple Notification',
      'Status': 'Testing',
      'Timestamp': new Date().toISOString()
    }
  );
  console.log('Result:', result1 ? '✅ Success' : '❌ Failed');
  console.log('');

  // Test 2: Enrollment notification (like the real system)
  console.log('📋 Test 2: Enrollment notification');
  const result2 = await sendDiscordNotification(
    '🎯 New Customer Enrolled in Mailchimp',
    'A new customer inquiry has been automatically enrolled in your Mailchimp audience.',
    {
      'Email': 'angelljamesw@gmail.com',
      'Monday Item ID': 'test-123',
      'Monday Item Name': 'Test Inquiry',
      'Subscriber Status': 'subscribed',
      'Subscriber ID': 'e378d31ba5e052db6b92989afb2b2db2',
      'Processing Time': '1500ms',
      'Attempts': '1',
      'Timestamp': new Date().toISOString()
    },
    '57F287' // Green color
  );
  console.log('Result:', result2 ? '✅ Success' : '❌ Failed');
  console.log('');

  // Test 3: Error notification
  console.log('📋 Test 3: Error notification');
  const result3 = await sendDiscordNotification(
    '❌ Mailchimp Enrollment Failed',
    'Failed to enroll test@example.com in Mailchimp campaign.',
    {
      'Email': 'test@example.com',
      'Monday Item ID': 'test-456',
      'Error': 'Invalid email format',
      'Processing Time': '1ms',
      'Timestamp': new Date().toISOString()
    },
    'ED4245' // Red color
  );
  console.log('Result:', result3 ? '✅ Success' : '❌ Failed');
  console.log('');

  // Check environment variable
  console.log('🔧 Environment Check:');
  console.log('DISCORD_WEBHOOK_URL:', process.env.DISCORD_WEBHOOK_URL ? '✅ Set' : '❌ Not set');
  if (process.env.DISCORD_WEBHOOK_URL) {
    console.log('URL starts with:', process.env.DISCORD_WEBHOOK_URL.substring(0, 50) + '...');
  }
  console.log('');

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Test 1 (Simple): ${result1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 2 (Enrollment): ${result2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 3 (Error): ${result3 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (result1 && result2 && result3) {
    console.log('\n🎉 All Discord tests passed!');
  } else {
    console.log('\n⚠️  Some Discord tests failed. Check your webhook URL.');
  }
}

// Run the test
testDiscordWebhook().catch(console.error); 