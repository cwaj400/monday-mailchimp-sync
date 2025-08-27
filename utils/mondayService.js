const { executeQuery } = require('./mondayClient');
const dotenv = require('dotenv');
const { logger } = require('./logger');
const Sentry = require('@sentry/node');

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

  logger.info('findMondayItemByEmail called', {
    email: email,
    endpoint: '/api/monday/find-by-email'
  });

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

/**
 * Get detailed information about a Monday.com item
 * @param {string|number} itemId - The Monday.com item ID
 * @returns {Promise<Object|null>} - Item details or null if not found
 * 
 * NOTE: This function is kept for reference but is no longer used in webhook processing.
 * We now extract data directly from webhook payload for better performance.
 * 
 * For future Monday.com API queries, use the items_page approach:
 * 
 * query {
 *   boards(ids: [BOARD_ID]) {
 *     items_page {
 *       cursor
 *       items {
 *         id
 *         name
 *         column_values {
 *           id
 *           text
 *           value
 *           type
 *         }
 *       }
 *     }
 *   }
 * }
 */
async function getMondayItemDetails(itemId) {
  logger.info('getMondayItemDetails called', {
    itemId: itemId,
    function: 'getMondayItemDetails'
  });
  try {
    const query = `
      query {
        items(ids: ["${itemId}"]) {
          id
          name
          column_values {
            id
            text
            value
            type
          }
        }
      }
    `;

    logger.info('Executing query', {
      query: query,
      itemId: itemId,
      function: 'getMondayItemDetails'
    });
    
    let result = await executeQuery(query);
    
    logger.info('Query result received', {
      hasData: !!result?.data,
      hasItems: !!result?.data?.items,
      itemCount: result?.data?.items?.length || 0,
      itemId: itemId,
      boardId: process.env.MONDAY_BOARD_ID,
      function: 'getMondayItemDetails'
    });
    

    
    if (result.data && result.data.items && result.data.items.length > 0) {
      logger.info('Executed query successfully', {
        itemId: itemId,
        result: result.data,
        function: 'getMondayItemDetails'
      });
      const item = result.data.items[0];

      
      // Add title field to column_values for compatibility
      if (item.column_values) {
        item.column_values = item.column_values.map(col => ({
          ...col,
          title: getColumnTitle(col.id, col.type)
        }));
      }

      logger.info('Add title field to column_values for compatibility', {
        itemId: itemId,
        item: item,
        function: 'getMondayItemDetails'
      });
      
      return item;
    }
    
    console.warn(`No item found with ID: ${itemId}`);
    return null;
  } catch (error) {
    console.error('Error getting Monday.com item details:', error);
    return null;
  }
}

/**
 * Query board items using Monday.com's items_page API (for future use)
 * @param {number} boardId - The Monday.com board ID
 * @param {string} cursor - Optional cursor for pagination
 * @returns {Promise<Object>} - Board items with cursor for pagination
 */
