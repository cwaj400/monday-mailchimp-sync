// backend/scripts/test-mailchimp.js
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { getMailchimpClient } = require('../utils/mailchimpClient');
const { sendDiscordNotification } = require('../utils/discordNotifier');

async function testMailchimpConnection() {
  console.log('Testing Mailchimp API connection...');
  
  try {
    // Get Mailchimp client
    const mailchimp = getMailchimpClient();
    
    // Get information about the account
    const accountInfo = await mailchimp.ping.get();
    
    
    if (accountInfo && accountInfo.health_status === 'Everything\'s Chimpy!') {
      console.log('✅ Successfully connected to Mailchimp API');
      debugger;
      console.log(`Account: ${JSON.stringify(accountInfo, null, 2)}`);
      
      // Get list information
      const listInfo = await mailchimp.lists.getList(process.env.MAILCHIMP_AUDIENCE_ID);
      console.log(`List: ${listInfo.name} (${listInfo.stats.member_count} members)`);
      
      // Send success notification
      await sendDiscordNotification(
        '✅ Mailchimp Connection Test',
        'Successfully connected to the Mailchimp API.',
        {
          'List Name': listInfo.name,
          'Member Count': listInfo.stats.member_count
        },
        '57F287' // Green color
      );
    } else {
      console.error('❌ Mailchimp API returned unexpected response');
      console.log('API Response:', JSON.stringify(accountInfo, null, 2));
      
      // Send failure notification
      await sendDiscordNotification(
        '⚠️ Mailchimp Connection Test Warning',
        'Connected to Mailchimp API but received unexpected response.',
        {
          'Response': JSON.stringify(accountInfo).substring(0, 1000)
        },
        'FFA500' // Orange color
      );
    }
  } catch (error) {
    console.error('Error testing Mailchimp connection:', error);
    
    // Send error notification
    await sendDiscordNotification(
      '❌ Mailchimp Connection Test Error',
      'An error occurred while testing the Mailchimp API connection.',
      {
        'Error': error.message,
        'Stack': error.stack?.substring(0, 300) + '...'
      },
      'ED4245' // Red color
    );
  }
}

// Run the test
testMailchimpConnection();