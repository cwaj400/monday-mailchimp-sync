const express = require('express');
const router = express.Router();
const { syncMondayToMailchimp, getMondayContacts, syncSingleContact } = require('../utils/syncService');
const { checkAndUpdateTouchpoints } = require('../services/cronService');

// Trigger a full sync between Monday.com and Mailchimp
router.post('/', async (req, res) => {
  try {
    console.log('Starting sync process...');
    const result = await syncMondayToMailchimp();
    
    res.json({
      success: true,
      message: `Successfully synced ${result.synced} contacts`,
      data: result
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync contacts',
      error: error.message
    });
  }
});

// Get sync status and history
router.get('/', async (req, res) => {
    // This is a placeholder - in a production app, you would store sync history in a database
    res.json({
      lastSync: null,
      status: 'No sync history available',
      syncHistory: []
    });
  });

// Preview what will be synced without actually syncing
router.get('/preview', async (req, res) => {
  try {
    const contacts = await getMondayContacts();
    
    // Map contacts to a more readable format
    const preview = contacts.map(contact => {
      const emailColumn = contact.column_values.find(col => 
        col.title.toLowerCase().includes('email'));
      const touchpointsColumn = contact.column_values.find(col => 
        col.title.toLowerCase().includes('touchpoints'));
      
      return {
        id: contact.id,
        name: contact.name,
        email: emailColumn ? emailColumn.text : 'No email',
        currentTouchpoints: touchpointsColumn ? touchpointsColumn.text : '0'
      };
    });
    
    res.json({
      totalContacts: contacts.length,
      preview: preview
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sync preview',
      error: error.message
    });
  }
});

// Sync a single contact
router.post('/contact/:itemId', async (req, res) => {
  const { itemId } = req.params;
  
  try {
    const result = await syncSingleContact(itemId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing contact:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Schedule a sync (placeholder - would require a job scheduler like node-cron)
router.post('/schedule', (req, res) => {
  const { frequency } = req.body; // e.g., 'hourly', 'daily', 'weekly'
  
  res.json({
    success: true,
    message: `Sync scheduled with frequency: ${frequency}`,
    note: "This is a placeholder. Implement with node-cron or similar for actual scheduling."
  });
});

// Manually trigger touchpoint update check
router.post('/check-touchpoints', async (req, res) => {
  try {
    console.log('Starting manual touchpoint check...');
    // Start the check in the background
    checkAndUpdateTouchpoints()
      .then(() => console.log('Manual touchpoint check completed'))
      .catch(err => console.error('Error in manual touchpoint check:', err));
    
    // Immediately return success response
    res.json({
      success: true,
      message: 'Touchpoint check started in the background'
    });
  } catch (error) {
    console.error('Error starting touchpoint check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start touchpoint check',
      details: error.message
    });
  }
});

module.exports = router; 