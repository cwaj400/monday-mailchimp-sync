let Sentry;

try {
  Sentry = require('@sentry/node');
} catch (error) {
  console.warn('Sentry not available:', error.message);
  Sentry = null;
}

// Helper functions only - no initialization
function captureException(error, context = {}) {
  if (!Sentry) {
    console.error('Sentry not available for error capture:', error.message);
    return;
  }
  
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}

function addBreadcrumb(message, category, data = {}, level = 'info') {
  if (!Sentry) {
    console.log('Sentry not available for breadcrumb:', message);
    return;
  }
  
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level
  });
}

function startSpan(options) {
  if (!Sentry) {
    console.log('Sentry not available for span creation');
    return null;
  }
  
  return Sentry.startInactiveSpan(options);
}

module.exports = {
  captureException,
  addBreadcrumb,
  startSpan,
  Sentry
};