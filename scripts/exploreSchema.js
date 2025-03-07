const { executeQuery } = require('../utils/mondayClient');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function exploreSchema() {
  try {
    console.log('Exploring Monday.com GraphQL schema...');
    
    // Query to get Board type fields
    const boardTypeQuery = `
      query {
        __type(name: "Board") {
          name
          kind
          fields {
            name
            description
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
            args {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;
    
    const result = await executeQuery(boardTypeQuery);
    
    if (result.data && result.data.__type) {
      console.log('Board type fields:');
      const fields = result.data.__type.fields;
      
      fields.forEach(field => {
        console.log(`- ${field.name}: ${field.type.name || field.type.kind}`);
        if (field.description) {
          console.log(`  Description: ${field.description}`);
        }
        
        if (field.args && field.args.length > 0) {
          console.log('  Arguments:');
          field.args.forEach(arg => {
            console.log(`    - ${arg.name}: ${arg.type.name || arg.type.kind}`);
            if (arg.description) {
              console.log(`      Description: ${arg.description}`);
            }
          });
        }
      });
      
      // Save schema to file for reference
      const schemaPath = path.resolve(__dirname, 'monday_schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify(result.data, null, 2));
      console.log(`\nSchema saved to ${schemaPath}`);
    } else {
      console.log('Failed to retrieve schema information');
    }
  } catch (error) {
    console.error('Error exploring schema:', error);
  }
}

exploreSchema(); 