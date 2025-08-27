const mailchimp = require('@mailchimp/mailchimp_marketing');

// Initialize Mailchimp client
function getMailchimpClient() {
  if (!process.env.MAILCHIMP_API_KEY) {
    throw new Error('MAILCHIMP_API_KEY is not set');
  }
  if (!process.env.MAILCHIMP_SERVER_PREFIX) {
    throw new Error('MAILCHIMP_SERVER_PREFIX is not set');
  }
  console.log('Setting up Mailchimp client... with key:', process.env.MAILCHIMP_API_KEY.slice(0, 5) + '...');
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX,
    timeout: 15000 // 15 second timeout to prevent hanging
  });
  
  return mailchimp;
}

module.exports = {
  getMailchimpClient
};
