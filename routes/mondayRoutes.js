const express = require('express');
const { getMondayLeads, updateTouchpoints } = require('../controllers/mondayController');
const { handleMondayWebhook } = require('../controllers/mondayController');
const { validateMondayWebhook } = require('../controllers/mondayController');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');

router.get('/getLeads', getMondayLeads);
router.post('/updateTouchpoints', updateTouchpoints);

router.post('/webhook', validateMondayWebhook, handleMondayWebhook);

// Check Monday.com connection status
router.get('/', async (req, res) => {
  try {
    // Simple query to test the connection
    const query = `
      query {
        me {
          id
          name
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (result.data && result.data.me) {
      res.json({
        connected: true,
        user: result.data.me.name,
        userId: result.data.me.id
      });
    } else {
      res.json({
        connected: false,
        message: 'Could not retrieve user information'
      });
    }
  } catch (error) {
    console.error('Monday.com connection error:', error);
    res.json({
      connected: false,
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Get board information
router.get('/board/:boardId', async (req, res) => {
  const { boardId } = req.params;
  
  try {
    const query = `
      query {
        boards(ids: ${boardId}) {
          id
          name
          description
          state
          board_kind
          columns {
            id
            title
            type
            settings_str
          }
          groups {
            id
            title
          }
          items_count
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    res.json(result.data.boards[0]);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ 
      error: 'Failed to fetch board information',
      details: error.response?.data || error.message
    });
  }
});

// Get items from a board
router.get('/board/:boardId/items', async (req, res) => {
  const { boardId } = req.params;
  const { limit = 100 } = req.query;
  
  try {
    // Use items_page with only the limit parameter
    const query = `
      query {
        boards(ids: ${boardId}) {
          items_page(limit: ${limit}) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
                type
              }
              created_at
              updated_at
            }
          }
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Extract items from the correct path in the response
    const items = result.data.boards[0].items_page?.items || [];
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching board items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch board items',
      details: error.response?.data || error.message
    });
  }
});

// Update touchpoints for an item
router.post('/item/:itemId/increment-touchpoints', async (req, res) => {
  const { itemId } = req.params;
  const { columnId } = req.body;
  
  if (!columnId) {
    return res.status(400).json({ error: 'Column ID is required' });
  }
  
  try {
    // First, get the current touchpoints value
    const getItemQuery = `
      query {
        items(ids: ${itemId}) {
          column_values(ids: ["${columnId}"]) {
            id
            text
            value
          }
        }
      }
    `;
    
    const itemResult = await executeQuery(getItemQuery);
    
    if (!itemResult.data || !itemResult.data.items || itemResult.data.items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Extract current touchpoints value
    const columnValue = itemResult.data.items[0].column_values[0];
    let currentTouchpoints = 0;
    
    if (columnValue && columnValue.text) {
      currentTouchpoints = parseInt(columnValue.text) || 0;
    }
    
    // Increment touchpoints by 1
    const newTouchpoints = currentTouchpoints + 1;
    
    // Update the touchpoints value
    const updateQuery = `
      mutation {
        change_simple_column_value(
          item_id: ${itemId}, 
          board_id: ${process.env.MONDAY_BOARD_ID}, 
          column_id: "${columnId}", 
          value: "${newTouchpoints}"
        ) {
          id
        }
      }
    `;
    
    const updateResult = await executeQuery(updateQuery);
    
    if (updateResult.data && updateResult.data.change_simple_column_value) {
      res.json({
        success: true,
        message: `Touchpoints updated from ${currentTouchpoints} to ${newTouchpoints}`,
        newValue: newTouchpoints
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to update touchpoints',
        details: updateResult.data?.errors || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error updating touchpoints:', error);
    res.status(500).json({ 
      error: 'Failed to update touchpoints',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;
