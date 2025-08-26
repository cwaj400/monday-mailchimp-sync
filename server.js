require('./instrument.js');

const express = require('express');
const cors = require('cors');
const { apiKeyAuth } = require('./utils/authMiddleware');
const { logger } = require('./utils/logger');

// Import Sentry after initialization
const Sentry = require('@sentry/node');

// Routes
const webhookRoutes = require('./routes/webhookRoutes');
const mondayRoutes = require('./routes/mondayRoutes');
const mailchimpRoutes = require('./routes/mailchimpRoutes');
const statusRoutes = require('./routes/statusRoutes');
const homeRoute = require('./routes/homeRoute');
const healthRoute = require('./routes/healthRoute');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/monday', apiKeyAuth, mondayRoutes);
app.use('/api/mailchimp', apiKeyAuth, mailchimpRoutes);
app.use('/api/status', statusRoutes);
app.use('/', homeRoute);
app.use('/health', healthRoute);

app.get('/test', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/test-sentry', (req, res) => {
  res.json({
    sentryType: typeof Sentry,
    sentryKeys: Object.keys(Sentry || {}),
    hasGetClient: typeof Sentry.getClient === 'function',
    hasIsInitialized: typeof Sentry.isInitialized === 'function',
    hasInit: typeof Sentry.init === 'function',
    hasCaptureException: typeof Sentry.captureException === 'function',
    hasStartSpan: typeof Sentry.startSpan === 'function',
    dsnPresent: !!process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sdkVersion: Sentry.SDK_VERSION,
  });
});

// Add test routes for Sentry
app.get("/debug-sentry", function mainHandler(req, res) {
  try {
    throw new Error("My first Sentry error!");
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: 'Error captured with span and sent to Sentry', message: "Check sentry" });
  }
});

app.get('/sentry-diagnostics', (req, res) => {
  try {
    // Use the new Sentry v9 API
    const client = Sentry.getClient();
    const isInitialized = Sentry.isInitialized();
    
    res.json({
      initialized: isInitialized,
      dsnPresent: !!process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      hasClient: !!client,
      clientOptions: client ? {
        dsn: client.getOptions?.()?.dsn || null,
        environment: client.getOptions?.()?.environment || null,
        release: client.getOptions?.()?.release || null,
      } : null,
      sentryVersion: Sentry.SDK_VERSION,
    });
  } catch (error) {
    res.json({
      initialized: false,
      dsnPresent: !!process.env.SENTRY_DSN,
      error: error.message,
      environment: process.env.NODE_ENV,
      sentryType: typeof Sentry,
      sentryKeys: Object.keys(Sentry || {}),
    });
  }
});


app.get('/debug-sentry/performance', async (req, res) => {
  try {
    await Sentry.startSpan(
      { name: 'test-performance', op: 'test' }, // parent
      async () => {
        await Sentry.startSpan(
          { name: 'test-operation-1', op: 'test.operation' }, // child 1
          async () => {
            await new Promise(r => setTimeout(r, 500));
          }
        );

        await Sentry.startSpan(
          { name: 'test-operation-2', op: 'test.operation' }, // child 2
          async () => {
            await new Promise(r => setTimeout(r, 300));
          }
        );
      }
    );

    // make sure events actually get sent before reply (important on Vercel)
    try { await Sentry.flush(2000); } catch {}

    res.send('Performance data sent to Sentry');
  } catch (error) {
    console.error('Error in performance test route:', error);
    res.status(500).send('Error in performance test route');
  }
});

// New endpoint showing manual span management
app.get('/debug-sentry/manual-span', async (req, res) => {
  try {
    // Use Pino logger (logs to console AND creates Sentry breadcrumbs)
    logger.info('Manual span test started', {
      spanName: 'manual-test-span',
      environment: process.env.NODE_ENV
    });
    // Create a span manually (this gives you access to the span object)
    const span = Sentry.startInactiveSpan({
      name: 'manual-test-span',
      op: 'test.manual'
    });

    // Use the correct Sentry v9 API
    span.setAttribute('custom_data', 'This is custom data');
    span.setAttribute('custom_tag', 'test_value');
    span.setStatus('ok');

    // Add breadcrumbs using Sentry v9 API
    Sentry.addBreadcrumb({
      category: 'manual.span',
      message: 'Starting manual span test',
      level: 'info',
      data: {
        spanName: span.name,
        timestamp: new Date().toISOString()
      }
    });

    // Simulate some work
    await new Promise(r => setTimeout(r, 200));

    // Use Pino logger for processing
    logger.info('Processing completed', {
      processingTime: '200ms',
      spanName: span.name
    });

    // Log with span context
    logger.logWithSpan(span, 'Processing with span context', {
      step: 'processing',
      spanName: span.name
    });

    // Log a warning (creates breadcrumb)
    logger.warn('This is a warning message', {
      warningType: 'test_warning',
      spanName: span.name
    });

    // End the span manually
    span.end();

    Sentry.addBreadcrumb({
      category: "user",
      message: "User information goes here",
      level: "info",
      data: {
        user: {
          name: "John Doe",
          email: "john.doe@example.com",
          id: 123
        }
      }
    });

    

    // Flush to ensure it's sent
    try { await Sentry.flush(2000); } catch {}

    res.json({ 
      success: true, 
      message: 'Manual span created and sent to Sentry',
      spanInfo: {
        name: span.name,
        status: span.status,
        attributes: span.attributes,
        duration: span.duration
      }
    });
  } catch (error) {
    console.error('Error in manual span test:', error);
    res.status(500).json({ error: 'Manual span test failed', message: error.message });
  }
});

// IMPORTANT: add the Sentry error handler AFTER routes, BEFORE your own handler
Sentry.setupExpressErrorHandler(app);


const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // startCronJobs();
});