const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { startCronJobs } = require('./services/cronService');
const { validateEnv } = require('./utils/validateEnvs');
// Routes
const webhookRoutes = require('./routes/webhookRoutes');
const mondayRoutes = require('./routes/mondayRoutes');
const mailchimpRoutes = require('./routes/mailchimpRoutes');
const syncRoutes = require('./routes/syncRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Call validateEnv before any other imports or code
validateEnv();

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/monday', mondayRoutes);
app.use('/api/mailchimp', mailchimpRoutes);
app.use('/api/sync', syncRoutes);
app.use('/settings', settingsRoutes);

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Comment out or remove this line
  startCronJobs();
});