const { executeQuery } = require('./mondayClient');
const dotenv = require('dotenv');

dotenv.config();

// Column IDs
const TOUCHPOINTS_COLUMN_ID = process.env.MONDAY_TOUCHPOINTS_COLUMN_ID || 'numeric_mknr1kvd';
const EMAIL_COLUMN_ID = process.env.EMAIL_COLUMN_ID || 'email_mknrc1cr';
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;

// Array of column IDs that might contain emails
const POTENTIAL_EMAIL_COLUMNS = ['lead_email', 'email_mknrc1cr', 'email', 'contact_email'];

// Private cache
const emailCache = new Map();

// Helper functions to work with the cache
function checkEmailCache(email) {
  return emailCache.has(email);
}

function getEmailFromCache(email) {
  return emailCache.get(email);
}

function setEmailInCache(email, value) {
  emailCache.set(email, value);
}

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
 * Find Monday.com item by email with adaptive status filtering
 * @param {string} email - The email to search for
 * @returns {Promise<Object|null>} - The matching item or null if not found
 */
async function findMondayItemByEmail(email) {
  if (!email) return null;
  
  console.log(`Finding Monday item for email: ${email}`);
  
  try {
    // Normalize the search email
    const normalizedSearchEmail = email.toLowerCase().trim();
    
    if (checkEmailCache(normalizedSearchEmail)) {
      return getEmailFromCache(normalizedSearchEmail);
    }
    
    // Define the status column ID and active statuses
    const STATUS_COLUMN_ID = 'lead_status'; // Update this to match your Monday.com board
    const ACTIVE_STATUSES = ['New', 'Working', 'Chatting', 'Tour Scheduled'];
    
    // Set up pagination variables
    const PAGE_SIZE = 100;
    let cursor = null;
    let hasMoreItems = true;
    let pageCount = 0;
    let totalItemsChecked = 0;
    
    // Track if we should continue filtering by status
    let useStatusFiltering = true;
    let consecutiveEmptyPages = 0;
    
    // Loop through pages until we find the email or run out of items
    while (hasMoreItems) {
      pageCount++;
      console.log(`Checking page ${pageCount} (cursor: ${cursor || 'initial'})`);
      
      // Query with pagination and include the status column if we're still filtering
      const columnsToFetch = useStatusFiltering 
        ? [...POTENTIAL_EMAIL_COLUMNS, STATUS_COLUMN_ID]
        : POTENTIAL_EMAIL_COLUMNS;
      
      const query = `
      query {
        boards(ids: ${MONDAY_BOARD_ID}) {
          items_page(limit: ${PAGE_SIZE}${cursor ? `, cursor: "${cursor}"` : ''}) {
            cursor
            items {
              id
              name
              column_values(ids: ${JSON.stringify(columnsToFetch)}) {
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
        console.error('Invalid response from Monday API');
        return null;
      }
      
      const itemsPage = result.data.boards[0].items_page;
      const items = itemsPage?.items || [];
      
      // Update cursor for next page
      cursor = itemsPage.cursor;
      hasMoreItems = items.length === PAGE_SIZE; // If we got a full page, there might be more
      
      totalItemsChecked += items.length;
      console.log(`Found ${items.length} items on page ${pageCount} (total checked: ${totalItemsChecked})`);
      
      // Items to check - either filtered by status or all items
      let itemsToCheck = items;
      
      // Filter items by status if we're still using status filtering
      if (useStatusFiltering) {
        const activeItems = items.filter(item => {
          const statusColumn = item.column_values.find(col => col.id === STATUS_COLUMN_ID);
          if (!statusColumn) return true; // Include if status column not found
          
          // Check if the status text is in our active statuses list
          return ACTIVE_STATUSES.some(status => 
            statusColumn.text && statusColumn.text.toLowerCase().includes(status.toLowerCase())
          );
        });
        
        console.log(`Filtered to ${activeItems.length} active items`);
        
        // If we've found no active items for 3 consecutive pages, stop filtering
        if (activeItems.length === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 3) {
            console.log(`Found no active items for ${consecutiveEmptyPages} consecutive pages. Disabling status filtering.`);
            useStatusFiltering = false;
            itemsToCheck = items; // Use all items on this page
          } else {
            itemsToCheck = activeItems; // Still use filtered items
          }
        } else {
          consecutiveEmptyPages = 0; // Reset counter if we found active items
          itemsToCheck = activeItems;
        }
      }
      
      // Check each item for the email
      for (const item of itemsToCheck) {
        // Check all columns for email values
        for (const column of item.column_values) {
          // Skip the status column
          if (column.id === STATUS_COLUMN_ID) continue;
          
          // Get email from column
          let itemEmail = '';
          
          // Try text field first
          if (column.text && column.text.includes('@')) {
            itemEmail = column.text;
          } 
          // Try value field (JSON)
          else if (column.value) {
            try {
              const parsedValue = JSON.parse(column.value);
              if (parsedValue.email) {
                itemEmail = parsedValue.email;
              } else if (parsedValue.text && parsedValue.text.includes('@')) {
                itemEmail = parsedValue.text;
              }
            } catch (e) {
              // If not JSON but contains @, use it directly
              if (column.value.includes('@')) {
                itemEmail = column.value;
              }
            }
          }
          
          // Skip if no email found
          if (!itemEmail || !itemEmail.includes('@')) continue;
          
          // Normalize and compare
          const normalizedItemEmail = itemEmail.toLowerCase().trim();
          
          if (normalizedItemEmail === normalizedSearchEmail) {
            console.log(`Found matching item: ${item.id} (${item.name}) in column ${column.id} on page ${pageCount}`);
            
            // If the matching column is not the expected EMAIL_COLUMN_ID, log a warning
            if (column.id !== EMAIL_COLUMN_ID) {
              console.warn(`Email found in column ${column.id}, but EMAIL_COLUMN_ID is set to ${EMAIL_COLUMN_ID}`);
            }
            
            setEmailInCache(normalizedSearchEmail, item);
            return item;
          }
        }
      }
      
      // If we've checked a lot of items without finding a match, log a warning
      if (totalItemsChecked >= 1000 && pageCount % 5 === 0) {
        console.warn(`Checked ${totalItemsChecked} items without finding a match. Still searching...`);
      }
      
      // Avoid rate limiting
      if (hasMoreItems) {
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms pause between requests
      }
    }
    
    // If we get here, we've checked all items and found no match
    console.error(`No Monday item found with email: ${email} after checking ${totalItemsChecked} items`);
    return null;
    
  } catch (error) {
    console.error(`Error finding Monday item by email ${email}:`, error.message);
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
 * Get all contacts with detailed column values using pagination
 * @param {number} maxItems - Maximum number of items to retrieve (0 for all)
 * @returns {Promise<Array>} - Array of contacts with all column values
 */
async function getAllMondayContacts(maxItems = 0) {
  try {
    const PAGE_SIZE = 100;
    let cursor = null;
    let hasMoreItems = true;
    let allItems = [];
    
    while (hasMoreItems && (maxItems === 0 || allItems.length < maxItems)) {
      const query = `
        query {
          boards(ids: ${MONDAY_BOARD_ID}) {
            items_page(limit: ${PAGE_SIZE}${cursor ? `, cursor: "${cursor}"` : ''}) {
              cursor
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
        break;
      }
      
      const itemsPage = result.data.boards[0].items_page;
      const items = itemsPage?.items || [];
      
      // Update cursor for next page
      cursor = itemsPage.cursor;
      hasMoreItems = items.length === PAGE_SIZE;
      
      // Add items to our collection
      allItems = [...allItems, ...items];
      
      console.log(`Fetched ${items.length} items (total: ${allItems.length})`);
      
      // If we have a maximum and have reached it, stop
      if (maxItems > 0 && allItems.length >= maxItems) {
        allItems = allItems.slice(0, maxItems);
        break;
      }
      
      // Avoid rate limiting
      if (hasMoreItems) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return allItems;
  } catch (error) {
    console.error('Error fetching all Monday contacts:', error.message);
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
  EMAIL_COLUMN_ID,
  emailCache,
  checkEmailCache,
  getEmailFromCache,
  setEmailInCache
};