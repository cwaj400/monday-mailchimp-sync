const axios = require('axios');
require('dotenv').config();

const { MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID, MAILCHIMP_SERVER_PREFIX } = process.env;

exports.syncToMailchimp = async (req, res) => {
    try {
        const response = await axios.get('http://localhost:4040/api/monday/getLeads');
        const leads = response.data;

        for (const lead of leads) {
            if (!lead.Email) continue;

            const subscriberHash = Buffer.from(lead.Email.toLowerCase()).toString('hex');
            const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;

            const data = {
                email_address: lead.Email,
                status_if_new: "subscribed",
                merge_fields: {
                    FNAME: lead["First Name"],
                    LNAME: lead["Last Name"],
                    STATUS: lead.Status
                }
            };

            await axios.put(url, data, {
                auth: { username: "anystring", password: MAILCHIMP_API_KEY }
            });

            console.log(`Synced ${lead.Email} to Mailchimp.`);
        }

        res.json({ message: "Sync completed" });
    } catch (error) {
        console.error("Sync error:", error);
        res.status(500).json({ error: "Sync failed" });
    }
};
