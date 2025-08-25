const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { executeQuery } = require('../utils/mondayClient');

/**
 * Find the email column in your Monday.com board
 */
async function findEmailColumn() {
  console.log('🔍 Finding email column in Monday.com board...\n');
  
  try {
    const boardId = process.env.MONDAY_BOARD_ID;
    if (!boardId) {
      console.log('❌ MONDAY_BOARD_ID not set in environment');
      return;
    }
    
    console.log(`📋 Analyzing board: ${boardId}\n`);
    
    // Get board structure
    const boardQuery = `
      query {
        boards(ids: [${boardId}]) {
          id
          name
          columns {
            id
            title
            type
            settings_str
          }
          items_page(limit: 5) {
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
    
    const result = await executeQuery(boardQuery);
    
    if (!result.data || !result.data.boards || result.data.boards.length === 0) {
      console.log('❌ Board not found or no access');
      return;
    }
    
    const board = result.data.boards[0];
    console.log(`✅ Board found: ${board.name} (ID: ${board.id})\n`);
    
    // Analyze columns
    console.log('📊 Column Analysis:');
    console.log('='.repeat(80));
    
    const emailColumns = [];
    const potentialEmailColumns = [];
    
    board.columns.forEach(col => {
      const isEmailColumn = col.type === 'email' || 
                           col.title.toLowerCase().includes('email') ||
                           col.id.includes('email');
      
      const hasEmailData = checkForEmailData(col.id, board.items_page.items);
      
      console.log(`Column: ${col.title}`);
      console.log(`  ID: ${col.id}`);
      console.log(`  Type: ${col.type}`);
      console.log(`  Has Email Data: ${hasEmailData ? '✅ YES' : '❌ NO'}`);
      console.log(`  Is Email Column: ${isEmailColumn ? '✅ YES' : '❌ NO'}`);
      
      if (isEmailColumn && hasEmailData) {
        emailColumns.push(col);
      } else if (hasEmailData) {
        potentialEmailColumns.push(col);
      }
      
      console.log('');
    });
    
    // Show results
    console.log('🎯 Email Column Results:');
    console.log('='.repeat(80));
    
    if (emailColumns.length > 0) {
      console.log('✅ Found email columns:');
      emailColumns.forEach(col => {
        console.log(`  - ${col.title} (ID: ${col.id}, Type: ${col.type})`);
      });
    } else {
      console.log('⚠️ No dedicated email columns found');
    }
    
    if (potentialEmailColumns.length > 0) {
      console.log('\n🔍 Potential email columns (contain email data):');
      potentialEmailColumns.forEach(col => {
        console.log(`  - ${col.title} (ID: ${col.id}, Type: ${col.type})`);
      });
    }
    
    // Show sample data
    if (board.items_page.items.length > 0) {
      console.log('\n📋 Sample Item Data:');
      console.log('='.repeat(80));
      
      const sampleItem = board.items_page.items[0];
      console.log(`Item: ${sampleItem.name} (ID: ${sampleItem.id})`);
      
      sampleItem.column_values.forEach(col => {
        const hasEmail = containsEmail(col.text || col.value);
        console.log(`  ${col.id}: "${col.text || col.value}" ${hasEmail ? '📧 EMAIL' : ''}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('='.repeat(80));
    
    if (emailColumns.length > 0) {
      const primaryEmailColumn = emailColumns[0];
      console.log(`✅ Use this column for email: ${primaryEmailColumn.title} (ID: ${primaryEmailColumn.id})`);
      console.log(`   Add to your .env file: EMAIL_COLUMN_ID=${primaryEmailColumn.id}`);
    } else if (potentialEmailColumns.length > 0) {
      const bestOption = potentialEmailColumns[0];
      console.log(`⚠️ No dedicated email column found, but this column contains emails:`);
      console.log(`   ${bestOption.title} (ID: ${bestOption.id})`);
      console.log(`   Add to your .env file: EMAIL_COLUMN_ID=${bestOption.id}`);
    } else {
      console.log('❌ No email columns found. You may need to:');
      console.log('   1. Add an email column to your board');
      console.log('   2. Check if emails are stored in a different column type');
      console.log('   3. Verify the board ID is correct');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Check if a column contains email data
 */
function checkForEmailData(columnId, items) {
  for (const item of items) {
    const column = item.column_values.find(col => col.id === columnId);
    if (column && containsEmail(column.text || column.value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a value contains an email
 */
function containsEmail(value) {
  if (!value) return false;
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  return emailRegex.test(value);
}

// Run the script
if (require.main === module) {
  findEmailColumn().catch(console.error);
}

module.exports = {
  findEmailColumn
};
