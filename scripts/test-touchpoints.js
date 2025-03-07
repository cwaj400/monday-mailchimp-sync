const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { findMondayItemByEmail, incrementTouchpoints } = require('../utils/mondayService');
const { sendDiscordNotification } = require('../utils/discordNotifier');

async function testTouchpointIncrement() {
  // Replace with an email that exists in your Monday.com board
  const testEmail = 'angelljamesw@gmail.com';
  
  try {
    // Find the Monday.com item by email
    const mondayItem = await findMondayItemByEmail(testEmail);
    
    if (!mondayItem) {
      console.error(`❌ No Monday.com item found with email: ${testEmail}`);
      
      await sendDiscordNotification(
        '❌ Touchpoint Test Failed',
        `No Monday.com item found with email: ${testEmail}`,
        {
          'Email': testEmail,
          'Time': new Date().toISOString()
        },
        'ED4245' // Red color
      );
      return;
    }
    
    console.log(`Found Monday.com item with ID: ${mondayItem.id}`);
    
    // Increment touchpoints
    const result = await incrementTouchpoints(mondayItem.id);
    
    if (result.success) {
      console.log('✅ Successfully incremented touchpoints');
      console.log(`Previous value: ${result.previousValue}`);
      console.log(`New value: ${result.newValue}`);
      
      await sendDiscordNotification(
        '✅ Touchpoint Test Successful',
        `Successfully incremented touchpoints for ${testEmail}`,
        {
          'Monday ID': mondayItem.id,
          'Previous Value': result.previousValue,
          'New Value': result.newValue
        },
        '57F287' // Green color
      );
    } else {
      console.error('❌ Failed to increment touchpoints:', result.error);
      
      await sendDiscordNotification(
        '❌ Touchpoint Test Failed',
        `Failed to increment touchpoints for ${testEmail}`,
        {
          'Monday ID': mondayItem.id,
          'Error': result.error
        },
        'ED4245' // Red color
      );
    }
  } catch (error) {
    console.error('Error testing touchpoint increment:', error.message);
    
    await sendDiscordNotification(
      '❌ Touchpoint Test Error',
      'An error occurred while testing touchpoint increment.',
      {
        'Email': testEmail,
        'Error': error.message,
        'Stack': error.stack?.substring(0, 300) + '...'
      },
      'ED4245' // Red color
    );
  }
}

// Run the test
testTouchpointIncrement();
