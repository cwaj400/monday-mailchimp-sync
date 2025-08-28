const { getMailchimpClient } = require('./mailchimpClient');
const { sendDiscordNotification } = require('./discordNotifier');
const Sentry = require('@sentry/node');
const { addNoteToMondayItem } = require('./mondayService');
const { logger } = require('./logger');

const dotenv = require('dotenv');
dotenv.config();

// Configuration
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const ENROLLMENT_TAG = process.env.ENROLLMENT_TAG || 'Newly Enquiried from API';
const WELCOME_CAMPAIGN_ID = process.env.WELCOME_CAMPAIGN_ID;
const MAX_RETRIES = 2; // Reduced from 3 to 2 to prevent long processing times
const RETRY_DELAY = 3000; // 3 seconds - increased for better reliability

/**
 * Main function to enroll a customer in Mailchimp when they submit an inquiry
 * @param {string} email - Customer's email address
 * @param {Object} itemDetails - Monday.com item details
 * @returns {Promise<Object>} - Result of enrollment
 */
async function enrollInMailchimpCampaign(email, itemDetails) {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Mailchimp enrollment', {
      email: email,
      itemDetails: itemDetails,
      route: '/api/monday/process-webhook'
    });
    Sentry.addBreadcrumb('Starting Mailchimp enrollment', 'mailchimp.enrollment', {
      email,
      itemId: itemDetails.id,
      itemName: itemDetails.name
    });
    
    // Step 1: Validate and clean email
    const cleanEmail = validateAndCleanEmail(email);
    if (!cleanEmail) {
      throw new Error(`Invalid email format: ${email}`);
    }
    
    // Step 2: Extract and validate merge fields
    const mergeFields = extractMergeFields(itemDetails);


    const subscriberResult = await addSubscriberToAudience(cleanEmail, mergeFields);

    // Step 4: Send Discord notification
    await sendEnrollmentNotification(cleanEmail, itemDetails, subscriberResult, startTime);
    
    logger.info('Mailchimp enrollment completed', {
      email: cleanEmail,
      itemDetails: itemDetails,
      route: '/api/monday/process-webhook',
      processingTime: Date.now() - startTime,
      subscriberResult: subscriberResult
    });
    return {
      success: true,
      email: cleanEmail,
      subscriberId: subscriberResult.subscriberId,
      status: subscriberResult.status,
      mergeFields,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Mailchimp enrollment failed', {
      email: email,
      itemDetails: itemDetails,
      route: '/api/monday/process-webhook',
      error: error.message
    });
    
    Sentry.captureException(error, {
      context: 'Mailchimp enrollment',
      error: error.message,
      email,
    });
    
    // Send error notification (fire and forget)
    sendDiscordNotification(
      '❌ Mailchimp Enrollment Failed',
      `Failed to enroll ${email} in Mailchimp campaign.`,
      {
        'Email': email,
        'Monday Item ID': itemDetails?.id || 'Unknown',
        'Error': error.message,
        'Processing Time': `${Date.now() - startTime}ms`,
        'Timestamp': new Date().toISOString()
      },
      'ED4245' // Red color for errors
    ).catch(err => {
      console.error('Discord notification failed:', err.message);
    });
    
    return {
      success: false,
      error: error.message,
      email,
      processingTime: Date.now() - startTime
    };
  } finally {
    // Flush Sentry data at the end of the entire process
    try {
      await Sentry.flush(2000);
    } catch (flushError) {
      console.error('Error flushing Sentry:', flushError.message);
    }
  }
}

/**
 * Validate and clean email address according to Mailchimp requirements
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
  
  // Check for obvious invalid patterns (only reject the most obvious ones)
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
    /^hi@/i,
    /^support@/i,
    /^help@/i,
    /^sales@/i,
    /^marketing@/i,
    /^webmaster@/i,
    /^postmaster@/i,
    /^abuse@/i,
    /^security@/i,
    /^root@/i
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
 * Extract merge fields from Monday.com item with proper validation
 * @param {Object} itemDetails - Monday.com item object
 * @returns {Object} - Validated merge fields for Mailchimp
 */
