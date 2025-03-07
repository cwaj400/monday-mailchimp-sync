const cron = require('node-cron');
const { executeQuery } = require('../utils/mondayClient');
const { getMailchimpClient } = require('../utils/mailchimpClient');
const { getMockMailchimpClient } = require('../utils/mockMailchimpClient');
const { sendDiscordNotification } = require('../utils/discordNotifier');
const { 
  getMondayContacts, 
  incrementTouchpoints,
  TOUCHPOINTS_COLUMN_ID,
  EMAIL_COLUMN_ID
} = require('../utils/mondayService');

// Use this to toggle between real and mock client
const USE_MOCK_CLIENT = process.env.NODE_ENV === 'test';

// Store the last check time
let lastCheckTime = new Date();

// Add this to your cronService.js
let lastRunTime = null;

// Function to check for new emails sent via Mailchimp
async function checkMailchimpActivity() {
  try {
    // Use either the real or mock client
    const mailchimp = USE_MOCK_CLIENT ? getMockMailchimpClient() : getMailchimpClient();
    const currentTime = new Date();
    
    // Format dates for Mailchimp API
    const since = lastCheckTime.toISOString();
    logDebug(`Checking for emails sent since: ${since}`);
    
    // Get all campaigns sent since last check
    const campaigns = await mailchimp.campaigns.list({
      since_send_time: since,
      status: 'sent'
    });
    
    if (!campaigns.campaigns || campaigns.campaigns.length === 0) {
      console.log('No new campaigns sent since last check');
      lastCheckTime = currentTime;
      return [];
    }
    
    console.log(`Found ${campaigns.campaigns.length} campaigns sent since last check`);
    
    // Get all contacts from Monday
    const mondayContacts = await getMondayContacts();
    const contactsToUpdate = new Set();
    
    // For each campaign, check the recipients
    for (const campaign of campaigns.campaigns) {
      const campaignId = campaign.id;
      
      try {
        // Get campaign send details
        const sendDetails = await mailchimp.reports.getCampaignSentTo(campaignId, {
          count: 1000 // Adjust based on your list size
        });
        
        if (sendDetails.sent_to && sendDetails.sent_to.length > 0) {
          // Add each recipient's email to the set of contacts to update
          sendDetails.sent_to.forEach(recipient => {
            contactsToUpdate.add(recipient.email_address.toLowerCase());
          });
        }
      } catch (error) {
        console.error(`Error getting send details for campaign ${campaignId}:`, error);
      }
    }
    
    // Update lastCheckTime for the next run
    lastCheckTime = currentTime;
    
    // Return contacts that need touchpoint updates
    return mondayContacts.filter(contact => 
      contact.email && contactsToUpdate.has(contact.email.toLowerCase())
    );
  } catch (error) {
    console.error('Error checking Mailchimp activity:', error);
    return [];
  }
}

// Main function to check and update touchpoints
async function checkAndUpdateTouchpoints() {
  console.log('Running scheduled touchpoint update check...');
  
  try {
    // Get contacts with new email activity
    const contactsToUpdate = await checkMailchimpActivity();
    
    if (contactsToUpdate.length === 0) {
      console.log('No contacts need touchpoint updates');
      return;
    }
    
    console.log(`Found ${contactsToUpdate.length} contacts that need touchpoint updates`);
    
    // Update touchpoints for each contact
    for (const contact of contactsToUpdate) {
      console.log(`Incrementing touchpoint for ${contact.email} (${contact.id})`);
      const result = await incrementTouchpoints(contact.id, contact.touchpoints);
      
      if (result.success) {
        console.log(`Successfully updated touchpoints for ${contact.email} from ${result.previousValue} to ${result.newValue}`);
      } else {
        console.error(`Failed to update touchpoints for ${contact.email}: ${result.error}`);
      }
    }
    
    console.log('Touchpoint update check completed');
  } catch (error) {
    console.error('Error in touchpoint update check:', error);
  }
}

// Function to send daily summary report
async function sendDailySummaryReport() {
  try {
    console.log('Generating daily touchpoint summary report...');
    
    // Get all contacts with touchpoints
    const contacts = await getMondayContacts();
    
    if (contacts.length === 0) {
      console.log('No data available for summary report');
      return;
    }
    
    // Count contacts with touchpoints
    const contactsWithTouchpoints = contacts.filter(contact => contact.touchpoints > 0);
    
    // Get top 50 contacts by touchpoints
    const topContacts = contactsWithTouchpoints
      .sort((a, b) => b.touchpoints - a.touchpoints)
      .slice(0, 50);
    
    // Format top contacts as string
    const topContactsStr = topContacts.map(c => 
      `${c.name} (${c.email}): ${c.touchpoints} touchpoints`
    ).join('\n');
    
    // Send summary via Discord
    await sendDiscordNotification(
      '📊 Daily Touchpoint Summary Report',
      'Here is your daily summary of touchpoint data from Monday.com:',
      {
        'Total Contacts': contacts.length,
        'Contacts with Touchpoints': contactsWithTouchpoints.length,
        'Top 50 Contacts': topContactsStr,
        'Report Date': new Date().toLocaleDateString()
      },
      '5865F2' // Discord Blurple color
    );
    
    console.log('Daily summary report sent via Discord');
  } catch (error) {
    console.error('Error sending daily summary report:', error.message);
  }
}

// Schedule the cron jobs
function startCronJobs() {
  // Add daily summary report at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    sendDailySummaryReport();
  });
  
  console.log('Cron jobs scheduled: Daily summary report at 9:00 AM');
}

// Add this function to your cronService.js
function logDebug(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

module.exports = {
  startCronJobs,
  checkAndUpdateTouchpoints,
  sendDailySummaryReport
};
