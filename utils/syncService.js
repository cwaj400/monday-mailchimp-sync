const { getMailchimpClient } = require('./mailchimpClient');
const { getMockMailchimpClient } = require('./mockMailchimpClient');
const { executeQuery } = require('./mondayClient');
const { getAllMondayContacts, TOUCHPOINTS_COLUMN_ID } = require('./mondayService');
const { sendDiscordNotification } = require('./discordNotifier');

// Use this to toggle between real and mock client
const USE_MOCK_CLIENT = process.env.NODE_ENV === 'test';

// Mailchimp list ID
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;

// Get the appropriate Mailchimp client
const mailchimpClient = USE_MOCK_CLIENT ? getMockMailchimpClient() : getMailchimpClient();

// Function to update touchpoints in Monday.com
async function updateMondayTouchpoints(itemId, currentTouchpoints) {
  try {
    const query = `
      mutation {
        change_simple_column_value(
          item_id: ${itemId}, 
          board_id: ${process.env.MONDAY_BOARD_ID}, 
          column_id: "${TOUCHPOINTS_COLUMN_ID}", 
          value: "${currentTouchpoints}"
        ) {
          id
        }
      }
    `;
    
    await executeQuery(query);
    return true;
  } catch (error) {
    return false;
  }
}

// Function to add/update contact in Mailchimp
const syncContactToMailchimp = async (contact) => {
  // Extract email from Monday.com contact
  const emailColumn = contact.column_values.find(col => col.title.toLowerCase().includes('email'));
  if (!emailColumn || !emailColumn.text) {
    return null;
  }
  
  const email = emailColumn.text;
  const emailHash = require('crypto').createHash('md5').update(email.toLowerCase()).digest('hex');
  
  // Prepare contact data for Mailchimp
  const contactData = {
    email_address: email,
    status: 'subscribed',
    merge_fields: {
      FNAME: contact.name.split(' ')[0] || '',
      LNAME: contact.name.split(' ').slice(1).join(' ') || ''
    }
  };
  
  try {
    // Add or update the contact in Mailchimp
    const response = await mailchimpClient.put(
      `/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}`,
      contactData
    );
    
    // Find touchpoints column
    const touchpointsColumn = contact.column_values.find(col => col.title.toLowerCase().includes('touchpoints'));
    const currentTouchpoints = touchpointsColumn ? touchpointsColumn.text : '0';
    
    // Update touchpoints in Monday.com
    await updateMondayTouchpoints(contact.id, currentTouchpoints);
    
    return {
      email,
      status: response.data.status,
      mondayId: contact.id
    };
  } catch (error) {
    return {
      email,
      status: 'error',
      mondayId: contact.id,
      error: error.response?.data?.detail || error.message
    };
  }
};

// Main sync function
const syncMondayToMailchimp = async () => {
  try {
    // Get contacts from Monday.com
    const contacts = await getAllMondayContacts();
    
    // Notify about sync start
    await sendDiscordNotification(
      '🔄 Starting Monday-Mailchimp Sync',
      `Beginning sync of ${contacts.length} contacts from Monday.com to Mailchimp.`,
      {
        'Total Contacts': contacts.length,
        'Start Time': new Date().toISOString()
      },
      '5865F2' // Discord Blurple color
    );
    
    // Sync each contact to Mailchimp
    const results = [];
    for (const contact of contacts) {
      const result = await syncContactToMailchimp(contact);
      if (result) results.push(result);
    }
    
    // Notify about sync completion
    await sendDiscordNotification(
      '✅ Monday-Mailchimp Sync Complete',
      `Successfully synced ${results.length} of ${contacts.length} contacts.`,
      {
        'Total Contacts': contacts.length,
        'Synced Contacts': results.length,
        'Completion Time': new Date().toISOString()
      },
      '57F287' // Green color for success
    );
    
    return {
      total: contacts.length,
      synced: results.length,
      results
    };
  } catch (error) {
    
    // Notify about sync failure
    await sendDiscordNotification(
      '❌ Monday-Mailchimp Sync Failed',
      'An error occurred during the sync process.',
      {
        'Error': error.message,
        'Time': new Date().toISOString()
      },
      'ED4245' // Red color for errors
    );
    
    throw error;
  }
};

// Function to sync a single contact
const syncSingleContact = async (contactId) => {
  try {
    // Get the contact from Monday.com
    const query = `
      query {
        items(ids: ${contactId}) {
          id
          name
          column_values {
            id
            title
            text
            value
          }
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (!result.data || !result.data.items || result.data.items.length === 0) {
      throw new Error(`Contact not found with ID: ${contactId}`);
    }
    
    const contact = result.data.items[0];
    
    // Sync the contact to Mailchimp
    const syncResult = await syncContactToMailchimp(contact);
    
    if (!syncResult) {
      throw new Error(`Failed to sync contact: ${contact.name}`);
    }
    
    return syncResult;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  syncMondayToMailchimp,
  syncSingleContact
};
