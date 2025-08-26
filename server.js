require('./instrument.js');

const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { apiKeyAuth } = require('./utils/authMiddleware');

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
  const hub = Sentry.getCurrentHub();
  const client = hub.getClient();
  const options = client ? client.getOptions?.() : {};

  res.json({
    initialized: !!client,
    dsnPresent: !!process.env.SENTRY_DSN,
    dsnFromClient: options?.dsn || null,
    environment: options?.environment || process.env.NODE_ENV,
    release: options?.release || null,
  });
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

// IMPORTANT: add the Sentry error handler AFTER routes, BEFORE your own handler
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.json({ error: 'Internal server error' + "\n", message: "Check sentry" });
});

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // startCronJobs();
});