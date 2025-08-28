const { executeQuery } = require('./mondayClient');
const dotenv = require('dotenv');
const { logger } = require('./logger');
const Sentry = require('@sentry/node');

dotenv.config();

// Column IDs
const TOUCHPOINTS_COLUMN_ID = process.env.TOUCHPOINTS_COLUMN_ID || 'numbers8__1';
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
          Sentry.captureException(new Error('Item not found'), {
            extra: {
              itemId: itemId,
              note: note,
              function: 'addNoteToMondayItem'
            }
          });
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
      Sentry.captureException(error, {
        extra: {
          note: note,
          error: error.message,
          function: 'addNoteToMondayItem'
        }
      });
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
 * Find Monday.com item by email using efficient column value search
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
    
    console.log('checking cache', checkEmailCache(normalizedSearchEmail));
    if (checkEmailCache(normalizedSearchEmail)) {


      console.log(`Found email in cache: ${normalizedSearchEmail}`);
      return getEmailFromCache(normalizedSearchEmail);
    }
    
    // Try each potential email column ID
    for (const columnId of POTENTIAL_EMAIL_COLUMNS) {
      // Search in column: ${columnId}
      
      // Use Monday.com's efficient items_page_by_column_values query
      const query = `
        query ($board_id: ID!, $column_id: String!, $email: String!) {
          items_page_by_column_values(
            board_id: $board_id,
            columns: [{ column_id: $column_id, column_values: [$email] }],
            limit: 1
          ) {
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
      
      const variables = {
        board_id: MONDAY_BOARD_ID,
        column_id: columnId,
        email: normalizedSearchEmail
      };
      console.log('variables', variables);
      console.log('query', query);
      
      const result = await executeQuery(query, variables);
      
      if (result.data && result.data.items_page_by_column_values && result.data.items_page_by_column_values.items.length > 0) {
        const item = result.data.items_page_by_column_values.items[0];
        console.log(`Found matching item: ${item.id} (${item.name}) in column ${columnId}`);
        
        // Cache the result
        setEmailInCache(normalizedSearchEmail, item);
        return item;
      }
    }
    
    // If no exact match found, try a broader search with partial matching
    console.log(`No exact match found, trying broader search...`);
    
    // Search for items where email contains the search term
    const broaderQuery = `
      query ($board_id: ID!, $email: String!) {
        boards(ids: [$board_id]) {
          items_page(limit: 50) {
            items {
              id
              name
              column_values(ids: ${JSON.stringify(POTENTIAL_EMAIL_COLUMNS)}) {
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
    
    const broaderVariables = {
      board_id: MONDAY_BOARD_ID,
      email: normalizedSearchEmail
    };
    
    const broaderResult = await executeQuery(broaderQuery, broaderVariables);
    
    if (broaderResult.data && broaderResult.data.boards && broaderResult.data.boards.length > 0) {
      const items = broaderResult.data.boards[0].items_page?.items || [];
      
      for (const item of items) {
        const itemEmail = extractEmailFromItem(item);
        if (itemEmail && itemEmail.toLowerCase().trim() === normalizedSearchEmail) {
          console.log(`Found matching item in broader search: ${item.id} (${item.name})`);
          setEmailInCache(normalizedSearchEmail, item);
          return item;
        }
      }
    }
    
    console.error(`No Monday item found with email: ${email}`);
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
      // Checking column ID ${columnId}
      
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
      } else {
        console.log(`No valid email found in column ID ${columnId}`);
      }
    }
  }
  
  // Then try to find by column title (partial match) - only if title is available
  for (const columnTitle of emailColumns) {
    const column = item.column_values.find(col => 
      col.title && col.title.toLowerCase().includes('email')
    );
    if (column) {
      const email = extractEmailFromColumn(column);
      if (email) {
        logger.info('Found email in column title', {
          columnTitle: column.title,
          columnId: column.id,
          email: email,
          itemId: item.id
        });

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
  console.log('Validating email:', email);
  
  if (!email || typeof email !== 'string') {
    console.log('Email validation failed: not a string or empty');
    return null;
  }
  
  // Remove whitespace and convert to lowercase
  const cleanEmail = email.trim().toLowerCase();
  console.log('Cleaned email:', cleanEmail);
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(cleanEmail)) {
    console.log('Email validation failed: regex test failed');
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
    
    let itemDetails = null;
    await Sentry.startSpan({
      name: 'extractItemDetailsFromWebhook',
      op: 'mondayService.processMondayWebhook.extractItemDetailsFromWebhook',
    }, async (span) => {
      itemDetails = await extractItemDetailsFromWebhook(event, span);
      span.setStatus('ok');
    });
    
    // Extract all column data from webhook for Mailchimp merge fields
    
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

    if (!itemDetails) {
      logger.error('No item details found in webhook data');
      Sentry.captureException(new Error('No item details found in webhook data'), {
        level: 'error',
        contexts: {
          webhook: {
            eventType: webhookData?.event?.type,
            boardId: webhookData?.event?.boardId,
            pulseId: webhookData?.event?.pulseId,
            webhookData: webhookData
          }
        }
      });
      return { success: false, reason: 'No item details found' };
    }

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
  } finally {
    try {
      await Sentry.flush(2000);
    } catch (error) {
      logger.error('Error flushing Sentry:', error);
    }
  }
}

/**
 * Extract item details from Monday.com webhook data for Mailchimp merge fields
 * @param {Object} event - Monday.com webhook event
 * @returns {Object} - Item details in format expected by Mailchimp enrollment
 */
async function extractItemDetailsFromWebhook(event, span) {
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

  Sentry.addBreadcrumb({
    category: 'extractItemDetailsFromWebhook',
    message: 'Extracting item details from webhook',
    data: {
      itemId: itemDetails.id,
      itemName: itemDetails.name,
      columnCount: itemDetails.column_values.length,
      columnIds: itemDetails.column_values.map(col => col.id),
      function: 'extractItemDetailsFromWebhook',
    }
  });
  
  // Convert webhook column values to the format expected by Mailchimp enrollment
  for (const [columnId, columnData] of Object.entries(event.columnValues)) {
    // Skip null column data
    if (!columnData) {
      logger.info('Skipping null column data', {
        columnId: columnId,
        function: 'extractItemDetailsFromWebhook'
      });
      continue;
    }
    
    // Handle different field types properly
    let textValue = '';
    let fieldValue = '';
    
    // Detect field type by column ID pattern and data structure
    const isDateField = columnId.startsWith('date') || (columnData.date && columnData.date !== '');
    const isEmailField = columnId.includes('email') || (columnData.email && columnData.email !== '');
    const isPhoneField = columnId.includes('phone') || (columnData.phone && columnData.phone !== '');
    const isDropdownField = columnData.chosenValues && Array.isArray(columnData.chosenValues) && columnData.chosenValues.length > 0;

    logger.info('Column data FOR MAILCHIMP fields', {
      columnId: columnId,
      columnData: columnData,
      isDateField: isDateField,
      isEmailField: isEmailField,
      isPhoneField: isPhoneField,
      isDropdownField: isDropdownField
    });
    
    if (isDateField) {
      // Date fields have their value in columnData.date
      textValue = columnData.date || columnData.text || '';
      fieldValue = columnData.date || columnData.value || '';
    } else if (isEmailField) {
      // Email fields have their value in columnData.email
      textValue = columnData.email || columnData.text || '';
      fieldValue = columnData.email || columnData.value || '';
    } else if (isPhoneField) {
      // Phone fields have their value in columnData.phone
      textValue = columnData.phone || columnData.text || '';
      fieldValue = columnData.phone || columnData.value || '';
    } else if (isDropdownField) {
      // Dropdown fields have their value in chosenValues array
      const chosenValue = columnData.chosenValues?.[0]?.name || '';
      textValue = chosenValue;
      fieldValue = chosenValue;
    } else {
      // Text and other fields
      textValue = columnData.text || columnData.email || '';
      fieldValue = columnData.value || '';
    }
    
    const columnValue = {
      id: columnId,
      title: getColumnTitle(columnId, columnData.type || 'text'),
      text: textValue,
      value: fieldValue,
      type: columnData.type || 'text'
    };
    
    itemDetails.column_values.push(columnValue);
  }
  
  logger.info('Extracted item details from webhook', {
    itemId: itemDetails.id,
    itemName: itemDetails.name,
    columnCount: itemDetails.column_values.length,
    columnIds: itemDetails.column_values.map(col => col.id),
    columnTypes: itemDetails.column_values.map(col => ({ id: col.id, type: col.type, text: col.text })),
    function: 'extractItemDetailsFromWebhook'
  });
  
  // Validate that we have essential data
  if (!itemDetails.id) {
    logger.error('Missing item ID in webhook data');
    throw new Error('Missing item ID in webhook data');
  }
  
  if (!itemDetails.name || itemDetails.name === 'Unknown') {
    logger.warn('Missing or unknown item name in webhook data', {
      itemId: itemDetails.id,
      itemName: itemDetails.name
    });
  }
  
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
      const email = validateAndCleanEmail(column.email);
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
      const email = validateAndCleanEmail(column.email);
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