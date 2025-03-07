const express = require('express');
const router = express.Router();
const mailchimp = require('@mailchimp/mailchimp_marketing');
require('dotenv').config();

// Configure the Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

// Simplified approach - just use MAILCHIMP_AUDIENCE_ID which will be loaded from the appropriate .env file
const getAudienceId = () => {
  return process.env.MAILCHIMP_AUDIENCE_ID;
};

// Check Mailchimp connection status
router.get('/', async (req, res) => {
  try {
    // Test the connection by getting account info
    const response = await mailchimp.ping.get();
    
    if (response && response.health_status === "Everything's Chimpy!") {
      // Get account information
      const accountInfo = await mailchimp.root.getRoot();
      
      // Get current audience info
      const audienceId = getAudienceId();
      let currentAudience = null;
      let subscriberCount = 0;
      
      if (audienceId) {
        try {
          currentAudience = await mailchimp.lists.getList(audienceId);
          subscriberCount = currentAudience.stats.member_count;
        } catch (err) {
          console.warn(`Could not fetch audience with ID ${audienceId}:`, err.message);
        }
      }
      
      res.json({
        connected: true,
        account: accountInfo.account_name,
        email: accountInfo.email,
        environment: process.env.NODE_ENV || 'development',
        currentAudience: currentAudience ? {
          id: currentAudience.id,
          name: currentAudience.name,
          memberCount: subscriberCount
        } : null
      });
    } else {
      res.json({
        connected: false,
        message: "Mailchimp API is not responding correctly"
      });
    }
  } catch (error) {
    console.error('Mailchimp connection error:', error.message);
    res.json({
      connected: false,
      message: error.response?.data?.detail || error.message
    });
  }
});

// Get list information
router.get('/list', async (req, res) => {
  try {
    const audienceId = getAudienceId();
    
    if (!audienceId) {
      return res.status(400).json({ 
        error: 'No Mailchimp audience ID is defined for this environment' 
      });
    }
    
    const response = await mailchimp.lists.getList(audienceId);
    
    res.json({
      id: response.id,
      name: response.name,
      memberCount: response.stats.member_count,
      unsubscribeCount: response.stats.unsubscribe_count,
      dateCreated: response.date_created,
      campaignDefaults: response.campaign_defaults,
      contactCount: response.stats.member_count + response.stats.unsubscribe_count + response.stats.cleaned_count,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error fetching list information:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp list information',
      details: error.response?.data?.detail || error.message
    });
  }
});

// Get list members (paginated)
router.get('/list/members', async (req, res) => {
  const { count = 10, offset = 0 } = req.query;
  
  try {
    const audienceId = getAudienceId();
    
    if (!audienceId) {
      return res.status(400).json({ 
        error: 'No Mailchimp audience ID is defined for this environment' 
      });
    }
    
    const response = await mailchimp.lists.getListMembersInfo(audienceId, {
      count: parseInt(count),
      offset: parseInt(offset)
    });
    
    res.json({
      totalItems: response.total_items,
      members: response.members.map(member => ({
        id: member.id,
        email: member.email_address,
        status: member.status,
        fullName: `${member.merge_fields.FNAME || ''} ${member.merge_fields.LNAME || ''}`.trim(),
        firstName: member.merge_fields.FNAME || '',
        lastName: member.merge_fields.LNAME || '',
        lastChanged: member.last_changed,
        source: member.source,
        tags: member.tags.map(tag => tag.name)
      })),
      environment: process.env.NODE_ENV || 'development',
      audienceId: audienceId
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp members',
      details: error.response?.data?.detail || error.message
    });
  }
});

// Add a single member to the list (for testing)
router.post('/list/members', async (req, res) => {
  const { email, firstName, lastName, status = 'subscribed' } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    const audienceId = getAudienceId();
    
    if (!audienceId) {
      return res.status(400).json({ 
        error: 'No Mailchimp audience ID is defined for this environment' 
      });
    }
    
    const response = await mailchimp.lists.addListMember(audienceId, {
      email_address: email,
      status: status,
      merge_fields: {
        FNAME: firstName || '',
        LNAME: lastName || ''
      }
    });
    
    res.json({
      success: true,
      member: {
        id: response.id,
        email: response.email_address,
        status: response.status,
        webId: response.web_id
      },
      environment: process.env.NODE_ENV || 'development',
      audienceId: audienceId
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ 
      error: 'Failed to add member to Mailchimp',
      details: error.response?.data?.detail || error.message
    });
  }
});

// Get campaign information for the list
router.get('/list/campaigns', async (req, res) => {
  try {
    const audienceId = getAudienceId();
    
    if (!audienceId) {
      return res.status(400).json({ 
        error: 'No Mailchimp audience ID is defined for this environment' 
      });
    }
    
    // Get campaigns for this audience
    const response = await mailchimp.campaigns.list({
      list_id: audienceId,
      sort_field: 'create_time',
      sort_dir: 'DESC',
      count: 10
    });
    
    res.json({
      totalCampaigns: response.total_items,
      campaigns: response.campaigns.map(campaign => ({
        id: campaign.id,
        webId: campaign.web_id,
        name: campaign.settings.title,
        subject: campaign.settings.subject_line,
        status: campaign.status,
        sentDate: campaign.send_time,
        openRate: campaign.report_summary ? campaign.report_summary.open_rate : null,
        clickRate: campaign.report_summary ? campaign.report_summary.click_rate : null,
        recipientCount: campaign.recipients ? campaign.recipients.recipient_count : null
      })),
      environment: process.env.NODE_ENV || 'development',
      audienceId: audienceId
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp campaigns',
      details: error.response?.data?.detail || error.message
    });
  }
});

// Get audience growth history
router.get('/list/growth-history', async (req, res) => {
  try {
    const audienceId = getAudienceId();
    
    if (!audienceId) {
      return res.status(400).json({ 
        error: 'No Mailchimp audience ID is defined for this environment' 
      });
    }
    
    const response = await mailchimp.lists.getListGrowthHistory(audienceId);
    
    res.json({
      history: response.history.map(month => ({
        month: month.month,
        year: month.year,
        existingSubscribers: month.existing,
        imports: month.imports,
        optins: month.optins,
        unsubscribes: month.unsubscribes,
        cleanedCount: month.cleaned,
        netGrowth: month.optins - month.unsubscribes
      })),
      environment: process.env.NODE_ENV || 'development',
      audienceId: audienceId
    });
  } catch (error) {
    console.error('Error fetching growth history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mailchimp growth history',
      details: error.response?.data?.detail || error.message
    });
  }
});

module.exports = router;
