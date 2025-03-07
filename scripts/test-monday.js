// backend/scripts/test-monday.js
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { executeQuery } = require('../utils/mondayClient');
const { sendDiscordNotification } = require('../utils/discordNotifier');

async function testMondayConnection() {
  console.log('Testing Monday.com API connection...');
  
  try {
    // Simple query to get board information
    const query = `
      query {
        boards(ids: ${process.env.MONDAY_BOARD_ID}) {
          id
          name
          items_count
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (result.data && result.data.boards && result.data.boards.length > 0) {
      const board = result.data.boards[0];
      console.log('✅ Successfully connected to Monday.com API');
      console.log(`Board: ${board.name} (ID: ${board.id})`);
      console.log(`Total items: ${board.items_count}`);
      
      // Send success notification
      await sendDiscordNotification(
        '✅ Monday.com Connection Test',
        'Successfully connected to the Monday.com API.',
        {
          'Board Name': board.name,
          'Board ID': board.id,
          'Items Count': board.items_count
        },
        '57F287' // Green color
      );
    } else {
      console.error('❌ Failed to get board information');
      console.log('API Response:', JSON.stringify(result, null, 2));
      
      // Send failure notification
      await sendDiscordNotification(
        '❌ Monday.com Connection Test Failed',
        'Failed to retrieve board information from Monday.com API.',
        {
          'Response': JSON.stringify(result).substring(0, 1000)
        },
        'ED4245' // Red color
      );
    }
  } catch (error) {
    console.error('Error testing Monday.com connection:', error);
    
    // Send error notification
    await sendDiscordNotification(
      '❌ Monday.com Connection Test Error',
      'An error occurred while testing the Monday.com API connection.',
      {
        'Error': error.message,
        'Stack': error.stack?.substring(0, 300) + '...'
      },
      'ED4245' // Red color
    );
  }
}

// Run the test
testMondayConnection();