const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const Sentry = require('@sentry/node');
const logger = require('../../utils/logger');
const dotenv = require('dotenv');

dotenv.config();

// Common processing logic
exports.processEmailEvent = async function(email, eventType, eventData) {
    let span = null;
    logger.info('processEmailEvent called', {
      email: email,
      eventType: eventType,
      campaignTitle: eventData.campaignTitle
    });

    try {
      // Start Sentry span for performance monitoring
      span = Sentry.startInactiveSpan({
        name: 'process_email_event',
        op: 'webhook.email.process',
        attributes: {
          email,
          eventType,
          campaignTitle: eventData.campaignTitle
        }
      });
      
      console.log('processEmailEvent');
      
      // Add breadcrumb for email event processing
      Sentry.addBreadcrumb({
        category: 'webhook.email',
        message: 'Processing email event',
        level: 'info',
        data: {
        email,
        eventType,
        campaignTitle: eventData.campaignTitle
        }
      });
      
      // Find the Monday.com item by email
      const mondayItem = await findMondayItemByEmail(email);
    
    if (!mondayItem) {
      const errorMsg = `Monday.com item not found for email: ${email}`;
      console.error(errorMsg);
      
      // Send Discord notification for missing contact (fire and forget)
      sendDiscordNotification(
        '⚠️ Touchpoint Update Failed: Contact Not Found',
        `We received a Mailchimp ${eventType} event for ${email}, but couldn't find this contact in Monday.com.`,
        {
          'Email': email,
          'Event Type': eventType,
          'Timestamp': new Date().toISOString(),
          'Campaign': eventData.campaignTitle
        },
        'FFA500' // Orange color for warnings
      ).catch(err => {
        console.error('Discord notification failed:', err.message);
      });
      
      return { error: errorMsg, email };
    }
    
    // Add a note to the Monday item
    const noteResult = await addNoteToMondayItem(mondayItem.id, eventData.noteText);
    console.log('added note to monday item');
    let touchpointResult;

    if (eventType === 'send' || eventType === 'campaign') {
      // Increment touchpoints
      touchpointResult = await incrementTouchpoints(mondayItem.id);
      
      
      if (touchpointResult.success) {
        console.log('touchpoint updated successfully');
        sendDiscordNotification(
          '✅ Touchpoint Updated Successfully',
          `A touchpoint has been added for ${email} based on a Mailchimp ${eventType} event.`,
          {
            'Contact': email,
            'Monday ID': mondayItem.id,
            'Previous Value': touchpointResult.previousValue,
            'New Value': touchpointResult.newValue,
            'Event Type': eventType,
            'Campaign': eventData.campaignTitle,
        },
        '57F287' // Green color for success
      ).catch(err => {
        console.error('Discord notification failed:', err.message);
      });
    } else {
      sendDiscordNotification(
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
      ).catch(err => {
        console.error('Discord notification failed:', err.message);
      });
    }
  
  } else {
    if (addNoteResult.success) {  
      sendDiscordNotification(
        '✅ Note Added Successfully',
        `A note has been added for ${email} based on a Mailchimp ${eventType} event.`,
        {
          'Contact': email,
          'Monday ID': mondayItem.id,
          'Event Type': eventType,
          'Campaign': eventData.campaignTitle,
          'Text': addNoteResult.text,
          'Note Added': addNoteResult.success ? 'Yes' : 'No'
        },
        '57F287' // Green color for success
      ).catch(err => {
        console.error('Discord notification failed:', err.message);
      });
    } else {
      sendDiscordNotification(
        '❌ Failed to Add Note',
        `We tried to add a note for ${email} based on a Mailchimp ${eventType} event, but the update failed.`,
        {
          'Contact': email,
          'Monday ID': mondayItem.id,
          'Error': addNoteResult.error,
          'Event Type': eventType,
          'Campaign': eventData.campaignTitle,
          'Text': addNoteResult.text,
          'Note Added': addNoteResult.success ? 'Yes' : 'No'
        },
        'ED4245' // Red color for errors
      ).catch(err => {
        console.error('Discord notification failed:', err.message);
      });
    }
  }
      return {
        success: touchpointResult.success && noteResult.success,
        message: touchpointResult.success ? 
          `Touchpoints incremented and note added for ${email}` : 
          `Failed to update touchpoints for ${email}`,
        itemId: mondayItem.id,
        noteAdded: noteResult.success,
        event: eventType,
        campaign: eventData.campaignTitle
      };
    } catch (error) {
      // Log error to Sentry
      Sentry.captureException(error, {
        context: 'Email event processing',
        email,
        eventType,
        campaignTitle: eventData.campaignTitle
      });
      
      console.error('Error processing email event:', error);
      return {
        success: false,
        error: error.message,
        email,
        eventType
      };
    } finally {
      if (span) {
        span.end();
      }
    }
  }