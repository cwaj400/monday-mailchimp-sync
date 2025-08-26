require('./instrument.js');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { apiKeyAuth } = require('./utils/authMiddleware');
const { Sentry, setupExpressErrorHandler } = require('./utils/sentry');

// Routes
const webhookRoutes = require('./routes/webhookRoutes');
const mondayRoutes = require('./routes/mondayRoutes');
const mailchimpRoutes = require('./routes/mailchimpRoutes');
const statusRoutes = require('./routes/statusRoutes');
const homeRoute = require('./routes/homeRoute');
const healthRoute = require('./routes/healthRoute');

const app = express();
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//validateEnv();

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/monday', apiKeyAuth, mondayRoutes);
app.use('/api/mailchimp', apiKeyAuth, mailchimpRoutes);
app.use('/api/status', statusRoutes);
app.use('/', homeRoute);
app.use('/health', healthRoute);

app.get('test', (req, res) => {
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



// Test with the new span-based API
app.get("/debug-sentry/span", function(req, res) {
  try {
    // Add some breadcrumbs
    Sentry.addBreadcrumb({
      message: 'User accessed debug span route',
      category: 'navigation',
      data: { 
        path: '/debug-sentry/span',
        query: req.query
      }
    });
    
    // Create a span
    const span = Sentry.startInactiveSpan({
      name: "test-span",
      op: "test",
      attributes: {
        path: '/debug-sentry/span',
        query: req.query
      }
    });
    
    // Simulate an error
    try {
      const obj = null;
      obj.nonExistentMethod();
    } catch (error) {
      Sentry.captureException(error);
      span.end();
      res.status(500).send('Error captured with span and sent to Sentry');
      return;
    }
    
    span.end();
    res.send('Span completed successfully');
  } catch (error) {
    console.error('Error in span test route:', error);
    res.status(500).send('Error in span test route');
  }
});

// Test with performance monitoring using spans
app.get("/debug-sentry/performance", async function(req, res) {
  try {
    // Create a parent span
    const parentSpan = Sentry.startInactiveSpan({
      name: "test-performance",
      op: "test",
      forceTransaction: true
    });
    
    // Create a child span
    const childSpan1 = Sentry.startInactiveSpan({
      name: "test-operation-1",
      op: "test.operation"
    });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // End the first child span
    childSpan1.end();
    
    // Create another child span
    const childSpan2 = Sentry.startInactiveSpan({
      name: "test-operation-2",
      op: "test.operation"
    });
    
    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // End the second child span
    childSpan2.end();
    
    // End the parent span
    parentSpan.end();
    
    res.send('Performance data sent to Sentry');
  } catch (error) {
    console.error('Error in performance test route:', error);
    res.status(500).send('Error in performance test route');
  }
});

// Set up Sentry error handler
app.use(Sentry.Handlers.errorHandler());

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