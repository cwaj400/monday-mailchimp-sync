const express = require('express');
const router = express.Router();
const {logger} = require('../utils/logger');
const Sentry = require('@sentry/node');

router.get('/', (req, res) => {
  // Detect environment
  let environment = process.env.NODE_ENV || 'development';
  
  // Check if this is a Vercel preview deployment otherwise it wil registedre as prod autoumaticlly.
  // don't need vercel env to be set locally as vercel_env is set by vercel when it's deployed.
  const isVercelPreview = process.env.VERCEL_ENV === 'preview';
  if (isVercelPreview) {
    environment = 'preview';
  }
  
  // Format environment name for display (capitalize first letter)
  const formattedEnv = environment.charAt(0).toUpperCase() + environment.slice(1);
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Monday-Mailchimp SOME TEST TO SEE IF BRANCHES AUTOMATICALLY DEPLOY Integration</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #007bff;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        .status {
          background: #f8f9fa;
          border-radius: 4px;
          padding: 15px;
          margin: 20px 0;
        }
        .status-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .status-label {
          font-weight: bold;
        }
        .status-value {
          color: #28a745;
        }
        .status-value.error {
          color: #dc3545;
        }
        .environment-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.9em;
          font-weight: bold;
          margin-left: 8px;
          color: white;
          background-color: ${
            environment === 'production' ? '#dc3545' : 
            environment === 'preview' ? '#6f42c1' :
            environment === 'staging' ? '#fd7e14' : 
            environment === 'test' ? '#6f42c1' : '#28a745'
          };
        }
        .endpoint-group {
          margin-bottom: 20px;
        }
        .endpoint-group h3 {
          color: #6c757d;
          margin-bottom: 10px;
        }
        footer {
          margin-top: 40px;
          font-size: 0.8em;
          color: #6c757d;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>Monday-Mailchimp Integration <span class="environment-badge">${formattedEnv}</span></h1>
      <p>This service synchronizes contacts between Monday.com and Mailchimp, with Discord notifications for important events.</p>
      
      <div class="status">
        <h2>Service Status</h2>
        <div class="status-item">
          <span class="status-label">API Status:</span>
          <span class="status-value">✅ Online</span>
        </div>
        <div class="status-item">
          <span class="status-label">Environment:</span>
          <span class="status-value">${formattedEnv}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Vercel Environment:</span>
          <span class="status-value">${process.env.VERCEL_ENV || 'Not on Vercel'}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Monday.com:</span>
          <span class="status-value">${process.env.MONDAY_API_KEY ? '✅ Configured' : '❌ Not configured'}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Mailchimp:</span>
          <span class="status-value">${process.env.MAILCHIMP_API_KEY ? '✅ Configured' : '❌ Not configured'}</span>
        </div>
      </div>
      <footer>
        <p>Monday-Mailchimp Integration Service | Version 1.0.0 | ${formattedEnv} Environment</p>
      </footer>
    </body>
    </html>
  `);
});

module.exports = router; 