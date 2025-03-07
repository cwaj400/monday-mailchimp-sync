const mailchimp = require('@mailchimp/mailchimp_marketing');

// Initialize Mailchimp client
function getMailchimpClient() {
  console.log('Setting up Mailchimp client... with key:', process.env.MAILCHIMP_API_KEY.slice(0, 5) + '...');
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX
  });
  
  return mailchimp;
}

module.exports = {
  getMailchimpClient
};
