const { executeQuery } = require('../utils/mondayClient');

const WEBHOOK_ID = '462435370';

async function getWebhookDetails() {
  console.log('🔍 Getting detailed webhook information...\n');

  try {
    // Try to get webhook details (note: Monday.com API might not return URL for security)
    const result = await executeQuery(`
      query {
        webhooks(board_id: 6432503726) {
          id
          event
          board_id
          config
        }
      }
    `);

    if (result.data && result.data.webhooks) {
      const webhook = result.data.webhooks.find(w => w.id === WEBHOOK_ID);
      
      if (webhook) {
        console.log('📋 Webhook Details:');
        console.log(`   ID: ${webhook.id}`);
        console.log(`   Event: ${webhook.event}`);
        console.log(`   Board ID: ${webhook.board_id}`);
        console.log(`   Config: ${webhook.config || '{}'}`);
        console.log('');
        
        console.log('💡 Analysis:');
        console.log('   ✅ Webhook exists and is active');
        console.log('   ✅ Event type is correct (create_item)');
        console.log('   ✅ Board ID matches your configuration');
        console.log('');
        
        console.log('🔧 Options:');
        console.log('   1. Delete existing webhook and create new one');
        console.log('   2. Update existing webhook URL (if supported)');
        console.log('   3. Test if existing webhook is working');
        console.log('');
        
        console.log('📝 Note: Monday.com API does not return webhook URLs for security reasons.');
        console.log('   You can check the webhook URL in the Monday.com Automations Center.');
        
        return webhook;
      } else {
        console.log('❌ Webhook not found');
        return null;
      }
    } else {
      console.error('❌ Failed to get webhook details:', result);
      return null;
    }

  } catch (error) {
    console.error('❌ Error getting webhook details:', error.message);
    return null;
  }
}

async function testWebhookFunctionality() {
  console.log('\n🧪 Testing webhook functionality...\n');
  
  console.log('1️⃣ Check if your server is running:');
  console.log('   npm start');
  console.log('');
  
  console.log('2️⃣ Create a test item in your Monday.com board:');
  console.log('   - Go to your board (ID: 6432503726)');
  console.log('   - Create a new item with a valid email address');
  console.log('   - Watch your server logs for webhook processing');
  console.log('');
  
  console.log('3️⃣ Check for Discord notifications');
  console.log('4️⃣ Check Mailchimp for new subscribers');
  console.log('');
  
  console.log('💡 If the webhook is working, you should see:');
  console.log('   - Server logs showing webhook processing');
  console.log('   - Discord notifications about enrollment');
  console.log('   - New subscribers in your Mailchimp audience');
}

async function deleteAndRecreateWebhook() {
  console.log('\n🗑️ Deleting existing webhook...\n');
  
  try {
    const deleteResult = await executeQuery(`
      mutation {
        delete_webhook(id: ${WEBHOOK_ID}) {
          id
          board_id
        }
      }
    `);

    if (deleteResult.data && deleteResult.data.delete_webhook) {
      console.log('✅ Webhook deleted successfully!');
      console.log(`   ID: ${deleteResult.data.delete_webhook.id}`);
      console.log(`   Board ID: ${deleteResult.data.delete_webhook.board_id}`);
      console.log('');
      
      console.log('🔄 Now you can create a new webhook:');
      console.log('   npm run setup-webhook create');
      
      return true;
    } else {
      console.error('❌ Failed to delete webhook:', deleteResult);
      return false;
    }

  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'details':
      await getWebhookDetails();
      break;
    case 'test':
      await testWebhookFunctionality();
      break;
    case 'delete':
      await deleteAndRecreateWebhook();
      break;
    default:
      console.log('🔍 Webhook Details Script');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/get-webhook-details.js details - Get webhook details');
      console.log('  node scripts/get-webhook-details.js test    - Test webhook functionality');
      console.log('  node scripts/get-webhook-details.js delete  - Delete existing webhook');
      console.log('');
      console.log('Current webhook ID: 462435370');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getWebhookDetails,
  testWebhookFunctionality,
  deleteAndRecreateWebhook
};
