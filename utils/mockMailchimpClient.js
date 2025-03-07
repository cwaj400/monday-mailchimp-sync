// Mock Mailchimp client for testing
function getMockMailchimpClient() {
  return {
    campaigns: {
      list: async ({ since_send_time, status }) => {
        console.log(`[MOCK] Getting campaigns since ${since_send_time} with status ${status}`);
        
        // Return mock campaign data
        return {
          campaigns: [
            {
              id: 'mock-campaign-1',
              settings: {
                title: 'Mock Campaign 1'
              },
              send_time: new Date().toISOString()
            }
          ]
        };
      }
    },
    reports: {
      getCampaignSentTo: async (campaignId, { count }) => {
        console.log(`[MOCK] Getting recipients for campaign ${campaignId}, count: ${count}`);
        
        // Return mock recipient data - use emails that exist in your Monday.com board
        return {
          sent_to: [
            { email_address: 'angelljamesw@gmail.com' },
            { email_address: 'will@berwick-house.com' }
            // Add more test emails as needed
          ]
        };
      }
    }
  };
}

module.exports = {
  getMockMailchimpClient
}; 