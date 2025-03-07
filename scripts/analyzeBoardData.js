const { executeQuery } = require('../utils/mondayClient');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOARD_ID = process.env.MONDAY_BOARD_ID;

async function analyzeBoardData() {
  if (!BOARD_ID) {
    console.error('MONDAY_BOARD_ID is not defined in environment variables');
    return;
  }

  try {
    console.log(`Analyzing board data for board ID: ${BOARD_ID}`);
    
    // Get board structure
    const boardQuery = `
      query {
        boards(ids: ${BOARD_ID}) {
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
            color
            position
          }
          items_count
        }
      }
    `;
    
    const boardResult = await executeQuery(boardQuery);
    
    if (!boardResult.data || !boardResult.data.boards || boardResult.data.boards.length === 0) {
      console.error('Board not found or no access to this board');
      return;
    }
    
    const board = boardResult.data.boards[0];
    
    console.log('\n=== BOARD INFORMATION ===');
    console.log(`Name: ${board.name}`);
    console.log(`ID: ${board.id}`);
    console.log(`Description: ${board.description || 'No description'}`);
    console.log(`State: ${board.state}`);
    console.log(`Kind: ${board.board_kind}`);
    console.log(`Total Items: ${board.items_count}`);
    
    console.log('\n=== COLUMNS ===');
    board.columns.forEach(column => {
      console.log(`- ${column.title} (${column.id})`);
      console.log(`  Type: ${column.type}`);
      
      // Parse settings if available
      if (column.settings_str) {
        try {
          const settings = JSON.parse(column.settings_str);
          console.log(`  Settings: ${JSON.stringify(settings, null, 2)}`);
        } catch (e) {
          console.log(`  Settings: ${column.settings_str}`);
        }
      }
    });
    
    console.log('\n=== GROUPS ===');
    board.groups.forEach(group => {
      console.log(`- ${group.title} (${group.id})`);
      console.log(`  Color: ${group.color}`);
      console.log(`  Position: ${group.position}`);
    });
    
    // Create a column ID to title mapping for later use
    const columnMapping = {};
    board.columns.forEach(column => {
      columnMapping[column.id] = column.title;
    });
    
    // Get sample items - FIXED QUERY
    const itemsQuery = `
      query {
        boards(ids: ${BOARD_ID}) {
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
              group {
                id
                title
              }
              created_at
              updated_at
            }
          }
        }
      }
    `;
    
    const itemsResult = await executeQuery(itemsQuery);
    
    if (itemsResult.data && 
        itemsResult.data.boards && 
        itemsResult.data.boards.length > 0 && 
        itemsResult.data.boards[0].items_page) {
      
      const items = itemsResult.data.boards[0].items_page.items;
      
      console.log('\n=== SAMPLE ITEMS (5) ===');
      items.forEach((item, index) => {
        console.log(`\nItem ${index + 1}: ${item.name} (${item.id})`);
        console.log(`Group: ${item.group ? item.group.title : 'No group'}`);
        console.log(`Created: ${new Date(item.created_at).toLocaleString()}`);
        console.log(`Updated: ${new Date(item.updated_at).toLocaleString()}`);
        
        console.log('Column Values:');
        item.column_values.forEach(value => {
          // Use the column mapping to get the title
          const columnTitle = columnMapping[value.id] || value.id;
          console.log(`- ${columnTitle}: ${value.text || 'Empty'}`);
          
          // Try to parse JSON value if present
          if (value.value) {
            try {
              const parsedValue = JSON.parse(value.value);
              console.log(`  Raw value: ${JSON.stringify(parsedValue, null, 2)}`);
            } catch (e) {
              console.log(`  Raw value: ${value.value}`);
            }
          }
        });
      });
    } else {
      console.log('\nNo items found or unable to retrieve items');
    }
    
    // Save full analysis to file
    const analysisData = {
      board: boardResult.data.boards[0],
      sampleItems: itemsResult.data?.boards[0]?.items_page?.items || []
    };
    
    const outputPath = path.resolve(__dirname, 'board_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));
    console.log(`\nFull analysis saved to ${outputPath}`);
    
    // Generate column mapping helper
    console.log('\n=== COLUMN MAPPING HELPER ===');
    console.log('Copy this code to help map your columns:');
    console.log(`
// Column mapping for board ${board.name} (${board.id})
const COLUMN_MAPPING = {`);
    
    board.columns.forEach(column => {
      const safeColumnName = column.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      
      console.log(`  ${safeColumnName}: '${column.id}', // ${column.title} (${column.type})`);
    });
    
    console.log('};');
    
    // Find potential email columns
    const emailColumns = board.columns.filter(col => 
      col.title.toLowerCase().includes('email') || 
      col.type === 'email'
    );
    
    if (emailColumns.length > 0) {
      console.log('\n=== POTENTIAL EMAIL COLUMNS ===');
      emailColumns.forEach(col => {
        console.log(`- ${col.title} (${col.id})`);
      });
    }
    
    // Find potential name columns
    const nameColumns = board.columns.filter(col => 
      col.title.toLowerCase().includes('first') || 
      col.title.toLowerCase().includes('last') ||
      col.title.toLowerCase().includes('name')
    );
    
    if (nameColumns.length > 0) {
      console.log('\n=== POTENTIAL NAME COLUMNS ===');
      nameColumns.forEach(col => {
        console.log(`- ${col.title} (${col.id})`);
      });
    }
    
    // Find touchpoints column
    const touchpointsColumns = board.columns.filter(col => 
      col.title.toLowerCase().includes('touchpoint')
    );
    
    if (touchpointsColumns.length > 0) {
      console.log('\n=== TOUCHPOINTS COLUMN ===');
      touchpointsColumns.forEach(col => {
        console.log(`- ${col.title} (${col.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error analyzing board data:', error);
  }
}

analyzeBoardData(); 