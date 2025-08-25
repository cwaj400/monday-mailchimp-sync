const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { enrollInMailchimpCampaign } = require('../utils/mailchimpEnrollmentService');

/**
 * Test enrollment with your actual Monday.com board structure
 */
async function testYourBoard() {
  console.log('🧪 Testing enrollment with your Monday.com board structure...\n');
  
  // Test 1: Real inquiry data based on your board with your email
  console.log('📋 Test 1: Real inquiry with your board structure');
  const realItem = {
    id: '8745998882',
    name: 'Angel James - Test Inquiry',
    column_values: [
      { id: 'lead_email', title: 'Email', text: 'angelljamesw@gmail.com', type: 'email' },
      { id: 'text3__1', title: 'First Name', text: 'Angel', type: 'text' },
      { id: 'text2__1', title: 'Last Name', text: 'James', type: 'text' },
      { id: 'text_1__1', title: 'Partner First', text: '', type: 'text' },
      { id: 'text_11__1', title: 'Partner Last', text: '', type: 'text' },
      { id: 'lead_phone', title: 'Phone', text: '+1-555-123-4567', type: 'phone' },
      { id: 'dropdown__1', title: 'Event Type', text: 'Wedding', type: 'dropdown' },
      { id: 'dropdown1__1', title: 'Lead Source', text: 'Website', type: 'dropdown' },
      { id: 'lead_status', title: 'Status', text: 'New Lead', type: 'status' },
      { id: 'date__1', title: 'Berwick Contact Date', text: '2025-01-25', type: 'date' },
      { id: 'numbers0__1', title: 'How many people', text: '80', type: 'numbers' },
      { id: 'long_text', title: 'Notes', text: 'Testing Monday.com to Mailchimp enrollment system', type: 'long_text' }
    ]
  };
  
  try {
    const result1 = await enrollInMailchimpCampaign('angelljamesw@gmail.com', realItem);
    console.log('✅ Test 1 Result:', result1.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result1, null, 2));
  } catch (error) {
    console.log('❌ Test 1 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Minimal inquiry (just email)
  console.log('📋 Test 2: Minimal inquiry with just email');
  const minimalItem = {
    id: 'test-123',
    name: 'Test Inquiry - Angel James',
    column_values: [
      { id: 'lead_email', title: 'Email', text: 'angelljamesw@gmail.com', type: 'email' }
    ]
  };
  
  try {
    const result2 = await enrollInMailchimpCampaign('angelljamesw@gmail.com', minimalItem);
    console.log('✅ Test 2 Result:', result2.success ? 'PASSED' : 'FAILED');
    console.log('   Details:', JSON.stringify(result2, null, 2));
  } catch (error) {
    console.log('❌ Test 2 Result: FAILED');
    console.log('   Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Test email validation with your board structure
  console.log('📋 Test 3: Email validation test');
  const testEmails = [
    'angelljamesw@gmail.com', // Your email - should be accepted
    'test@example.com',       // Should be rejected
    'admin@company.com',      // Should be rejected
    'noreply@domain.com',     // Should be rejected
    'customer@realbusiness.com', // Should be accepted
    'john.doe@startup.com'    // Should be accepted
  ];
  
  for (const testEmail of testEmails) {
    const testItem = {
      id: `test-${Date.now()}`,
      name: `Test ${testEmail}`,
      column_values: [
        { id: 'lead_email', title: 'Email', text: testEmail, type: 'email' }
      ]
    };
    
    try {
      const result = await enrollInMailchimpCampaign(testEmail, testItem);
      console.log(`   ${testEmail}: ${result.success ? '✅ ACCEPTED' : '❌ REJECTED'}`);
    } catch (error) {
      console.log(`   ${testEmail}: ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Testing completed!');
}

// Run the test
if (require.main === module) {
  testYourBoard().catch(console.error);
}

module.exports = {
  testYourBoard
};
