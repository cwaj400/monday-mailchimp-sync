// backend/scripts/test-sync.js
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { syncMondayToMailchimp } = require('../utils/syncService');

async function testSync() {
  console.log('Testing Monday to Mailchimp sync process...');
  
  try {
    // Run the sync
    const result = await syncMondayToMailchimp();
    
    console.log('Sync completed successfully:');
    console.log(`Total contacts: ${result.total}`);
    console.log(`Synced contacts: ${result.synced}`);
    
    // Log the first few results
    if (result.results.length > 0) {
      console.log('\nSample results:');
      result.results.slice(0, 3).forEach(r => {
        console.log(`- ${r.email}: ${r.status}`);
      });
    }
  } catch (error) {
    console.error('Error testing sync:', error);
  }
}

// Run the test
testSync();