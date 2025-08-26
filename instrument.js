// Import Sentry
const Sentry = require("@sentry/node");
const { CaptureConsole } = require('@sentry/integrations');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Sentry as early as possible
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    maxBreadcrumbs: 50,
    debug: true,
    tracesSampleRate: 1.0,
  });
  
  console.log(`✅ Sentry initialized in ${process.env.NODE_ENV || 'development'} environment`);
} else {
  console.warn('⚠️ SENTRY_DSN not found - Sentry will not be initialized');
}