const { executeQuery } = require('../utils/mondayClient');

// Configuration
const BOARD_ID = process.env.MONDAY_BOARD_ID || '6432503726'; // Your Leads board
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://your-production-domain.com';

async function setupProductionWebhook() {
  console.log('🚀 Setting up Monday.com webhook for production...\n');

  console.log('📋 Configuration:');
  console.log(`   Board ID: ${BOARD_ID} (Leads)`);
  console.log(`   Production URL: ${PRODUCTION_URL}`);
  console.log(`   Webhook Endpoint: ${PRODUCTION_URL}/api/webhooks/monday`);
  console.log('');

  try {
    // Check existing webhooks
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
      
      if (existingWebhooks.data.webhooks.length > 0) {
        console.log('\n⚠️  You have existing webhooks. You may want to delete them first:');
        console.log('   npm run webhook-delete');
        console.log('');
      }
    }

    // Create the webhook
    console.log('🎯 Creating webhook for "create_item" event...');
    const createWebhookResult = await executeQuery(`
      mutation {
        create_webhook(
          board_id: ${BOARD_ID},
          url: "${PRODUCTION_URL}/api/webhooks/monday",
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
      console.log(`   URL: ${PRODUCTION_URL}/api/webhooks/monday`);
      
      console.log('\n🎉 Your enrollment system is now live!');
      console.log('   - New leads in Monday.com will automatically enroll in Mailchimp');
      console.log('   - You\'ll get Discord notifications for each enrollment');
      console.log('   - Check your Mailchimp audience for new subscribers');
      
      return webhook;
    } else {
      console.error('❌ Failed to create webhook:', createWebhookResult);
      if (createWebhookResult.errors) {
        createWebhookResult.errors.forEach(error => {
          console.error(`   Error: ${error.message}`);
        });
      }
      return null;
    }

  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
    return null;
  }
}

async function testProductionSetup() {
  console.log('\n🧪 Testing Production Setup...\n');
  
  console.log('1️⃣ Deploy your server to production');
  console.log('   - Choose a hosting platform (Vercel, Railway, Heroku, etc.)');
  console.log('   - Deploy your code');
  console.log('   - Get your production URL');
  console.log('');
  
  console.log('2️⃣ Set your production URL:');
  console.log('   export PRODUCTION_URL="https://your-production-domain.com"');
  console.log('');
  
  console.log('3️⃣ Create the webhook:');
  console.log('   npm run setup-production-webhook');
  console.log('');
  
  console.log('4️⃣ Test the system:');
  console.log('   - Create a new item in your Monday.com Leads board');
  console.log('   - Add a valid email address');
  console.log('   - Watch for enrollment in Mailchimp');
  console.log('   - Check Discord for notifications');
  console.log('');
  
  console.log('💡 Production Checklist:');
  console.log('   ✅ Server deployed and accessible');
  console.log('   ✅ Environment variables set on production');
  console.log('   ✅ Monday.com webhook created');
  console.log('   ✅ Mailchimp API key configured');
  console.log('   ✅ Discord webhook configured');
  console.log('   ✅ Error monitoring (Sentry) active');
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      await setupProductionWebhook();
      break;
    case 'test':
      await testProductionSetup();
      break;
    default:
      console.log('🚀 Production Webhook Setup\n');
      console.log('Usage:');
      console.log('  node scripts/setup-production-webhook.js create - Create production webhook');
      console.log('  node scripts/setup-production-webhook.js test   - Test production setup');
      console.log('');
      console.log('Environment Variables:');
      console.log('  PRODUCTION_URL - Your production server URL');
      console.log('  MONDAY_BOARD_ID - Your Monday.com board ID (default: 6432503726)');
      console.log('');
      console.log('Example:');
      console.log('  PRODUCTION_URL=https://your-app.vercel.app node scripts/setup-production-webhook.js create');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupProductionWebhook,
  testProductionSetup
};
