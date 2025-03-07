const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { findMondayItemByEmail, addNoteToMondayItem } = require('../utils/mondayService');
const { sendDiscordNotification } = require('../utils/discordNotifier');

async function testAddMondayNote() {
  // Replace with an email that exists in your Monday.com board
  const testEmail = 'angelljamesw@gmail.com';
  const note = 'This is a test note';
  try {
    // Find the Monday.com item by email
    const mondayItem = await findMondayItemByEmail(testEmail);
    
    if (!mondayItem) {
      console.error(`❌ No Monday.com item found with email: ${testEmail}`);
      
      await sendDiscordNotification(
        '❌ Add Monday Note Failed',
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
    const result = await addNoteToMondayItem(mondayItem.id, note);
    
    if (result.success) {
      console.log('✅ Successfully added note');
      console.log(`Note: ${note}`);
      
      await sendDiscordNotification(
        '✅ Add Monday Note Successful',
        `Successfully added note for ${testEmail}`,
        {
          'Monday ID': mondayItem.id,
          'Note': note
        },
        '57F287' // Green color
      );
    } else {
      console.error('❌ Failed to add note:', result.error);
      
      await sendDiscordNotification(
        '❌ Add Monday Note Failed',
        `Failed to add note for ${testEmail}`,
        {
          'Monday ID': mondayItem.id,
          'Error': result.error
        },
        'ED4245' // Red color
      );
    }
  } catch (error) {
    console.error('Error testing add note to Monday:', error.message);
    
    await sendDiscordNotification(
      '❌ Add Monday Note Test Error',
      'An error occurred while testing add note to Monday.',
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
testAddMondayNote();
