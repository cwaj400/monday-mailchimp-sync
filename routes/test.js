// Simple test file to check directory structure
console.log('Directory structure test');

try {
  // Try to require each handler
  const subscriberHandler = require('./webhookHandlers/handleSubscriberEvent');
  console.log('Successfully imported handleSubscriberEvent');
} catch (error) {
  console.error('Error importing handleSubscriberEvent:', error.message);
}

try {
  // Try with the .js in the path
  const subscriberHandler = require('./webhookHandlers/handleSubscriberEvent');
  console.log('Successfully imported handleSubscriberEvent from webhookHandlers.js');
} catch (error) {
  console.error('Error importing from webhookHandlers.js:', error.message);
} 