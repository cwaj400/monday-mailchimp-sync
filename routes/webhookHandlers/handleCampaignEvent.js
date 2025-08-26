const axios = require('axios');
const dotenv = require('dotenv');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
const { captureException, addBreadcrumb, startSpan, Sentry } = require('../../utils/sentry');
dotenv.config();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;

exports.handleCampaignEvent = async function(req, res) {
    console.info('handleCampaignEvent');
    let span = null;
    
    try {
      // Start a Sentry span (no callback in v9.x)
      span = startSpan({
        name: 'handleCampaignEvent',
        op: 'webhook.campaign',
        attributes: {
          campaignId: req.data.id,
          status: req.data.status,
          subject: req.data.subject
        }
      });

      let campaignId = null;
      let status = null;
      let subject = null;
      
      try {
        console.log('req', req);
        const eventData = req.data ? req : req.body;
        campaignId = eventData.data.id;
        status = eventData.data.status;
        subject = eventData.data.subject || 'No Subject';

        addBreadcrumb('Campaign event received', 'webhook', {
          campaignId: campaignId,
          status: status,
          subject: subject,
          eventData: eventData
        });
        

      } catch (error) {
        console.error('Error in handleCampaignEvent:', error.message);
        if (span) {
          Sentry.captureException(error.message, {
            level: 'error',
            extra: {
              campaignId: campaignId,
              status: status,
              subject: subject,
              error: error.message
            }
          });
          span.end();
        }
        captureException(error, {
          context: 'handleCampaignEvent'
        });

      }

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
          if (span) span.end();
          return res.json({
            success: true,
            message: `Campaign ${campaignId} status updated to ${status}`,
            processed: false
          });
        } else {
          console.log(`Campaign ${campaignId} status updated to ${status}, not processing further`);
          if (span) span.end();
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
      
      const campaign = campaignResponse.data;
      const campaignTitle = campaign.settings.title || subject || 'Untitled Campaign';
      const listId = campaign.recipients.list_id || eventData.data.list_id;
      console.log('campaign');
      let emailSubj = campaign.settings.subject_line || subject;
      let emailPreview = campaign.settings.preview_text || '';
      
      console.log(`Processing campaign: "${campaignTitle}"`);
      
      // Add breadcrumb for recipients request
      addBreadcrumb(
        'Fetching campaign recipients', 
        'api.mailchimp', 
        { campaignId }
      );
      
      // Create a child span for recipients API request
      const recipientsSpan = span ? startSpan({
        name: 'fetch_campaign_recipients',
        op: 'http.client',
        attributes: { campaignId }
      }) : null;
      
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
      
      if (recipientsSpan) recipientsSpan.end();
      
      const recipients = recipientsResponse.data.sent_to || [];
      console.log(`Found ${recipients.length} recipients for campaign`);
      
      // Add breadcrumb for recipients count
      addBreadcrumb(
        'Recipients retrieved', 
        'api.mailchimp', 
        { recipientCount: recipients.length }
      );
      
      // Create a child span for processing recipients
      const processingSpan = span ? startSpan({
        name: 'process_recipients',
        op: 'task',
        attributes: { 
          recipientCount: recipients.length,
          campaignTitle
        }
      }) : null;
      
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
      
      if (processingSpan) processingSpan.end();
      
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
      
      // Finish the span
      if (span) {
        span.end();
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
        context: 'Campaign processing',
        campaignId: campaignId,
        status: status,
        subject: subject
      });
      
      // Set tags for easier filtering in Sentry dashboard
      Sentry.setTag('error.context', 'Campaign processing');
      Sentry.setTag('campaignId', campaignId || 'unknown');
      
      // Send error notification
      await sendDiscordNotification(
        '❌ Failed to Process Campaign',
        'An error occurred while processing campaign recipients',
        {
          'Campaign ID': campaignId || 'unknown',
          'Subject': subject || 'unknown',
          'Error': error.message,
          'Stack Trace': error.stack?.substring(0, 300) + '...'
        },
        'ED4245' // Red color for errors
      );
      
      // Finish the span with error status
      if (span) {
        span.setStatus({ code: Sentry.SpanStatusType.ERROR });
        // Add error details to span
        span.setAttribute('error', true);
        span.setAttribute('error.message', error.message);
        span.setAttribute('error.type', error.name);
        span.end();
      }
      
      // Create error result
      const errorResult = {
        error: 'Failed to process campaign',
        details: error.message,
        campaignId: campaignId
      };
      
      // If res is available, send response, otherwise just return the error
      if (res) {
        return res.status(500).json(errorResult);
      } else {
        return errorResult;
      }
    }
}