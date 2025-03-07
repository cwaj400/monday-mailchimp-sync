const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const dotenv = require('dotenv');

dotenv.config();

// Common processing logic
exports.processEmailEvent = async function(email, eventType, eventData) {
    console.log('processEmailEvent');
    // Find the Monday.com item by email
    const mondayItem = await findMondayItemByEmail(email);
    
    if (!mondayItem) {
      const errorMsg = `Monday.com item not found for email: ${email}`;
      console.error(errorMsg);
      
      // Send Discord notification for missing contact
      await sendDiscordNotification(
        '⚠️ Touchpoint Update Failed: Contact Not Found',
        `We received a Mailchimp ${eventType} event for ${email}, but couldn't find this contact in Monday.com.`,
        {
          'Email': email,
          'Event Type': eventType,
          'Timestamp': new Date().toISOString(),
          'Campaign': eventData.campaignTitle
        },
        'FFA500' // Orange color for warnings
      );
      
      return { error: errorMsg, email };
    }
    
    // Add a note to the Monday item
    const noteResult = await addNoteToMondayItem(mondayItem.id, eventData.noteText);
    
    if (eventType === 'send' || eventType === 'campaign') {
      // Increment touchpoints
      const touchpointResult = await incrementTouchpoints(mondayItem.id);
    }
      
    // Handle success/failure notifications
    if (touchpointResult.success) {
      
      await sendDiscordNotification(
        '✅ Touchpoint Updated Successfully',
        `A touchpoint has been added for ${email} based on a Mailchimp ${eventType} event.`,
        {
          'Contact': email,
          'Monday ID': mondayItem.id,
          'Previous Value': touchpointResult.previousValue,
          'New Value': touchpointResult.newValue,
          'Event Type': eventType,
          'Campaign': eventData.campaignTitle,
          'Note Added': noteResult.success ? 'Yes' : 'No'
        },
        '57F287' // Green color for success
      );
    } else {
      await sendDiscordNotification(
        '❌ Failed to Update Touchpoint',
        `We tried to add a touchpoint for ${email} based on a Mailchimp ${eventType} event, but the update failed.`,
        {
          'Contact': email,
          'Monday ID': mondayItem.id,
          'Error': touchpointResult.error,
          'Event Type': eventType,
          'Campaign': eventData.campaignTitle,
          'Note Added': noteResult.success ? 'Yes' : 'No'
        },
        'ED4245' // Red color for errors
      );
    }
    
    // Return result
    return {
      success: touchpointResult.success && noteResult.success,
      message: touchpointResult.success ? 
        `Touchpoints incremented and note added for ${email}` : 
        `Failed to update touchpoints for ${email}`,
      itemId: mondayItem.id,
      previousValue: touchpointResult.previousValue,
      newValue: touchpointResult.newValue,
      noteAdded: noteResult.success,
      event: eventType,
      campaign: eventData.campaignTitle
    };
  }
  