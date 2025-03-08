const axios = require('axios');
const dotenv = require('dotenv');
const { sendDiscordNotification } = require('../../utils/discordNotifier');
const { findMondayItemByEmail, incrementTouchpoints, addNoteToMondayItem } = require('../../utils/mondayService');
dotenv.config();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;



exports.handleCampaignEvent = async function(req, res) {
    console.log('handleCampaignEvent');
    const campaignId = req.body.data.id;
    const status = req.body.data.status;
    
    console.log(`Campaign ${campaignId} status: ${status}`);
    
    try {
      if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX) {
        throw new Error('Mailchimp API key not configured correctly');
      }
      
      // Only process sent campaigns
      if (status !== 'sent') {
        return res.json({
          success: true,
          message: `Campaign ${campaignId} status updated to ${status}`,
          processed: false
        });
      }
      
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
      const campaignTitle = campaign.settings.title || 'Untitled Campaign';
      const listId = campaign.recipients.list_id;
      console.log('campaign');
      let emailSubj = campaign.settings.subject_line;
      let emailPreview = campaign.settings.preview_text;
      
      console.log(`Processing campaign: "${campaignTitle}"`);
      
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
      
      // Process each recipient
      let successCount = 0;
      let notFoundCount = 0;
      let failureCount = 0;
      
      for (const recipient of recipients) {
        const email = recipient.email_address;
        
        try {
          console.log(`Processing recipient: ${email}`);
          
          // Find Monday.com item by email
          const mondayItem = await findMondayItemByEmail(email);
          
          if (!mondayItem) {
            console.log(`Monday.com item not found for ${email}`);
            notFoundCount++;
            continue;
          }
          
          // Add a note about the campaign
          const noteText = `📧 Email Sent: "${campaignTitle}", Subject: ${emailSubj}, Preview: ${emailPreview}, to ${email}`;
          await addNoteToMondayItem(mondayItem.id, noteText);
          
          // Increment touchpoints
          const result = await incrementTouchpoints(mondayItem.id);
          
          if (result.success) {
            console.log(`Incremented touchpoints for ${email} from ${result.previousValue} to ${result.newValue}`);
            successCount++;
          } else if (result.error && result.error.includes('not found')) {
            notFoundCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(`Error processing ${email}:`, error.message);
          failureCount++;
        }
        
        // Add a small delay to avoid overwhelming Monday.com API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('Sending Discord notification');

      // Send a summary notification
      await sendDiscordNotification(
        '📊 Campaign Recipients Processed',
        `Processed recipients for campaign "${campaignTitle}"`,
        {
          'Campaign ID': campaignId,
          'Campaign Title': campaignTitle,
          'Total Recipients': recipients.length,
          'Successfully Updated': successCount,
          'Not Found in Monday': notFoundCount,
          'Failed Updates': failureCount
        },
        successCount > 0 ? '57F287' : 'ED4245' // Green if any success, red if all failed
      );
      
      return res.json({
        success: true,
        message: `Campaign ${campaignId} processed successfully`,
        campaignTitle,
        totalRecipients: recipients.length,
        successCount,
        notFoundCount,
        failureCount
      });
    } catch (error) {
      console.error('Error processing campaign:', error);
      
      // Send error notification
      await sendDiscordNotification(
        '❌ Failed to Process Campaign',
        'An error occurred while processing campaign recipients',
        {
          'Campaign ID': campaignId,
          'Error': error.message,
          'Stack Trace': error.stack?.substring(0, 300) + '...'
        },
        'ED4245' // Red color for errors
      );
      
      return res.status(500).json({
        error: 'Failed to process campaign',
        details: error.message
      });
    }
  }