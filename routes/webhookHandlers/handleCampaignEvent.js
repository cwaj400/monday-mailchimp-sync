const axios = require('axios');
const dotenv = require('dotenv');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
const { captureException, addBreadcrumb, startTransaction } = require('../../utils/sentry');
dotenv.config();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;

exports.handleCampaignEvent = async function(req, res) {
    console.log('handleCampaignEvent');
    
    // Start a Sentry transaction
    const transaction = startTransaction('handleCampaignEvent', 'webhook.campaign');
    
    // Handle both direct event objects and req objects
    const eventData = req.data ? req : req.body;
    const campaignId = eventData.data.id;
    const status = eventData.data.status;
    const subject = eventData.data.subject || 'No Subject';
    
    // Add breadcrumb for campaign event
    addBreadcrumb(
      'Campaign event received', 
      'webhook', 
      {
        campaignId,
        status,
        subject
      }
    );
    
    console.log(`Campaign ${campaignId} status: ${status}, subject: ${subject}`);
    
    try {
      if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX) {
        throw new Error('Mailchimp API key not configured correctly');
      }
      
      // Only process sent campaigns
      if (status !== 'sent') {
        // Add breadcrumb for non-sent campaign
        addBreadcrumb(
          'Campaign not sent, skipping processing', 
          'webhook', 
          { campaignId, status }
        );
        
        // If res is available, send response, otherwise just log
        if (res) {
          return res.json({
            success: true,
            message: `Campaign ${campaignId} status updated to ${status}`,
            processed: false
          });
        } else {
          console.log(`Campaign ${campaignId} status updated to ${status}, not processing further`);
          return {
            success: true,
            message: `Campaign ${campaignId} status updated to ${status}`,
            processed: false
          };
        }
      }
      
      // Add breadcrumb for API request
      addBreadcrumb(
        'Fetching campaign details', 
        'api.mailchimp', 
        { campaignId }
      );
      
      // Get campaign details
      console.log(`Fetching details for campaign ${campaignId}...`);
      const campaignResponse = await axios.get(
        `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/campaigns/${campaignId}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`apikey:${MAILCHIMP_API_KEY}`).toString('base64')}`
          }
        }
      );
      
      const campaign = campaignResponse.data;
      const campaignTitle = campaign.settings.title || subject || 'Untitled Campaign';
      const listId = campaign.recipients.list_id || eventData.data.list_id;
      console.log('campaign');
      let emailSubj = campaign.settings.subject_line || subject;
      let emailPreview = campaign.settings.preview_text || '';
      
      // Add breadcrumb for campaign details
      addBreadcrumb(
        'Campaign details retrieved', 
        'api.mailchimp', 
        { 
          campaignTitle, 
          listId, 
          emailSubj 
        }
      );
      
      console.log(`Processing campaign: "${campaignTitle}"`);
      
      // Add breadcrumb for recipients request
      addBreadcrumb(
        'Fetching campaign recipients', 
        'api.mailchimp', 
        { campaignId }
      );
      
      // Get campaign recipients
      console.log(`Fetching recipients for campaign ${campaignId}...`);
      const recipientsResponse = await axios.get(
        `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/reports/${campaignId}/sent-to`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`apikey:${MAILCHIMP_API_KEY}`).toString('base64')}`
          },
          params: {
            count: 1000 // Adjust based on your campaign size
          }
        }
      );
      
      const recipients = recipientsResponse.data.sent_to || [];
      console.log(`Found ${recipients.length} recipients for campaign`);
      
      // Add breadcrumb for recipients count
      addBreadcrumb(
        'Recipients retrieved', 
        'api.mailchimp', 
        { recipientCount: recipients.length }
      );
      
      // Process each recipient
      let successCount = 0;
      let notFoundCount = 0;
      let failureCount = 0;
      
      for (const recipient of recipients) {
        const email = recipient.email_address;
        
        try {
          console.log(`Processing recipient: ${email}`);
          
          // Add breadcrumb for recipient processing
          addBreadcrumb(
            'Processing recipient', 
            'monday.api', 
            { email }
          );
          
          // Find Monday.com item by email
          const mondayItem = await findMondayItemByEmail(email);
          
          if (!mondayItem) {
            console.log(`Monday.com item not found for ${email}`);
            
            // Add breadcrumb for not found
            addBreadcrumb(
              'Monday item not found', 
              'monday.api', 
              { email },
              'warning'
            );
            
            notFoundCount++;
            continue;
          }
          
          // Add breadcrumb for Monday item found
          addBreadcrumb(
            'Monday item found', 
            'monday.api', 
            { 
              email, 
              mondayItemId: mondayItem.id 
            }
          );
          
          // Add a note about the campaign
          const noteText = `📧 Email Sent: "${campaignTitle}", Subject: ${emailSubj}, Preview: ${emailPreview}, to ${email}`;
          await addNoteToMondayItem(mondayItem.id, noteText);
          
          // Increment touchpoints
          const result = await incrementTouchpoints(mondayItem.id);
          
          if (result.success) {
            console.log(`Incremented touchpoints for ${email} from ${result.previousValue} to ${result.newValue}`);
            
            // Add breadcrumb for successful update
            addBreadcrumb(
              'Touchpoints incremented', 
              'monday.api', 
              { 
                email, 
                mondayItemId: mondayItem.id,
                previousValue: result.previousValue,
                newValue: result.newValue
              }
            );
            
            successCount++;
          } else if (result.error && result.error.includes('not found')) {
            // Add breadcrumb for not found error
            addBreadcrumb(
              'Touchpoints column not found', 
              'monday.api', 
              { 
                email, 
                mondayItemId: mondayItem.id,
                error: result.error
              },
              'warning'
            );
            
            notFoundCount++;
          } else {
            // Add breadcrumb for other errors
            addBreadcrumb(
              'Failed to increment touchpoints', 
              'monday.api', 
              { 
                email, 
                mondayItemId: mondayItem.id,
                error: result.error
              },
              'error'
            );
            
            failureCount++;
          }
        } catch (error) {
          console.error(`Error processing ${email}:`, error.message);
          
          // Capture exception for individual recipient
          captureException(error, {
            email,
            campaignId,
            campaignTitle,
            context: 'Processing individual recipient'
          });
          
          failureCount++;
        }
        
        // Add a small delay to avoid overwhelming Monday.com API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('Sending Discord notification');
      
      // Add breadcrumb for Discord notification
      addBreadcrumb(
        'Sending Discord notification', 
        'discord', 
        {
          campaignId,
          campaignTitle,
          successCount,
          notFoundCount,
          failureCount
        }
      );

      // Send a summary notification
      await sendDiscordNotification(
        '📊 Campaign Recipients Processed',
        `Processed recipients for campaign "${campaignTitle}"`,
        {
          'Campaign ID': campaignId,
          'Campaign Title': campaignTitle,
          'Subject': emailSubj,
          'Total Recipients': recipients.length,
          'Successfully Updated': successCount,
          'Not Found in Monday': notFoundCount,
          'Failed Updates': failureCount
        },
        successCount > 0 ? '57F287' : 'ED4245' // Green if any success, red if all failed
      );
      
      // Create result object
      const result = {
        success: true,
        message: `Campaign ${campaignId} processed successfully`,
        campaignTitle,
        totalRecipients: recipients.length,
        successCount,
        notFoundCount,
        failureCount
      };
      
      // Finish the transaction
      if (transaction) {
        transaction.finish();
      }
      
      // If res is available, send response, otherwise just return the result
      if (res) {
        return res.json(result);
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error processing campaign:', error);
      
      // Capture the exception with context
      captureException(error, {
        campaignId,
        status,
        subject,
        context: 'Campaign processing'
      });
      
      // Send error notification
      await sendDiscordNotification(
        '❌ Failed to Process Campaign',
        'An error occurred while processing campaign recipients',
        {
          'Campaign ID': campaignId,
          'Subject': subject,
          'Error': error.message,
          'Stack Trace': error.stack?.substring(0, 300) + '...'
        },
        'ED4245' // Red color for errors
      );
      
      // Finish the transaction with error status
      if (transaction) {
        transaction.finish();
      }
      
      // Create error result
      const errorResult = {
        error: 'Failed to process campaign',
        details: error.message
      };
      
      // If res is available, send response, otherwise just return the error
      if (res) {
        return res.status(500).json(errorResult);
      } else {
        return errorResult;
      }
    }
}