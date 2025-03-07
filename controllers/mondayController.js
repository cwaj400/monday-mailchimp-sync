const axios = require('axios');
require('dotenv').config();

const { MONDAY_API_KEY, MONDAY_BOARD_ID, MONDAY_SIGNING_SECRET } = process.env;

// Fetch Leads from Monday
exports.getMondayLeads = async (req, res) => {
    const query = `
        query {
            boards(ids: ${MONDAY_BOARD_ID}) {
                items {
                    id
                    name
                    column_values {
                        title
                        text
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post(
            'https://api.monday.com/v2',
            { query },
            { headers: { Authorization: MONDAY_API_KEY } }
        );

        const leads = response.data.data.boards[0].items.map(item => {
            let leadData = {};
            item.column_values.forEach(col => {
                leadData[col.title] = col.text;
            });
            leadData.id = item.id;
            return leadData;
        });

        res.json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error.message);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

// Update Touchpoints in Monday
exports.updateTouchpoints = async (req, res) => {
    const { itemId, touchpoints } = req.body;

    const mutation = `
        mutation {
            change_simple_column_value(
                board_id: ${MONDAY_BOARD_ID},
                item_id: ${itemId},
                column_id: "touchpoints",
                value: "${touchpoints}"
            ) {
                id
            }
        }
    `;

    try {
        await axios.post(
            'https://api.monday.com/v2',
            { query: mutation },
            { headers: { Authorization: MONDAY_API_KEY } }
        );

        res.json({ message: "Touchpoints updated successfully" });
    } catch (error) {
        console.error("Error updating touchpoints:", error.message);
        res.status(500).json({ error: "Failed to update touchpoints" });
    }
};


// Validate Monday webhook requests
exports.validateMondayWebhook = (req, res, next) => {
  const signature = req.headers['x-monday-signature'];
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', MONDAY_SIGNING_SECRET).update(body).digest('base64');

  if (signature !== expectedSignature) {
    return res.status(403).json({ error: 'Invddalid signature' });
  }

  next();
}

// Example Webhook Endpoint
exports.handleMondayWebhook = async (req, res) => {
  console.log('Webhook Received:', req.body);
  res.json({ success: true });
};