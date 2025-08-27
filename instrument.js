const Sentry = require("@sentry/node");
const dotenv = require('dotenv');

dotenv.config();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    enableLogs: true,
  });
  
  console.log(`✅ Sentry initialized in ${process.env.NODE_ENV || 'development'} environment`);
} else {
  console.warn('⚠️ SENTRY_DSN not found - Sentry will not be initialized');
}