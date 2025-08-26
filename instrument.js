const Sentry = require("@sentry/node");
const { CaptureConsole } = require('@sentry/integrations');
const dotenv = require('dotenv');

dotenv.config();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    maxBreadcrumbs: 50,
    tracesSampleRate: 1.0,
    // Remove debug: true for production
    beforeSend(event) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sentry event:', event);
      }
      return event;
    }
  });
  
  console.log(`✅ Sentry initialized in ${process.env.NODE_ENV || 'development'} environment`);
} else {
  console.warn('⚠️ SENTRY_DSN not found - Sentry will not be initialized');
}

module.exports = Sentry;