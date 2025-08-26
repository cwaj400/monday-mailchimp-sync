const Sentry = require('@sentry/node');

// Helper functions only - no initialization
function captureException(error, context = {}) {
  Sentry.withScope(scope => {
    for (const key in context) {
      scope.setExtra(key, context[key]);
    }
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

function startSpanManual(options) {
  return Sentry.startInactiveSpan(options);
}

module.exports = {
  captureException,
  addBreadcrumb,
  startSpanManual,
  Sentry
};