async function getBoardItems(boardId, cursor = null) {
  try {
    let query;
    if (cursor) {
      // Use next_items_page for pagination
      query = `
        query {
          next_items_page(cursor: "${cursor}") {
            cursor
            items {
              id
              name
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      `;
    } else {
      // Use items_page for first page
      query = `
        query {
          boards(ids: [${boardId}]) {
            items_page {
              cursor
              items {
                id
                name
                column_values {
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
    }

    logger.info('Executing board items query', {
      boardId: boardId,
      cursor: cursor,
      function: 'getBoardItems'
    });
    
    const result = await executeQuery(query);
    
    if (cursor) {
      return result?.data?.next_items_page || { cursor: null, items: [] };
    } else {
      return result?.data?.boards?.[0]?.items_page || { cursor: null, items: [] };
    }
  } catch (error) {
    logger.error('Error querying board items:', error);
    return { cursor: null, items: [] };
  }
}

/**
 * Get column title from column ID and type
 * @param {string} columnId - Column ID
 * @param {string} columnType - Column type
 * @returns {string} - Column title
 */
function getColumnTitle(columnId, columnType) {
  // Common column ID to title mappings
  const columnMappings = {
    // Email columns
    'lead_email': 'Email',
    'email_mknrc1cr': 'Email',
    'email_1__1': 'Email 2',
    'email': 'Email',
    'contact_email': 'Email',
    
    // Name columns
    'text3__1': 'First Name',
    'text2__1': 'Last Name',
    'text_1__1': 'Partner First',
    'text_11__1': 'Partner Last',
    'text': 'First Name',
    'text1': 'Last Name',
    
    // Contact columns
    'lead_phone': 'Phone',
    'phone': 'Phone',
    'phone1': 'Phone',
    'phone2': 'Mobile',
    
    // Status and dropdown columns
    'lead_status': 'Status',
    'lead_owner': 'Owner',
    'dropdown1__1': 'Lead Source',
    'dropdown__1': 'Event Type',
    'dropdown8__1': 'Pricing Shared',
    'dropdown3__1': 'Lead Type',
    
    // Date columns
    'date__1': 'Berwick Contact Date',
    'date0__1': 'Tentative Event Date',
    'date3__1': 'Last Emailed On',
    'date_1__1': 'Contacted On',
    
    // Other columns
    'numbers0__1': 'How many people',
    'numbers8__1': 'Touchpoints',
    'long_text': 'Notes',
    'text8__1': 'Text',
    'text77__1': 'Dead Reason',
    'timeline0__1': 'Date',
    
    // Legacy mappings
    'text2': 'Company',
    'text3': 'Website',
    'text4': 'Address',
    'text5': 'Notes',
    'status': 'Status',
    'status1': 'Lead Status',
    'status2': 'Deal Status',
    'person': 'Owner',
    'person1': 'Assigned To',
    'person2': 'Contact Person',
    'numeric': 'Amount',
    'numeric1': 'Value',
    'numeric2': 'Budget',
    'numeric_mknr1kvd': 'Touchpoints'
  };
  
  // Try to get title from mappings
  if (columnMappings[columnId]) {
    return columnMappings[columnId];
  }
  
  // Fallback to column type
  return columnType || 'Unknown';
}

/**
 * Extract email from Monday.com item with comprehensive validation
 * @param {Object} item - Monday.com item object
 * @returns {string|null} - Email address or null if not found
 */
function extractEmailFromItem(item) {
  if (!item || !item.column_values) {
    Sentry.addBreadcrumb({
      category: 'email.extraction',
      message: 'No item or column values for email extraction',
      level: 'warning',
      data: { 
        hasItem: !!item,
        hasColumnValues: !!item?.column_values,
        itemId: item?.id
      }
    });
    return null;
  }
  
  // Array of possible email column IDs and titles (in order of preference)
  const emailColumns = [
    'email_mknrc1cr', // Your current email column ID
    'lead_email',
    'email',
    'contact_email',
    'Email',
    'email_address',
    'customer_email',
    'client_email'
  ];
  
  // First try to find by column ID (exact match)
  for (const columnId of emailColumns) {
    const column = item.column_values.find(col => col.id === columnId);
    if (column) {
      const email = extractEmailFromColumn(column);
      if (email) {
        console.log(`Found email in column ID ${columnId}: ${email}`);
        
        Sentry.addBreadcrumb({
          category: 'email.extraction',
          message: 'Email found by column ID',
          level: 'info',
          data: { 
            columnId: columnId,
            email: email,
            itemId: item.id
          }
        });
        
        return email;
      }
    }
  }
  
  // Then try to find by column title (partial match)
  for (const columnTitle of emailColumns) {
    const column = item.column_values.find(col => 
      col.title && col.title.toLowerCase().includes('email')
    );
    if (column) {
      logger.info('Found email in column title', {
        columnTitle: column.title,
        columnId: column.id,
        email: email,
        itemId: item.id
      });

      const email = extractEmailFromColumn(column);
      if (email) {
        console.log(`Found email in column title "${column.title}": ${email}`);
        
        Sentry.addBreadcrumb({
          category: 'email.extraction',
          message: 'Email found by column title',
          level: 'info',
          data: { 
            columnTitle: column.title,
            columnId: column.id,
            email: email,
            itemId: item.id
          }
        });
        
        return email;
      }
    }
  }
  
  // Finally, scan all columns for any email-like content
  for (const column of item.column_values) {
    const email = extractEmailFromColumn(column);
    if (email) {
      console.log(`Found email in column "${column.title}" (ID: ${column.id}): ${email}`);
      
      Sentry.addBreadcrumb({
        category: 'email.extraction',
        message: 'Email found by scanning all columns',
        level: 'info',
        data: { 
          columnTitle: column.title,
          columnId: column.id,
          email: email,
          itemId: item.id
        }
      });
      
      return email;
    }
  }
  
  console.warn(`No valid email found in item ${item.id} (${item.name})`);
  
  Sentry.addBreadcrumb({
    category: 'email.extraction',
    message: 'No valid email found in item',
    level: 'warning',
    data: { 
      itemId: item.id,
      itemName: item.name,
      columnCount: item.column_values.length,
      columnIds: item.column_values.map(col => col.id),
      columnTitles: item.column_values.map(col => col.title)
    }
  });
  
  return null;
}

/**
 * Extract email from a single column with validation
 * @param {Object} column - Monday.com column object
 * @returns {string|null} - Email address or null if not valid
 */
function extractEmailFromColumn(column) {
  if (!column) return null;
  
  let emailText = '';
  
  // Try different field types based on column type
  switch (column.type) {
    case 'email':
      // Email column type - check text field
      emailText = column.text || '';
      break;
      
    case 'person':
      // Person column type - check value field for email
      if (column.value) {
        try {
          const parsedValue = JSON.parse(column.value);
          emailText = parsedValue.email || parsedValue.text || '';
        } catch (e) {
          emailText = column.value;
        }
      }
      break;
      
    case 'text':
    case 'text_with_label':
      // Text column type - check text field
      emailText = column.text || '';
      break;
      
    default:
      // Try both text and value fields
      emailText = column.text || '';
      if (!emailText && column.value) {
        try {
          const parsedValue = JSON.parse(column.value);
          emailText = parsedValue.email || parsedValue.text || '';
        } catch (e) {
          emailText = column.value;
        }
      }
  }
  
  // Clean and validate the email
  return validateAndCleanEmail(emailText);
}

/**
 * Validate and clean email address
 * @param {string} email - Raw email address
 * @returns {string|null} - Cleaned email or null if invalid
 */
function validateAndCleanEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  // Remove whitespace and convert to lowercase
  const cleanEmail = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(cleanEmail)) {
    return null;
  }
  
  // Check for common invalid patterns
  const invalidPatterns = [
    /^test@/i,
    /@example\./i,
    /@localhost/i,
    /@test\./i,
    /^admin@/i,
    /^noreply@/i,
    /^no-reply@/i,
    /^info@/i,
    /^contact@/i,
    /^hello@/i,
    /^hi@/i
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(cleanEmail)) {
      console.warn(`Skipping email with invalid pattern: ${cleanEmail}`);
      return null;
    }
  }
  
  return cleanEmail;
}

/**
 * Process Monday.com webhook for item creation
 * @param {Object} webhookData - Monday.com webhook data
 * @returns {Promise<Object>} - Result of processing
 */
async function processMondayWebhook(webhookData) {
  
  logger.info('processMondayWebhook called - DO WE NEED TO CALL BACK TO MONDAY?', {
    webhookData: webhookData,
    endpoint: '/api/monday/process-webhook'
  });
  // Monday.com webhook structure: { event: { type, pulseId, boardId, ... } }
  const event = webhookData.event;


  try { 
    
    // Add breadcrumb for webhook received
    Sentry.addBreadcrumb({
      category: 'webhook.monday',
      message: 'Monday.com webhook received',
      level: 'info',
      data: {
        eventType: event?.type,
        boardId: event?.boardId,
        pulseId: event?.pulseId,
        webhookDataKeys: Object.keys(webhookData)
      }
    });

    
    // Only process item creation events (Monday.com uses 'create_pulse' for item creation)
    if (event?.type !== 'create_item' && event?.type !== 'create_pulse') {
      logger.info('Skipping non-item-creation event:', {
        eventType: event?.type,
        endpoint: '/api/monday/process-webhook'
      });
      console.log('Skipping non-item-creation event:', event?.type);
      
      Sentry.addBreadcrumb({
        category: 'webhook.monday',
        message: 'Skipped non-item-creation event',
        level: 'info',
        data: { eventType: event?.type }
      });
      
      return { success: false, reason: 'Not an item creation event' };
    }
    
    // Extract item ID from the event (Monday.com uses pulseId for item ID)
    const actualItemId = event?.pulseId;
    
    logger.info('Extracted item ID from webhook', {
      pulseId: event?.pulseId,
      itemId: event?.itemId,
      actualItemId: actualItemId,
      eventType: event?.type,
      boardId: event?.boardId,
      function: 'processMondayWebhook'
    });
    
    if (!actualItemId) {
      logger.error('No item ID found in webhook data');
      
      Sentry.captureException(new Error('No item ID found in Monday.com webhook'), {
        contexts: {
          webhook: {
            eventType: event?.type,
            boardId: event?.boardId,
            webhookData: webhookData
          }
        }
      });
      
      return { success: false, reason: 'No item ID found' };
    }
    
    logger.info('Extracting email from webhook data', {
      columnValues: event?.columnValues,
      function: 'processMondayWebhook'
    });
    
    // Extract email from webhook column values
    const email = extractEmailFromWebhookData(event?.columnValues);
    
    logger.info('Email extraction result', {
      email: email,
      itemId: actualItemId,
      function: 'processMondayWebhook'
    });
    
    if (!email) {
      console.log('No valid email found in webhook data:', actualItemId);
      
      Sentry.addBreadcrumb({
        category: 'webhook.monday',
        message: 'No valid email found in webhook data',
        level: 'warning',
        data: { 
          itemId: actualItemId,
          columnValues: event?.columnValues ? Object.keys(event.columnValues) : []
        }
      });
      
      return { success: false, reason: 'No valid email found' };
    }
    
    // Extract all column data from webhook for Mailchimp merge fields
    const itemDetails = extractItemDetailsFromWebhook(event);
    
    // Add breadcrumb for email found
    Sentry.addBreadcrumb({
      category: 'webhook.monday',
      message: 'Email extracted from item',
      level: 'info',
      data: { 
        itemId: actualItemId,
        email: email
      }
    });
    
    // Enroll in Mailchimp campaign

    logger.info('Enrolling in Mailchimp campaign', {
      email: email,
      itemId: actualItemId,
      route: '/api/monday/process-webhook'
    });
    
    const { enrollInMailchimpCampaign } = require('./mailchimpEnrollmentService');
    const enrollmentResult = await enrollInMailchimpCampaign(email, itemDetails);
    

    
    // Add breadcrumb for enrollment result
    Sentry.addBreadcrumb({
      category: 'webhook.monday',
      message: 'Mailchimp enrollment completed',
      level: enrollmentResult.success ? 'info' : 'error',
      data: { 
        itemId: actualItemId,
        email: email,
        enrollmentSuccess: enrollmentResult.success,
        enrollmentError: enrollmentResult.error
      }
    });
    

    
    return {
      success: enrollmentResult.success,
      email,
      itemId: actualItemId,
      enrollmentResult
    };
    
  } catch (error) {
    logger.error('Error processing Monday.com webhook:', error);
    
    // Capture the exception with full context
    Sentry.captureException(error, {
      contexts: {
        webhook: {
          eventType: webhookData?.event?.type,
          boardId: webhookData?.event?.boardId,
          pulseId: webhookData?.event?.pulseId,
          webhookData: webhookData
        }
      }
    });
    

    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract item details from Monday.com webhook data for Mailchimp merge fields
 * @param {Object} event - Monday.com webhook event
 * @returns {Object} - Item details in format expected by Mailchimp enrollment
 */
function extractItemDetailsFromWebhook(event) {
  const itemDetails = {
    id: event?.pulseId,
    name: event?.pulseName || 'Unknown',
    column_values: []
  };

  logger.info('Extracting item details from webhook', {
    itemId: itemDetails.id,
    itemName: itemDetails.name,
    columnCount: itemDetails.column_values.length,
    columnIds: itemDetails.column_values.map(col => col.id),
    function: 'extractItemDetailsFromWebhook'
  });
  
  if (!event?.columnValues) {
    logger.warn('No column values in webhook event');
    return itemDetails;
  }
  
  // Convert webhook column values to the format expected by Mailchimp enrollment
  for (const [columnId, columnData] of Object.entries(event.columnValues)) {
    const columnValue = {
      id: columnId,
      title: getColumnTitle(columnId, columnData.type || 'text'),
      text: columnData.text || columnData.email || '',
      value: columnData.value || '',
      type: columnData.type || 'text'
    };
    
    itemDetails.column_values.push(columnValue);
  }
  
  logger.info('Extracted item details from webhook', {
    itemId: itemDetails.id,
    itemName: itemDetails.name,
    columnCount: itemDetails.column_values.length,
    columnIds: itemDetails.column_values.map(col => col.id),
    function: 'extractItemDetailsFromWebhook'
  });
  
  return itemDetails;
}

/**
 * Extract email from Monday.com webhook column values
 * @param {Object} columnValues - Monday.com webhook column values
 * @returns {string|null} - Email address or null if not found
 */
function extractEmailFromWebhookData(columnValues) {
  if (!columnValues) {
    logger.warn('No column values in webhook data');
    return null;
  }
  
  logger.info('Extracting email from webhook column values', {
    columnKeys: Object.keys(columnValues),
    function: 'extractEmailFromWebhookData'
  });
  
  // Look for email in common email column IDs
  const emailColumnIds = [
    'lead_email',
    'email_mknrc1cr', 
    'email_1__1',
    'email',
    'contact_email'
  ];
  
  for (const columnId of emailColumnIds) {
    const column = columnValues[columnId];
    if (column && column.email) {
      const email = cleanEmail(column.email);
      if (email) {
        logger.info('Found email in webhook data', {
          columnId: columnId,
          email: email,
          function: 'extractEmailFromWebhookData'
        });
        return email;
      }
    }
  }
  
  // If no email found in common columns, scan all columns
  for (const [columnId, column] of Object.entries(columnValues)) {
    if (column && column.email) {
      const email = cleanEmail(column.email);
      if (email) {
        logger.info('Found email in webhook data (scanned)', {
          columnId: columnId,
          email: email,
          function: 'extractEmailFromWebhookData'
        });
        return email;
      }
    }
  }
  
  logger.warn('No email found in webhook column values', {
    columnKeys: Object.keys(columnValues),
    function: 'extractEmailFromWebhookData'
  });
  
  return null;
}

module.exports = {
  incrementTouchpoints,
  getMondayItem,
  findMondayItemByEmail,
  getMondayContacts,
  addNoteToMondayItem,
  getAllMondayContacts,
  getBoardItems,
  TOUCHPOINTS_COLUMN_ID,
  EMAIL_COLUMN_ID,
  emailCache,
  checkEmailCache,
  getEmailFromCache,
  setEmailInCache,
  processMondayWebhook
};