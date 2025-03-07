const { executeQuery } = require('../utils/mondayClient');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('Testing Monday.com API connection...');
    console.log('API Key:', process.env.MONDAY_API_KEY ? 'Configured (first 5 chars: ' + process.env.MONDAY_API_KEY.substring(0, 5) + '...)' : 'Not configured');
    console.log('Board ID:', process.env.MONDAY_BOARD_ID || 'Not configured');
    
    // Simple query to test authentication
    const query = `query { me { id name } }`;
    const result = await executeQuery(query);
    
    console.log('\nConnection successful!');
    console.log('User:', result.data.me.name);
    console.log('User ID:', result.data.me.id);
    
    // Now try to get the board
    if (process.env.MONDAY_BOARD_ID) {
      console.log('\nTesting board access...');
      const boardQuery = `query { boards(ids: ${process.env.MONDAY_BOARD_ID}) { id name } }`;
      const boardResult = await executeQuery(boardQuery);
      
      if (boardResult.data.boards && boardResult.data.boards.length > 0) {
        console.log('Board access successful!');
        console.log('Board name:', boardResult.data.boards[0].name);
      } else {
        console.log('Board not found or no access to this board.');
      }
    }
  } catch (error) {
    console.error('\nConnection failed:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nResponse data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testConnection(); 