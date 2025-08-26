const axios = require('axios');
const dotenv = require('dotenv');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
const Sentry = require('@sentry/node');
const logger = require('../../utils/logger');
dotenv.config();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;

exports.handleCampaignEvent = async function(req, res) {
    logger.info('handleCampaignEvent called', {
      campaignId: req.data.id,
      status: req.data.status,
      subject: req.data.subject,
      endpoint: '/api/webhook/handle-campaign-event'
    });
    let span = null;
    
    try {
      // Start a Sentry span (no callback in v9.x)
      span = Sentry.startSpan({
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

        Sentry.addBreadcrumb({
          category: 'webhook',
          message: 'Campaign event received',
          level: 'info',
          data: {
          campaignId: campaignId,
          status: status,
          subject: subject,
          eventData: eventData
          }
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
      Sentry.addBreadcrumb({
        category: 'webhook',
        message: 'Campaign event received',
        level: 'info',
        data: {
          campaignId,
          status,
          subject
        }
      });
      
      console.log(`Campaign ${campaignId} status: ${status}, subject: ${subject}`);
      
      if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX) {
        throw new Error('Mailchimp API key not configured correctly');
      }
      
      // Only process sent campaigns
      if (status !== 'sent') {
        // Add breadcrumb for non-sent campaign
        Sentry.addBreadcrumb({
          category: 'webhook',
          message: 'Campaign not sent, skipping processing',
          level: 'info',
          data: { campaignId, status }
        });
        
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
      Sentry.addBreadcrumb({
        category: 'api.mailchimp',
        message: 'Fetching campaign details',
        level: 'info',
        data: { campaignId }
      });
      
      const campaign = campaignResponse.data;
      const campaignTitle = campaign.settings.title || subject || 'Untitled Campaign';
      const listId = campaign.recipients.list_id || eventData.data.list_id;
      console.log('campaign');
      let emailSubj = campaign.settings.subject_line || subject;
      let emailPreview = campaign.settings.preview_text || '';
      
      console.log(`Processing campaign: "${campaignTitle}"`);
      
      // Add breadcrumb for recipients request
      Sentry.addBreadcrumb({
        category: 'api.mailchimp',
        message: 'Fetching campaign recipients',
        level: 'info',
        data: { campaignId }
      });
      
      // Create a child span for recipients API request
      const recipientsSpan = span ? Sentry.startSpan({
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
      Sentry.addBreadcrumb({
        category: 'api.mailchimp',
        message: 'Recipients retrieved',
        level: 'info',
        data: { recipientCount: recipients.length }
      });
      
      // Create a child span for processing recipients
      const processingSpan = span ? Sentry.startSpan({
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
          Sentry.addBreadcrumb({
            category: 'monday.api',
            message: 'Processing recipient',
            level: 'info',
            data: { email }
          });
          
          // Find Monday.com item by email
          const mondayItem = await findMondayItemByEmail(email);
          
          if (!mondayItem) {
            console.log(`Monday.com item not found for ${email}`);
            
            // Add breadcrumb for not found
            Sentry.addBreadcrumb({
              category: 'monday.api',
              message: 'Monday item not found',
              level: 'warning',
              data: { email }
            });
            
            notFoundCount++;
            continue;
          }
          
          logger.info('Monday item found', {
            email,
            mondayItemId: mondayItem.id
          });

          // Add breadcrumb for Monday item found
          Sentry.addBreadcrumb({
            category: 'monday.api',
            message: 'Monday item found',
            level: 'info',
            data: { 
              email, 
              mondayItemId: mondayItem.id 
            }
          });
          
          // Add a note about the campaign
          const noteText = `📧 Email Sent: "${campaignTitle}", Subject: ${emailSubj}, Preview: ${emailPreview}, to ${email}`;
          await addNoteToMondayItem(mondayItem.id, noteText);
          
          // Increment touchpoints
          const result = await incrementTouchpoints(mondayItem.id);
          
          if (result.success) {
            console.log(`Incremented touchpoints for ${email} from ${result.previousValue} to ${result.newValue}`);
            
            // Add breadcrumb for successful update
            Sentry.addBreadcrumb({
              category: 'monday.api',
              message: 'Touchpoints incremented',
              level: 'info',
              data: { 
                email, 
                mondayItemId: mondayItem.id,
                previousValue: result.previousValue,
                newValue: result.newValue
              }
            });
            
            successCount++;
          } else if (result.error && result.error.includes('not found')) {
            // Add breadcrumb for not found error
            Sentry.addBreadcrumb({
              category: 'monday.api',
              message: 'Touchpoints column not found',
              level: 'warning',
              data: { 
                email, 
                mondayItemId: mondayItem.id,
                error: result.error
              },
            });
            
            notFoundCount++;
          } else {
            Sentry.captureException(result.error, {
              context: 'Failed to increment touchpoints',
              email,
              mondayItemId: mondayItem.id,
              campaignId,
              campaignTitle
            });
            // Add breadcrumb for other errors
            Sentry.addBreadcrumb({
              category: 'monday.api',
              message: 'Failed to increment touchpoints',
              level: 'error',
              data: { 
                email, 
                mondayItemId: mondayItem.id,
                error: result.error
              },
            });
            
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
  
      
      // Create error result
      const errorResult = {
        error: 'Failed to process campaign',
        details: error.message,
        campaignId: campaignId
      };
      logger.error('Error processing campaign:', errorResult);
      // If res is available, send response, otherwise just return the error
      return res.status(500).json(errorResult);
    }
}