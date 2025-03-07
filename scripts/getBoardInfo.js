const { executeQuery } = require('../utils/mondayClient');
require('dotenv').config();

const BOARD_ID = process.env.MONDAY_BOARD_ID;

async function getBoardInfo() {
  try {
    const query = `
      query {
        boards(ids: ${BOARD_ID}) {
          id
          name
          description
          columns {
            id
            title
            type
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
    console.log(JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getBoardInfo(); 