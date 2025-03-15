require('./instrument.js');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { apiKeyAuth } = require('./utils/authMiddleware');
const { setupExpressErrorHandler } = require('./utils/sentry');

// Routes
const webhookRoutes = require('./routes/webhookRoutes');
const mondayRoutes = require('./routes/mondayRoutes');
const mailchimpRoutes = require('./routes/mailchimpRoutes');
const statusRoutes = require('./routes/statusRoutes');
const homeRoute = require('./routes/homeRoute');
const healthRoute = require('./routes/healthRoute');

const app = express();

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

// Add a test route for Sentry
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// Set up Sentry error handler
setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // startCronJobs();
});