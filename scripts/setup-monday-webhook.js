const { executeQuery } = require('../utils/mondayClient');

// Configuration
const BOARD_ID = process.env.MONDAY_BOARD_ID || '10332586'; // Replace with your actual board ID
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-domain.com/api/webhooks/monday'; // Replace with your actual webhook URL

async function setupMondayWebhook() {
  console.log('🔧 Setting up Monday.com webhook for enrollment system...\n');

  try {
    // First, let's check if there are existing webhooks
    console.log('📋 Checking existing webhooks...');
    const existingWebhooks = await executeQuery(`
      query {
        webhooks(board_id: ${BOARD_ID}) {
          id
          event
          board_id
          config
        }
      }
    `);

    if (existingWebhooks.data && existingWebhooks.data.webhooks) {
      console.log(`Found ${existingWebhooks.data.webhooks.length} existing webhook(s):`);
      existingWebhooks.data.webhooks.forEach(webhook => {
        console.log(`  - ID: ${webhook.id}, Event: ${webhook.event}`);
      });
    }

    // Create the webhook for item creation
    console.log('\n🎯 Creating webhook for "create_item" event...');
    const createWebhookResult = await executeQuery(`
      mutation {
        create_webhook(
          board_id: ${BOARD_ID},
          url: "${WEBHOOK_URL}",
          event: create_item
        ) {
          id
          board_id
          event
        }
      }
    `);

    if (createWebhookResult.data && createWebhookResult.data.create_webhook) {
      const webhook = createWebhookResult.data.create_webhook;
      console.log('✅ Webhook created successfully!');
      console.log(`   ID: ${webhook.id}`);
      console.log(`   Board ID: ${webhook.board_id}`);
      console.log(`   Event: ${webhook.event}`);
      console.log(`   URL: ${WEBHOOK_URL}`);
      
      console.log('\n📝 Webhook Configuration:');
      console.log(`   - Board ID: ${BOARD_ID}`);
      console.log(`   - Event: create_item`);
      console.log(`   - URL: ${WEBHOOK_URL}`);
      console.log(`   - Purpose: Automatically enroll new leads in Mailchimp`);
      
      console.log('\n🔍 Next Steps:');
      console.log('1. Monday.com will send a verification challenge to your webhook URL');
      console.log('2. Your webhook endpoint should respond with the challenge token');
      console.log('3. Once verified, the webhook will start sending create_item events');
      console.log('4. Test by creating a new item in your Monday.com board');
      
      return webhook;
    } else {
      console.error('❌ Failed to create webhook:', createWebhookResult);
      return null;
    }

  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
    if (error.response && error.response.data) {
      console.error('GraphQL Errors:', error.response.data.errors);
    }
    return null;
  }
}

async function deleteWebhook(webhookId) {
  console.log(`🗑️ Deleting webhook ${webhookId}...`);
  
  try {
    const result = await executeQuery(`
      mutation {
        delete_webhook(id: ${webhookId}) {
          id
          board_id
        }
      }
    `);

    if (result.data && result.data.delete_webhook) {
      console.log('✅ Webhook deleted successfully!');
      return true;
    } else {
      console.error('❌ Failed to delete webhook:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
    return false;
  }
}

async function listWebhooks() {
  console.log('📋 Listing all webhooks for the board...');
  
  try {
    const result = await executeQuery(`
      query {
        webhooks(board_id: ${BOARD_ID}) {
          id
          event
          board_id
          config
        }
      }
    `);

    if (result.data && result.data.webhooks) {
      console.log(`Found ${result.data.webhooks.length} webhook(s):`);
      result.data.webhooks.forEach(webhook => {
        console.log(`  - ID: ${webhook.id}`);
        console.log(`    Event: ${webhook.event}`);
        console.log(`    Board ID: ${webhook.board_id}`);
        if (webhook.config) {
          console.log(`    Config: ${webhook.config}`);
        }
        console.log('');
      });
      return result.data.webhooks;
    } else {
      console.log('No webhooks found.');
      return [];
    }
  } catch (error) {
    console.error('❌ Error listing webhooks:', error.message);
    return [];
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      await setupMondayWebhook();
      break;
    case 'list':
      await listWebhooks();
      break;
    case 'delete':
      const webhookId = process.argv[3];
      if (!webhookId) {
        console.error('❌ Please provide a webhook ID to delete');
        console.log('Usage: node scripts/setup-monday-webhook.js delete <webhook_id>');
        return;
      }
      await deleteWebhook(webhookId);
      break;
    default:
      console.log('🔧 Monday.com Webhook Setup Script');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/setup-monday-webhook.js create    - Create enrollment webhook');
      console.log('  node scripts/setup-monday-webhook.js list      - List all webhooks');
      console.log('  node scripts/setup-monday-webhook.js delete <id> - Delete a webhook');
      console.log('');
      console.log('Environment Variables:');
      console.log('  MONDAY_BOARD_ID - Your Monday.com board ID');
      console.log('  WEBHOOK_URL     - Your webhook endpoint URL');
      console.log('');
      console.log('Example:');
      console.log('  MONDAY_BOARD_ID=1234567890 WEBHOOK_URL=https://your-domain.com/api/webhooks/monday node scripts/setup-monday-webhook.js create');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupMondayWebhook,
  deleteWebhook,
  listWebhooks
};
