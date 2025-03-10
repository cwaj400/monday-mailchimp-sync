const { findMondayItemByEmail, addNoteToMondayItem } = require('../../utils/mondayService');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const dotenv = require('dotenv');

dotenv.config();

exports.handleSubscriberEvent = async function(req, res, eventType) {
    console.log('handleSubscriberEvent');
    const email = req.body.data.email;
    const listId = req.body.data.list_id;
    const merges = req.body.data.merges || {};
    const firstName = merges.FNAME || '';
    const lastName = merges.LNAME || '';
  
    if (!email) {
      console.error('Email not provided in webhook data');
      return res.status(400).json({ error: 'Email not provided in webhook data' });
    }
    
    try {
      // Find the Monday.com item by email
      const mondayItem = await findMondayItemByEmail(email);
      
      if (!mondayItem) {
        const errorMsg = `Monday.com item not found for email: ${email}`;
        console.error(errorMsg);
        
        // Send Discord notification for missing contact
        await sendDiscordNotification(
          `⚠️ Mailchimp ${eventType} Update Failed: Contact Not Found`,
          `We received a Mailchimp ${eventType} event for ${email}, but couldn't find this contact in Monday.com.`,
          {
            'Email': email,
            'First Name': firstName,
            'Last Name': lastName,
            'List ID': listId,
            'Event Type': eventType,
            'Timestamp': new Date().toISOString()
          },
          'FFA500' // Orange color for warnings
        );
        
        return res.json({ error: errorMsg, email });
      }
      
      // Determine the status and note text based on event type
      let mailchimpStatus = 'Unknown';
      let noteText = '';
      
      switch (eventType) {
        case 'subscribe':
          mailchimpStatus = 'Subscribed';
          noteText = `✅ Subscribed to Mailchimp: ${email} was subscribed to Mailchimp list "${listId}"`;
          break;
        
        case 'unsubscribe':
          mailchimpStatus = 'Unsubscribed';
          noteText = `❌ Unsubscribed from Mailchimp: ${email} unsubscribed from Mailchimp list "${listId}"`;
          break;
        
        case 'profile':
          mailchimpStatus = 'Subscribed'; // Profile updates typically mean they're still subscribed
          noteText = `📝 Mailchimp Profile Updated: ${email}'s profile was updated on Mailchimp list "${listId}"`;
          break;
        
        case 'cleaned':
          mailchimpStatus = 'Cleaned';
          noteText = `🧹 Mailchimp Email Cleaned: ${email} was cleaned from Mailchimp list "${listId}". Reason: ${req.body.data.reason || 'Unknown'}`;
          break;
      }
      
  
      // Add a note to the Monday item
      const noteResult = await addNoteToMondayItem(mondayItem.id, noteText);
      
      // Send success notification
      if (noteResult.success) {
        console.log(`Updated Mailchimp status for ${email} (${mondayItem.id}) to ${mailchimpStatus}`);
        
        await sendDiscordNotification(
          `✅ Mailchimp ${eventType} Status Updated`,
          `${email}'s Mailchimp status has been updated to "${mailchimpStatus}" in Monday.com.`,
          {
            'Contact': email,
            'Monday ID': mondayItem.id,
            'First Name': firstName,
            'Last Name': lastName,
            'Status': mailchimpStatus,
            'List ID': listId,
            'Note Added': noteResult.success ? 'Yes' : 'No'
          },
          '57F287' // Green color for success
        );
      } else {
        await sendDiscordNotification(
          `❌ Failed to Update Mailchimp ${eventType} Status`,
          `We tried to update ${email}'s Mailchimp status to "${mailchimpStatus}" in Monday.com, but the update failed.`,
          {
            'Contact': email,
            'Monday ID': mondayItem.id,
            'Error': updateResult.error,
            'Status': mailchimpStatus,
            'List ID': listId,
            'Note Added': noteResult.success ? 'Yes' : 'No'
          },
          'ED4245' // Red color for errors
        );
      }
      
      // Return result
      return res.json({
        success: noteResult.success,
        message: noteResult.success ? 
          `Mailchimp status updated to ${mailchimpStatus} for ${email}` : 
          `Failed to update Mailchimp status for ${email}`,
        itemId: mondayItem.id,
        email,
        status: mailchimpStatus,
        noteAdded: noteResult.success
      });
    } catch (error) {
      console.error(`Error processing ${eventType} event for ${email}:`, error);
      
      await sendDiscordNotification(
        `❌ Error Processing Mailchimp ${eventType} Event`,
        `An error occurred while processing a Mailchimp ${eventType} event for ${email}.`,
        {
          'Email': email,
          'Error': error.message,
          'Stack Trace': error.stack?.substring(0, 300) + '...'
        },
        'ED4245' // Red color for errors
      );
      
      return res.status(500).json({
        error: `Failed to process ${eventType} event`,
        details: error.message,
        email
      });
    }
  }