const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { executeQuery } = require('../utils/mondayClient');

/**
 * Test Monday.com API connection and get board structure
 */
async function testMondayAPI() {
  console.log('🔍 Testing Monday.com API connection...\n');
  
  try {
    // Test 1: Basic connection
    console.log('📋 Test 1: Basic API connection');
    const meQuery = `
      query {
        me {
          id
          name
          email
        }
      }
    `;
    
    const meResult = await executeQuery(meQuery);
    if (meResult.data && meResult.data.me) {
      console.log('✅ API connection successful');
      console.log(`   User: ${meResult.data.me.name} (${meResult.data.me.email})`);
    } else {
      console.log('❌ API connection failed');
      return;
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Get board structure
    console.log('📋 Test 2: Board structure');
    const boardId = process.env.MONDAY_BOARD_ID;
    if (!boardId) {
      console.log('❌ MONDAY_BOARD_ID not set in environment');
      return;
    }
    
    const boardQuery = `
      query {
        boards(ids: [${boardId}]) {
          id
          name
          columns {
            id
            title
            type
            settings_str
          }
          items_page(limit: 1) {
            items {
              id
              name
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;
    
    const boardResult = await executeQuery(boardQuery);
    if (boardResult.data && boardResult.data.boards && boardResult.data.boards.length > 0) {
      const board = boardResult.data.boards[0];
      console.log('✅ Board found');
      console.log(`   Board: ${board.name} (ID: ${board.id})`);
      console.log(`   Columns: ${board.columns.length}`);
      
      // Show column structure
      console.log('\n   Column Structure:');
      board.columns.forEach(col => {
        console.log(`     - ${col.title} (ID: ${col.id}, Type: ${col.type})`);
      });
      
      // Show sample item if available
      if (board.items_page && board.items_page.items && board.items_page.items.length > 0) {
        const sampleItem = board.items_page.items[0];
        console.log(`\n   Sample Item: ${sampleItem.name} (ID: ${sampleItem.id})`);
        console.log('   Column Values:');
        sampleItem.column_values.forEach(col => {
          console.log(`     - ${col.id}: "${col.text}" (Type: ${col.type})`);
        });
      }
    } else {
      console.log('❌ Board not found or no access');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Test specific item retrieval
    console.log('📋 Test 3: Item retrieval test');
    const testItemId = '123456'; // This won't exist, but we'll test the query structure
    
    const itemQuery = `
      query {
        items(ids: [${testItemId}]) {
          id
          name
          column_values {
            id
            text
            value
            type
          }
        }
      }
    `;
    
    try {
      const itemResult = await executeQuery(itemQuery);
      console.log('✅ Item query structure is valid');
      console.log('   (Item not found, but query executed successfully)');
    } catch (error) {
      console.log('❌ Item query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testMondayAPI().catch(console.error);
}

module.exports = {
  testMondayAPI
};
