const { executeQuery } = require('./mondayClient');
const dotenv = require('dotenv');

dotenv.config();

// Column IDs
const TOUCHPOINTS_COLUMN_ID = process.env.MONDAY_TOUCHPOINTS_COLUMN_ID || 'numeric_mknr1kvd';
const EMAIL_COLUMN_ID = process.env.MONDAY_EMAIL_COLUMN_ID || 'email_mknrc1cr';
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;


async function addNoteToMondayItem(itemId, note) {
    try {

        const item = await getMondayItem(itemId);
        if (!item) {
            return { 
              success: false, 
              error: 'Item not found' 
            };
          }

              // Update touchpoints value
    const updateQuery = `
    mutation {
      create_update(
        item_id: ${itemId},
        body: "${note.replace(/"/g, '\\"')}"
      ) {
        id
      }
    }
  `;
  
  const results = await executeQuery(updateQuery);
  
  if (results.data && results.data.create_update) {
    return {
      success: true,
      updateId: results.data.create_update.id
        };
    }
    } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
}
/**
 * Increment touchpoints for an item
 * @param {string|number} itemId - The Monday.com item ID
 * @param {number} [currentTouchpoints] - Current touchpoints value (optional)
 * @returns {Promise<Object>} - Result of the operation
 */
async function incrementTouchpoints(itemId, currentTouchpoints = null) {
  try {
    // If current touchpoints not provided, get current value
    if (currentTouchpoints === null) {
      const item = await getMondayItem(itemId);
      
      if (!item) {
        return { 
          success: false, 
          error: 'Item not found' 
        };
      }
      
      const touchpointsColumn = item.column_values.find(col => col.id === TOUCHPOINTS_COLUMN_ID);
      currentTouchpoints = touchpointsColumn?.text ? parseInt(touchpointsColumn.text) : 0;
    }
    
    const newTouchpoints = currentTouchpoints + 1;
    
    // Update touchpoints value
    const updateQuery = `
      mutation {
        change_simple_column_value(
          item_id: ${itemId}, 
          board_id: ${MONDAY_BOARD_ID}, 
          column_id: "${TOUCHPOINTS_COLUMN_ID}", 
          value: "${newTouchpoints}"
        ) {
          id
        }
      }
    `;
    
    const updateResult = await executeQuery(updateQuery);
    
    if (updateResult.data && updateResult.data.change_simple_column_value) {
      return {
        success: true,
        previousValue: currentTouchpoints,
        newValue: newTouchpoints
      };
    } else {
      return { 
        success: false, 
        error: 'Failed to update touchpoints',
        previousValue: currentTouchpoints
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get a single Monday.com item by ID
 * @param {string|number} itemId - The Monday.com item ID
 * @returns {Promise<Object|null>} - The item or null if not found
 */
async function getMondayItem(itemId) {
  try {
    const query = `
      query {
        items(ids: ${itemId}) {
          column_values {
            id
            text
            value
          }
        }
      }
    `;
    
    const result = await executeQuery(query);
    if (!result.data || !result.data.items || result.data.items.length === 0) {
      return null;
    }
    
    return result.data.items[0];
  } catch (error) {
    return null;
  }
}

/**
 * Find Monday.com item by email
 * @param {string} email - The email to search for
 * @returns {Promise<Object|null>} - The matching item or null if not found
 */
async function findMondayItemByEmail(email) {
  if (!email) return null;
  
  console.log('findMondayItemByEmail');
  try {
    // Query to find items with matching email
    const query = `
    query {
      boards(ids: ${MONDAY_BOARD_ID}) {
        items_page(limit: 100) {
          items {
            id
            name
            column_values(ids: ["${EMAIL_COLUMN_ID}", "${TOUCHPOINTS_COLUMN_ID}"]) {
              id
              text
              value
              type
            }
          }
        }
      }
    }
  `;
    const result = await executeQuery(query);
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      return null;
    }
    
    const items = result.data.boards[0].items_page?.items || [];
    
    // Find item with matching email
    const matchingItem = items.find(item => {
      const emailColumn = item.column_values.find(col => col.id === EMAIL_COLUMN_ID);
      if (!emailColumn || !emailColumn.text) return false;
      
      // Compare emails (case insensitive)
      return emailColumn.text.toLowerCase() === email.toLowerCase();
    });
    
    return matchingItem;
  } catch (error) {
    console.log(error.message);
    return null;
  }
}

/**
 * Get all contacts from Monday.com
 * @returns {Promise<Array>} - Array of contacts with email and touchpoints
 */
async function getMondayContacts() {
  try {
    const query = `
      query {
        boards(ids: ${MONDAY_BOARD_ID}) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${EMAIL_COLUMN_ID}", "${TOUCHPOINTS_COLUMN_ID}"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const result = await executeQuery(query);
    
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      return [];
    }
    
    const items = result.data.boards[0].items_page?.items || [];
    
    // Format the contacts
    return items.map(item => {
      const emailColumn = item.column_values.find(col => col.id === EMAIL_COLUMN_ID);
      const touchpointsColumn = item.column_values.find(col => col.id === TOUCHPOINTS_COLUMN_ID);
      
      return {
        id: item.id,
        name: item.name,
        email: emailColumn?.text || '',
        touchpoints: touchpointsColumn?.text ? parseInt(touchpointsColumn.text) : 0
      };
    }).filter(contact => contact.email); // Only include contacts with email
  } catch (error) {
    return [];
  }
}

/**
 * Get all contacts with detailed column values
 * @returns {Promise<Array>} - Array of contacts with all column values
 */
async function getAllMondayContacts() {
  try {
    const query = `
      query {
        boards(ids: ${MONDAY_BOARD_ID}) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const result = await executeQuery(query);

    
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      return [];
    }
    
    return result.data.boards[0].items_page?.items || [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  incrementTouchpoints,
  getMondayItem,
  findMondayItemByEmail,
  getMondayContacts,
  addNoteToMondayItem,
  getAllMondayContacts,
  TOUCHPOINTS_COLUMN_ID,
  EMAIL_COLUMN_ID
};