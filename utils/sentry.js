const Sentry = require('@sentry/node');

// Helper functions only - no initialization
function captureException(error, context = {}) {
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}

function addBreadcrumb(message, category, data = {}, level = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level
  });
}

function startSpan(options) {
  return Sentry.startInactiveSpan(options);
}

module.exports = {
  captureException,
  addBreadcrumb,
  startSpan,
  Sentry
};