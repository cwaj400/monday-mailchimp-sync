const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Sentry (now handled in instrument.js)
function initSentry() {
  // Sentry is already initialized in instrument.js
  // This function is kept for backward compatibility
  return !!process.env.SENTRY_DSN;
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
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level
  });
}

// Set user context
function setUser(user) {
  Sentry.setUser(user);
}

// Start a new span (replaces startTransaction)
// In Sentry v9.x, startSpanManual doesn't take a callback
function startSpanManual(options) {
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