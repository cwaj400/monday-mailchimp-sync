const { executeQuery } = require('../utils/mondayClient');

// Board IDs to check
const BOARD_IDS = [
  '6432503726', // Your current board
  '6432503733'  // The board from the webhook URL you found
];

async function checkAllBoards() {
  console.log('🔍 Checking webhooks across all boards...\n');

  for (const boardId of BOARD_IDS) {
    console.log(`📋 Checking board ${boardId}...`);
    
    try {
      // Get board info
      const boardResult = await executeQuery(`
        query {
          boards(ids: [${boardId}]) {
            id
            name
            permissions
            owner {
              id
              name
            }
          }
        }
      `);

      if (boardResult.data && boardResult.data.boards && boardResult.data.boards.length > 0) {
        const board = boardResult.data.boards[0];
        console.log(`   Board: ${board.name} (ID: ${board.id})`);
        console.log(`   Permissions: ${board.permissions}`);
        console.log(`   Owner: ${board.owner.name}`);
        
        // Get webhooks for this board
        const webhookResult = await executeQuery(`
          query {
            webhooks(board_id: ${boardId}) {
              id
              event
              board_id
              config
            }
          }
        `);

        if (webhookResult.data && webhookResult.data.webhooks) {
          console.log(`   Webhooks: ${webhookResult.data.webhooks.length}`);
          webhookResult.data.webhooks.forEach(webhook => {
            console.log(`     - ID: ${webhook.id}, Event: ${webhook.event}`);
            if (webhook.config) {
              console.log(`       Config: ${webhook.config}`);
            }
          });
        } else {
          console.log('   Webhooks: 0');
        }
      } else {
        console.log(`   ❌ Board ${boardId} not found or no access`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Error checking board ${boardId}: ${error.message}`);
      console.log('');
    }
  }

  console.log('💡 Analysis:');
  console.log('   - The webhook URL you found is for board 6432503733');
  console.log('   - It\'s a "change_specific_column_value" event');
  console.log('   - This is different from the "create_item" event we need for enrollment');
  console.log('');
  
  console.log('🔧 Next Steps:');
  console.log('   1. Determine which board you want to use for enrollment');
  console.log('   2. Create a "create_item" webhook on that board');
  console.log('   3. Point it to your ngrok URL: https://2b9f9c5df213.ngrok-free.app/api/webhooks/monday');
}

// Main execution
async function main() {
  await checkAllBoards();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkAllBoards
};