function extractMergeFields(itemDetails) {
  const mergeFields = {};
  
  // Mailchimp standard merge fields (case sensitive)
  const fieldMappings = {
    'FNAME': ['First Name', 'first_name', 'name', 'firstname', 'text3__1'],
    'LNAME': ['Last Name', 'last_name', 'surname', 'lastname', 'text2__1', 'short_text4__1'], // Added short_text4__1 for BOSS
    'PHONE': ['Phone', 'phone', 'telephone', 'mobile', 'lead_phone', 'phone_1__1'], // Added phone_1__1
    'COMPANY': ['Company', 'organization', 'business', 'employer'],
    'ADDRESS': ['Address', 'street', 'location'],
    'CITY': ['City', 'town'],
    'STATE': ['State', 'province', 'region'],
    'ZIP': ['ZIP', 'zipcode', 'postal_code', 'postcode'],
    'COUNTRY': ['Country', 'nation'],
    'BIRTHDAY': ['Birthday', 'birth_date', 'date_of_birth'],
    'GENDER': ['Gender', 'sex'],
    'WEBSITE': ['Website', 'site', 'url'],
    'EVENT_DATE': ['Tentative Event Date', 'event_date', 'date0__1'],
    'EVENT_TYPE': ['Event Type', 'event_type', 'dropdown__1', 'single_select__1'], // Added single_select__1 for Wedding
    'CONTACT_DATE': ['Berwick Contact Date', 'contact_date', 'date__'],
    'SOURCE': ['Lead Source', 'lead_source', 'source', 'dropdown1__1']
  };

  let nameExtracted = false;
  
  // Process each column in the Monday.com item
  itemDetails.column_values.forEach(column => {
    const columnTitle = column.title?.toLowerCase() || '';
    const columnText = column.text || '';
    const columnValue = column.value || '';
    const columnId = column.id;
    
    // Use value if text is empty (for dropdowns, etc.)
    const fieldValue = columnText || columnValue;
    
    logger.info('Processing column for merge fields', {
      columnId: columnId,
      columnTitle: columnTitle,
      columnText: columnText,
      columnValue: columnValue,
      fieldValue: fieldValue,
      columnType: column.type,
      function: 'extractMergeFields'
    });
    
    if (!fieldValue || fieldValue.trim() === '') {
      logger.info('Skipping empty column', {
        columnId: columnId,
        columnTitle: columnTitle,
        function: 'extractMergeFields'
      });
      return;
    }
    
    // Find matching merge field
    for (const [mergeField, possibleTitles] of Object.entries(fieldMappings)) {
      const isMatch = possibleTitles.some(title => 
        columnTitle.includes(title.toLowerCase()) ||
        columnTitle === title.toLowerCase() ||
        columnId === title // Also match by column ID
      );
      
      if (isMatch) {
        // Clean and validate the field value
        const cleanValue = cleanMergeFieldValue(fieldValue, mergeField);
        if (cleanValue) {
          mergeFields[mergeField] = cleanValue;
          if (mergeField === 'FNAME' || mergeField === 'LNAME') { 
            nameExtracted = true;
            logger.info('Name extracted', {
              mergeField: mergeField,
              cleanValue: cleanValue,
              function: 'extractMergeFields'
            });
          }
        }
        break; // Use first match
      }
    }
  });


  if (!nameExtracted && itemDetails.name) {
    const nameParts = itemDetails.name.trim().split(/\s+/);
    if (nameParts.length >= 1) {
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[1] : '';
      
      mergeFields['FNAME'] = firstName;
      mergeFields['LNAME'] = lastName;
      logger.info('Name extracted from item name', {
        firstName: firstName,
        lastName: lastName,
        function: 'extractMergeFields'
      });
    }
  }

  logger.info('Extracted merge fields', {
    mergeFields: mergeFields,
    hasEventType: !!mergeFields.EVENT_TYPE,
    eventTypeValue: mergeFields.EVENT_TYPE,
    function: 'extractMergeFields'
  });
  
  return mergeFields;
}

/**
 * Clean and validate merge field values according to Mailchimp requirements
 * @param {string} value - Raw field value
 * @param {string} fieldType - Merge field type
 * @returns {string|null} - Cleaned value or null if invalid
 */
