const winston = require('winston');
const Sentry = require('@sentry/node');

// Create a custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'monday-mailchimp-sync',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add Sentry transport for error reporting and info logging
if (process.env.SENTRY_DSN) {
  logger.add(new winston.transports.Console({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // Send errors to Sentry
        if (level === 'error') {
          Sentry.captureException(new Error(message), {
            extra: {
              timestamp,
              level,
              stack,
              ...meta
            }
          });
        }
        
        // Send info messages to Sentry as breadcrumbs
        if (level === 'info' && meta.category === 'webhook') {
          Sentry.addBreadcrumb({
            message,
            category: meta.category || 'info',
            data: meta,
            level: 'info'
          });
          
          // Also send as a message for debugging
          Sentry.captureMessage(message, 'info');
        }
        
        return `${timestamp} ${level}: ${message} ${stack ? `\n${stack}` : ''}`;
      })
    )
  }));
}

// Helper functions for common logging patterns
const logHelpers = {
  // Log webhook events
  webhook: (action, data = {}) => {
    logger.info(`Webhook ${action}`, {
      category: 'webhook',
      ...data
    });
  },

  // Log API calls
  api: (service, action, data = {}) => {
    logger.info(`${service} API ${action}`, {
      category: 'api',
      service,
      action,
      ...data
    });
  },

  // Log enrollment events
  enrollment: (action, data = {}) => {
    logger.info(`Enrollment ${action}`, {
      category: 'enrollment',
      ...data
    });
  },

  // Log errors with context
  error: (message, error, context = {}) => {
    logger.error(message, {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
};

module.exports = {
  logger,
  logHelpers
};
