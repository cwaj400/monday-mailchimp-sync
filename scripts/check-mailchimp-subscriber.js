const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { getMailchimpClient } = require('../utils/mailchimpClient');
const crypto = require('crypto');

/**
 * Check if an email is already subscribed to Mailchimp
 */
async function checkMailchimpSubscriber(email) {
  console.log(`🔍 Checking Mailchimp subscriber status for: ${email}\n`);
  
  try {
    const mailchimp = getMailchimpClient();
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    
    if (!audienceId) {
      console.log('❌ MAILCHIMP_AUDIENCE_ID not set in environment');
      return;
    }
    
    // Generate subscriber hash
    const subscriberHash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');
    
    console.log(`📋 Subscriber Hash: ${subscriberHash}`);
    console.log(`📋 Audience ID: ${audienceId}\n`);
    
    try {
      // Try to get subscriber info
      const subscriber = await mailchimp.lists.getListMember(audienceId, subscriberHash);
      
      console.log('✅ Subscriber found in Mailchimp:');
      console.log(`   Email: ${subscriber.email_address}`);
      console.log(`   Status: ${subscriber.status}`);
      console.log(`   Member ID: ${subscriber.id}`);
      console.log(`   Tags: ${subscriber.tags?.map(tag => tag.name).join(', ') || 'None'}`);
      console.log(`   Merge Fields:`, subscriber.merge_fields);
      
      return {
        exists: true,
        subscriber: subscriber
      };
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Subscriber not found in Mailchimp audience');
        return {
          exists: false,
          error: 'Not found'
        };
      } else {
        console.log('❌ Error checking subscriber:', error.message);
        return {
          exists: false,
          error: error.message
        };
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * Get audience information
 */
async function getAudienceInfo() {
  console.log('📊 Getting Mailchimp audience information...\n');
  
  try {
    const mailchimp = getMailchimpClient();
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    
    if (!audienceId) {
      console.log('❌ MAILCHIMP_AUDIENCE_ID not set in environment');
      return;
    }
    
    const audience = await mailchimp.lists.getList(audienceId);
    
    console.log('✅ Audience Information:');
    console.log(`   Name: ${audience.name}`);
    console.log(`   ID: ${audience.id}`);
    console.log(`   Member Count: ${audience.stats.member_count}`);
    console.log(`   Unsubscribe Count: ${audience.stats.unsubscribe_count}`);
    console.log(`   Cleaned Count: ${audience.stats.cleaned_count}`);
    
    return audience;
    
  } catch (error) {
    console.error('❌ Error getting audience info:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || 'angelljamesw@gmail.com';
  
  console.log('🔍 Mailchimp Subscriber Check\n');
  console.log('='.repeat(50));
  
  // Get audience info first
  await getAudienceInfo();
  
  console.log('\n' + '='.repeat(50));
  
  // Check subscriber status
  await checkMailchimpSubscriber(email);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Check completed!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkMailchimpSubscriber,
  getAudienceInfo
};
