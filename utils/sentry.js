const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Sentry
function initSentry() {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not found in environment variables. Sentry will not be initialized.');
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      // Capture console.error() calls as Sentry events
      new CaptureConsole({
        levels: ['error']
      })
    ],
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
    tracesSampleRate: 1.0,
    // Adjust this value in production to control how many transactions are captured
    // Values between 0 and 1 control the percentage of transactions captured
  });

  console.log(`✅ Sentry initialized in ${process.env.NODE_ENV || 'development'} environment`);
  return true;
}

// Set up Express error handler
function setupExpressErrorHandler(app) {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  // The error handler must be registered before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app);
}

// Capture exception with additional context
function captureException(error, context = {}) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.withScope(scope => {
    // Add additional context information
    for (const key in context) {
      scope.setExtra(key, context[key]);
    }
    Sentry.captureException(error);
  });
}

// Add breadcrumb for tracking events
function addBreadcrumb(message, category, data = {}, level = 'info') {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level
  });
}

// Set user context
function setUser(user) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.setUser(user);
}

// Start a new span (replaces startTransaction)
// In Sentry v9.x, startSpanManual doesn't take a callback
function startSpanManual(options) {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  // Create the span options
  const spanOptions = {
    name: options.name,
    op: options.op,
    attributes: options.attributes || {},
    forceTransaction: options.forceTransaction || false
  };

  // Return the span - caller must manually end it with span.end()
  return Sentry.startInactiveSpan(spanOptions);
}

module.exports = {
  initSentry,
  setupExpressErrorHandler,
  captureException,
  addBreadcrumb,
  setUser,
  startSpanManual,
  Sentry
}; 