const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { enrollInMailchimpCampaign } = require('../utils/mailchimpEnrollmentService');
const { processMondayWebhook } = require('../utils/mondayService');
const { sendDiscordNotification } = require('../utils/discordNotifier');

/**
 * Test the complete enrollment flow
 */
async function testEnrollmentFlow() {
  console.log('🧪 Testing Monday.com to Mailchimp enrollment flow...\n');
  
  // Test 1: Valid inquiry with complete data
  console.log('📋 Test 1: Valid inquiry with complete data');
  const validItem = {
    id: '123456',
    name: 'Test Customer Inquiry',
    column_values: [
      { id: 'email_mknrc1cr', title: 'Email', text: 'john.doe@realcompany.com', type: 'email' },
      { id: 'text', title: 'First Name', text: 'John', type: 'text' },
      { id: 'text1', title: 'Last Name', text: 'Doe', type: 'text' },
      { id: 'text2', title: 'Company', text: 'Real Company Ltd', type: 'text' },
      { id: 'phone', title: 'Phone', text: '+1-555-123-4567', type: 'text' },
      { id: 'text3', title: 'Website', text: 'https://realcompany.com', type: 'text' }
    ]
  };
  
  try {
    const result1 = await enrollInMailchimpCampaign('john.doe@realcompany.com', validItem);
    console.log('✅ Test 1 Result:', result1.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result1, null, 2));
  } catch (error) {
    console.log('❌ Test 1 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Inquiry with minimal data
  console.log('📋 Test 2: Inquiry with minimal data');
  const minimalItem = {
    id: '123457',
    name: 'Minimal Inquiry',
    column_values: [
      { id: 'email_mknrc1cr', title: 'Email', text: 'jane.smith@startup.com', type: 'email' }
    ]
  };
  
  try {
    const result2 = await enrollInMailchimpCampaign('jane.smith@startup.com', minimalItem);
    console.log('✅ Test 2 Result:', result2.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result2, null, 2));
  } catch (error) {
    console.log('❌ Test 2 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Invalid email
  console.log('📋 Test 3: Invalid email');
  const invalidEmailItem = {
    id: '123458',
    name: 'Invalid Email Inquiry',
    column_values: [
      { id: 'email_mknrc1cr', title: 'Email', text: 'invalid-email', type: 'email' }
    ]
  };
  
  try {
    const result3 = await enrollInMailchimpCampaign('invalid-email', invalidEmailItem);
    console.log('✅ Test 3 Result:', result3.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result3, null, 2));
  } catch (error) {
    console.log('❌ Test 3 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Test email patterns
  console.log('📋 Test 4: Test email patterns');
  const testEmails = [
    'test@example.com',
    'admin@company.com',
    'noreply@domain.com',
    'info@business.com',
    'hello@startup.com',
    'customer@legitimate.com',
    'user@realcompany.com',
    'contact@validbusiness.com'
  ];
  
  for (const testEmail of testEmails) {
    const testItem = {
      id: `test-${Date.now()}`,
      name: `Test ${testEmail}`,
      column_values: [
        { id: 'email_mknrc1cr', title: 'Email', text: testEmail, type: 'email' }
      ]
    };
    
    try {
      const result = await enrollInMailchimpCampaign(testEmail, testItem);
      console.log(`   ${testEmail}: ${result.success ? '✅ ACCEPTED' : '❌ REJECTED'}`);
    } catch (error) {
      console.log(`   ${testEmail}: ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: Webhook processing
  console.log('📋 Test 5: Webhook processing simulation');
  const webhookData = {
    type: 'webhook',
    event: {
      type: 'create_item'
    },
    boardId: process.env.MONDAY_BOARD_ID,
    itemId: '123456'
  };
  
  try {
    const result5 = await processMondayWebhook(webhookData);
    console.log('✅ Test 5 Result:', result5.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result5, null, 2));
  } catch (error) {
    console.log('❌ Test 5 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 6: Discord notification test
  console.log('📋 Test 6: Discord notification test');
  try {
    const notificationResult = await sendDiscordNotification(
      '🧪 Test Notification',
      'This is a test notification for the Monday.com to Mailchimp enrollment system.',
      {
        'Test Type': 'Enrollment System',
        'Status': 'Testing',
        'Timestamp': new Date().toISOString()
      },
      '0099FF' // Blue color
    );
    
    console.log('✅ Test 6 Result:', notificationResult ? 'PASSED' : 'FAILED');
    console.log('   Notification sent successfully');
  } catch (error) {
    console.log('❌ Test 6 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Testing completed!');
}

/**
 * Test email validation specifically
 */
async function testEmailValidation() {
  console.log('🔍 Testing email validation...\n');
  
  const testCases = [
    { email: 'valid@example.com', expected: false }, // example.com should be rejected
    { email: 'test@example.com', expected: false }, // test@ should be rejected
    { email: 'admin@company.com', expected: false }, // admin@ should be rejected
    { email: 'noreply@domain.com', expected: false }, // noreply@ should be rejected
    { email: 'invalid-email', expected: false }, // invalid format
    { email: 'user@localhost', expected: false }, // localhost should be rejected
    { email: 'contact@business.com', expected: false }, // contact@ should be rejected
    { email: 'hello@startup.com', expected: false }, // hello@ should be rejected
    { email: 'customer@realcompany.com', expected: true }, // valid business email
    { email: 'john.doe@legitimate.com', expected: true }, // valid personal email
    { email: 'sales@acme-corp.com', expected: false }, // sales@ should be rejected
    { email: 'support@techstartup.com', expected: false }, // support@ should be rejected
    { email: 'marketing@bigcompany.com', expected: false }, // marketing@ should be rejected
    { email: 'alice.smith@consulting.com', expected: true }, // valid personal email
    { email: 'bob.wilson@enterprise.com', expected: true } // valid business email
  ];
  
  const { validateAndCleanEmail } = require('../utils/mailchimpEnrollmentService');
  
  for (const testCase of testCases) {
    const result = validateAndCleanEmail(testCase.email);
    const passed = (result !== null) === testCase.expected;
    
    console.log(`${passed ? '✅' : '❌'} ${testCase.email}: ${result || 'REJECTED'}`);
  }
}

/**
 * Test merge field extraction
 */
async function testMergeFieldExtraction() {
  console.log('🔍 Testing merge field extraction...\n');
  
  const testItem = {
    id: '123456',
    name: 'Test Customer',
    column_values: [
      { id: 'text', title: 'First Name', text: 'John', type: 'text' },
      { id: 'text1', title: 'Last Name', text: 'Doe', type: 'text' },
      { id: 'text2', title: 'Company', text: 'Test Company Ltd', type: 'text' },
      { id: 'phone', title: 'Phone', text: '+1-555-123-4567', type: 'text' },
      { id: 'text3', title: 'Website', text: 'https://testcompany.com', type: 'text' },
      { id: 'text4', title: 'Address', text: '123 Main St, City, State 12345', type: 'text' },
      { id: 'text5', title: 'Random Field', text: 'This should not be included', type: 'text' }
    ]
  };
  
  const { extractMergeFields } = require('../utils/mailchimpEnrollmentService');
  
  try {
    const mergeFields = extractMergeFields(testItem);
    console.log('✅ Extracted merge fields:');
    console.log(JSON.stringify(mergeFields, null, 2));
  } catch (error) {
    console.log('❌ Error extracting merge fields:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  switch (args[0]) {
    case 'email':
      await testEmailValidation();
      break;
    case 'merge':
      await testMergeFieldExtraction();
      break;
    case 'full':
    default:
      await testEnrollmentFlow();
      break;
  }
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testEnrollmentFlow,
  testEmailValidation,
  testMergeFieldExtraction
};
