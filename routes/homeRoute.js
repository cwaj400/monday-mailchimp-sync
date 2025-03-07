const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    console.log('Home route accessed');
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
        <div class="status-item">
          <span class="status-label">Discord:</span>
          <span class="status-value">${process.env.DISCORD_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}</span>
        </div>
        ${process.env.MAILCHIMP_AUDIENCE_NAME ? 
          `<div class="status-item">
            <span class="status-label">Mailchimp Audience:</span>
            <span class="status-value">${process.env.MAILCHIMP_AUDIENCE_NAME}</span>
          </div>` : ''}
        <div class="status-item">
          <span class="status-label">Mailchimp Audience ID:</span>
          <span class="status-value">${process.env.MAILCHIMP_AUDIENCE_ID || 'Not configured'}</span>
        </div>
      </div>
      
      <h2>API Endpoints</h2>
      
      <div class="endpoint-group">
        <h3>System Endpoints</h3>
        <ul>
          <li><code>/api/status</code> - Check service status</li>
          <li><code>/health</code> - Simple health check</li>
        </ul>
      </div>
      
      <div class="endpoint-group">
        <h3>Webhook Endpoints</h3>
        <ul>
          <li><code>/api/webhooks/mailchimp</code> - Receive Mailchimp webhook events</li>
          <li><code>/api/webhooks/test</code> - Test endpoint for webhook functionality</li>
          <li><code>/api/webhooks/process-campaign/:campaignId</code> - Manually process a campaign</li>
        </ul>
      </div>
      
      <div class="endpoint-group">
        <h3>Monday.com Endpoints</h3>
        <ul>
          <li><code>/api/monday</code> - Check Monday.com connection status</li>
          <li><code>/api/monday/getLeads</code> - Get leads from Monday.com</li>
          <li><code>/api/monday/updateTouchpoints</code> - Update touchpoints for contacts</li>
          <li><code>/api/monday/webhook</code> - Handle Monday.com webhook events</li>
          <li><code>/api/monday/board/:boardId</code> - Get board information</li>
          <li><code>/api/monday/board/:boardId/items</code> - Get items from a board</li>
          <li><code>/api/monday/item/:itemId/increment-touchpoints</code> - Increment touchpoints for an item</li>
        </ul>
      </div>
      
      <div class="endpoint-group">
        <h3>Mailchimp Endpoints</h3>
        <ul>
          <li><code>/api/mailchimp</code> - Check Mailchimp connection status and account information</li>
          <li><code>/api/mailchimp/list</code> - Get Mailchimp audience information</li>
          <li><code>/api/mailchimp/list/members</code> - Get audience members (paginated)</li>
          <li><code>/api/mailchimp/list/members</code> (POST) - Add a single member to the audience</li>
          <li><code>/api/mailchimp/list/campaigns</code> - Get campaigns for the audience</li>
          <li><code>/api/mailchimp/list/growth-history</code> - Get audience growth history</li>
        </ul>
      </div>
      
      <div class="endpoint-group">
        <h3>Settings Endpoints</h3>
        <ul>
          <li><code>/api/settings</code> - View application settings</li>
        </ul>
      </div>
      
      <footer>
        <p>Monday-Mailchimp Integration Service | Version 1.0.0 | ${formattedEnv} Environment</p>
      </footer>
    </body>
    </html>
  `);
});

module.exports = router; 