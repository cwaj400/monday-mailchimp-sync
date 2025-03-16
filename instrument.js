// Import Sentry
const Sentry = require("@sentry/node");
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
  // Adjust this value in production to control how many transactions are captured
  tracesSampleRate: 1.0,
});

console.log(`✅ Sentry initialized in ${process.env.NODE_ENV || 'development'} environment`);