function cleanMergeFieldValue(value, fieldType) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  
  let cleanValue = value.trim();
  
  // Remove extra whitespace and normalize
  cleanValue = cleanValue.replace(/\s+/g, ' ');
  
  // Field-specific validation and cleaning
  switch (fieldType) {
    case 'FNAME':
    case 'LNAME':
      // Names should be 1-50 characters, letters, spaces, hyphens, apostrophes only
      cleanValue = cleanValue.replace(/[^a-zA-Z\s\-']/g, '');
      return cleanValue.length > 0 && cleanValue.length <= 50 ? cleanValue : null;
      
    case 'PHONE':
      // Remove all non-digit characters except + for international
      cleanValue = cleanValue.replace(/[^\d+]/g, '');
      return cleanValue.length >= 10 ? cleanValue : null;
      
    case 'COMPANY':
      // Company names should be 1-100 characters
      return cleanValue.length > 0 && cleanValue.length <= 100 ? cleanValue : null;
      
    case 'ADDRESS':
      // Address should be 1-100 characters
      return cleanValue.length > 0 && cleanValue.length <= 100 ? cleanValue : null;
      
    case 'CITY':
    case 'STATE':
      // City/State should be 1-50 characters
      return cleanValue.length > 0 && cleanValue.length <= 50 ? cleanValue : null;
      
    case 'ZIP':
      // ZIP should be 1-10 characters
      return cleanValue.length > 0 && cleanValue.length <= 10 ? cleanValue : null;
      
    case 'COUNTRY':
      // Country should be 1-50 characters
      return cleanValue.length > 0 && cleanValue.length <= 50 ? cleanValue : null;
      
    case 'WEBSITE':
      // Basic URL validation
      if (cleanValue && !cleanValue.startsWith('http')) {
        cleanValue = 'https://' + cleanValue;
      }
      return cleanValue.length > 0 && cleanValue.length <= 200 ? cleanValue : null;
      
    default:
      // Generic cleaning for other fields
      return cleanValue.length > 0 && cleanValue.length <= 1000 ? cleanValue : null;
  }
}

/**
 * Add subscriber to Mailchimp audience with retry logic
 * @param {string} email - Clean email address
 * @param {Object} mergeFields - Validated merge fields
 * @returns {Promise<Object>} - Result of subscription
 */
async function addSubscriberToAudience(email, mergeFields) {
  return await Sentry.startSpan(
    { name: 'addSubscriberToAudience', op: 'mailchimp.enrollment' },
    async (span) => {
  const mailchimp = getMailchimpClient();
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = 60000; // 60 seconds max processing time
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Check if we've exceeded maximum processing time
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      throw new Error(`Processing timeout: exceeded ${MAX_PROCESSING_TIME}ms for ${email}`);
    }
    try {
      
      Sentry.addBreadcrumb('Adding subscriber to audience', 'mailchimp.api', {
        email,
        audienceId: MAILCHIMP_AUDIENCE_ID,
        attempt
      });
      
      
      const tags = mergeFields.EVENT_TYPE ? [mergeFields.EVENT_TYPE] : [];

      tags.push(ENROLLMENT_TAG);
      tags.push('NEW');
      
      if (mergeFields.SOURCE) {
        tags.push(mergeFields.SOURCE);
      }
      
      const subscriberData = {
        email_address: email,
        status: 'subscribed',
        merge_fields: mergeFields,
        tags: tags
      };
      
      // Add small delay between attempts to avoid overwhelming the connection
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const result = await mailchimp.lists.addListMember(MAILCHIMP_AUDIENCE_ID, subscriberData);
      
      console.log(`✅ Successfully added subscriber ${email} (ID: ${result.id})`);
      
      return {
        success: true,
        subscriberId: result.id,
        status: result.status,
        attempt
      };
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${email}:`, error.message);
      console.error(`Error details:`, {
        name: error.name,
        code: error.code,
        stack: error.stack?.split('\n')[0] // First line of stack trace
      });
      
      Sentry.captureException(error, {
        context: 'Mailchimp enrollment failed at attempt ' + attempt,
        email,
        message: error.message,
      });
      
      
      // Handle "Bad Request" errors (often means subscriber already exists)
      if (error.response?.status === 400) {
        console.log(`⚠️ Bad Request for ${email}, likely already subscribed. Trying to update...`);
        
        try {
          const subscriberHash = require('crypto')
            .createHash('md5')
            .update(email.toLowerCase())
            .digest('hex');
          
          const updateResult = await mailchimp.lists.updateListMember(
            MAILCHIMP_AUDIENCE_ID, 
            subscriberHash, 
            {
              merge_fields: mergeFields,
            }
          );
          
          return {
            success: true,
            subscriberId: subscriberHash,
            status: 'updated',
            attempt
          };
        } catch (updateError) {
          console.error(`❌ Failed to update subscriber ${email}:`, updateError.message);
          // Continue to next attempt
        }
      }
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        console.log(`⏳ Rate limited, waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Handle network errors (socket hang up, TLS issues, etc.)
      const isNetworkError = error.message.includes('socket hang up') || 
                            error.message.includes('network socket disconnected') ||
                            error.message.includes('ECONNRESET') ||
                            error.message.includes('ENOTFOUND') ||
                            error.message.includes('ETIMEDOUT');
      
      if (isNetworkError) {
        Sentry.captureException(error, {
          context: 'Mailchimp enrollment network error, adding subscriber to audience',
          email,
          message: error.message,
          attemptNumber: attempt,
        });
        console.log(`🌐 Network error detected: ${error.message}`);
        console.log(`⏳ Waiting ${RETRY_DELAY * attempt} seconds before retry...`);
        
        // Exponential backoff for network errors
        const backoffDelay = Math.min(RETRY_DELAY * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }

      
      // Handle other errors
      if (attempt === MAX_RETRIES) {
        Sentry.captureMessage('Mailchimp enrollment - attempt ' + attempt + ' network error, adding subscriber to audience', {
          context: 'Mailchimp enrollment - attempt ' + attempt + ' network error, adding subscriber to audience',
          email,
          message: error.message,
          attemptNumber: attempt,
        });
        span.setStatus('error');
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }
});
}

/**
 * Add enrollment tag to subscriber
 * @param {string} email - Subscriber email
 */
async function addEnrollmentTag(email) {
  try {
    const mailchimp = getMailchimpClient();
    const subscriberHash = require('crypto')
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');
    
    await mailchimp.lists.updateListMemberTags(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
      tags: [{
        name: ENROLLMENT_TAG,
        status: 'active'
      }]
    });
    
    console.log(`🏷️ Added enrollment tag to ${email}`);
  } catch (error) {
    console.error('⚠️ Error adding enrollment tag:', error.message);
    // Don't throw - this is not critical
  }
}

/**
 * Add enrollment note to Monday.com item
 * @param {string} itemId - Monday.com item ID
 * @param {string} email - Subscriber email
 * @param {Object} subscriberResult - Result from subscription
 */
async function addEnrollmentNoteToMonday(itemId, email, subscriberResult) {
  try {
    const noteText = `✅ Mailchimp Enrollment: ${email} has been successfully enrolled in Mailchimp audience. Status: ${subscriberResult.status}, Subscriber ID: ${subscriberResult.subscriberId}`;
    
    const result = await addNoteToMondayItem(itemId, noteText);
    
    if (result.success) {
      console.log(`📝 Added enrollment note to Monday.com item ${itemId}`);
    } else {
      console.warn(`⚠️ Failed to add enrollment note to Monday.com item ${itemId}:`, result.error);
    }
  } catch (error) {
    console.error('⚠️ Error adding enrollment note to Monday.com:', error.message);
    // Don't throw - this is not critical
  }
}

/**
 * Send Discord notification about enrollment
 * @param {string} email - Subscriber email
 * @param {Object} itemDetails - Monday.com item details
 * @param {Object} subscriberResult - Result from subscription
 * @param {number} startTime - Start time of enrollment process
 */
async function sendEnrollmentNotification(email, itemDetails, subscriberResult, startTime) {
  try {
    const processingTime = Date.now() - startTime;
    
    const fields = {
      'Email': email,
      'Monday Item ID': itemDetails.id,
      'Monday Item Name': itemDetails.name,
      'Subscriber Status': subscriberResult.status,
      'Subscriber ID': subscriberResult.subscriberId,
      'Processing Time': `${processingTime}ms`,
      'Attempts': subscriberResult.attempt || 1,
      'Timestamp': new Date().toISOString()
    };
    
    sendDiscordNotification(
      '🎯 New Customer Enrolled in Mailchimp',
      `A new customer inquiry has been automatically enrolled in your Mailchimp audience.`,
      fields,
      '57F287' // Green color for success
    ).catch(err => {
      console.error('Discord notification failed:', err.message);
    });
    
  } catch (error) {
    console.error('⚠️ Error sending Discord notification:', error.message);
    // Don't throw - this is not critical
  }
}

module.exports = {
  enrollInMailchimpCampaign,
  validateAndCleanEmail,
  extractMergeFields,
  cleanMergeFieldValue
};
