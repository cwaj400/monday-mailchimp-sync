const pino = require('pino');
const Sentry = require('@sentry/node');

// Create Pino logger (JSON format for production compatibility)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV,
    service: 'monday-mailchimp-sync'
  } 
});

// Pino-Sentry integration
const pinoSentry = {
  info: (message, data = {}) => {
    logger.info(data, message);
    // Only add breadcrumb for important info (not every log)
    if (data.important || data.critical) {
      Sentry.addBreadcrumb({
        category: 'logger',
        message,
        level: 'info',
        data
      });
    }
  },

  warn: (message, data = {}) => {
    logger.warn(data, message);
    // Add breadcrumb for warnings (these are important)
    Sentry.addBreadcrumb({
      category: 'logger',
      message,
      level: 'warning',
      data
    });
  },

  error: (message, data = {}) => {
    logger.error(data, message);
    // Add breadcrumb for errors (these are important)
    Sentry.addBreadcrumb({
      category: 'logger',
      message,
      level: 'error',
      data
    });
  },

  debug: (message, data = {}) => {
    logger.debug(data, message);
  },

  // Log with span context
  logWithSpan: (span, message, data = {}) => {
    if (span && typeof span.setAttribute === 'function') {
      span.setAttribute('log_message', message);
      span.setAttribute('log_data', JSON.stringify(data));
    }
    
    logger.info(data, message);
    
    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'logger.span',
      message,
      level: 'info',
      data: {
        ...data,
        spanName: span?.name
      }
    });
  },

  // Log webhook events
  webhook: (type, message, data = {}) => {
    logger.info({ ...data, webhookType: type }, `[WEBHOOK] ${message}`);
    
    Sentry.addBreadcrumb({
      category: `webhook.${type}`,
      message,
      level: 'info',
      data
    });
  },

  // Log API requests
  api: (method, path, data = {}) => {
    logger.info({ ...data, method, path }, `[API] ${method} ${path}`);
    
    Sentry.addBreadcrumb({
      category: 'api.request',
      message: `${method} ${path}`,
      level: 'info',
      data
    });
  }
};

module.exports = {
  logger: pinoSentry,
  pino: logger
};
