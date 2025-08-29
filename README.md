# Monday.com to Mailchimp Enrollment System

A robust integration service that automatically enrolls customers in Mailchimp campaigns when they submit inquiries through Monday.com, with comprehensive email tracking, Discord notifications, and batch processing for improved reliability.

## 🌟 Features

- **Automatic Enrollment**: New Monday.com inquiries automatically enroll customers in Mailchimp
- **Batch Processing**: Uses Mailchimp Batch API for reliable, non-blocking operations
- **Email Tracking**: Track when emails are sent, opened, and clicked
- **Monday.com Integration**: Real-time webhook processing for new inquiries
- **Mailchimp Integration**: API-based enrollment and webhook-based tracking
- **Discord Notifications**: Real-time alerts for enrollments and email activity
- **Error Tracking**: Sentry integration for monitoring and debugging
- **Security**: API key authentication, rate limiting, and IP whitelisting
- **Batch Monitoring**: Real-time monitoring of Mailchimp batch operations

## 🔄 How It Works

### Enrollment Flow (Batch API)
```
Customer submits inquiry → Monday.com webhook → Extract email → Queue in Mailchimp Batch → Immediate response → Discord notification
```

### Email Tracking Flow
```
Mailchimp sends email → Mailchimp webhook → Update Monday.com → Increment touchpoints → Discord notification
```

### Batch Processing Benefits
- **No Timeouts**: 2-3 second response vs. 30-60 second direct API calls
- **High Reliability**: Mailchimp handles processing in background
- **Better Scalability**: Can handle 15-30x more webhooks
- **Error Resilience**: Network issues don't affect webhook responses

## 🚀 Quick Start

### 1. Deploy to Vercel
```bash
# Clone and deploy
git clone https://github.com/yourusername/monday-mailchimp-sync.git
cd monday-mailchimp-sync
vercel --prod
```

### 2. Configure Environment Variables
Add these to your Vercel dashboard:

```bash
# System Configuration
NODE_ENV=production

# Mailchimp Configuration
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_AUDIENCE_ID=your_audience_id
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_WEBHOOK_SECRET=your_webhook_secret

# Monday.com Configuration
MONDAY_API_KEY=your_monday_api_key
MONDAY_BOARD_ID=your_board_id
MONDAY_SIGNING_SECRET=your_webhook_secret
MONDAY_CLIENT_ID=your_client_id

# Discord Configuration
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Monitoring & Error Tracking
SENTRY_DSN=your_sentry_dsn

# Optional Configuration
ALLOWED_IPS=192.168.1.1,10.0.0.1  # Optional IP whitelist
ENROLLMENT_TAG=Newly Enquiried from API
WELCOME_CAMPAIGN_ID=your_campaign_id
```

### 3. Set Up Webhooks

#### Monday.com Webhook (for enrollment)
1. Go to Monday.com → Automations → Create automation
2. Set trigger: "When an item is created"
3. Add action: "Webhook"
4. Enter URL: `https://your-app.vercel.app/api/webhooks/monday`
5. Set webhook secret in environment variables

#### Mailchimp Webhook (for email tracking)
1. Go to Mailchimp → Audience → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/webhooks/mailchimp`
3. Select events: Subscribe, Unsubscribe, Email opens, Email clicks
4. Set webhook secret in environment variables

### 4. Test the System
1. Create a new item in your Monday.com board
2. Add a valid email address
3. Check Mailchimp for new subscriber
4. Check Discord for notification
5. Monitor batch status via API

## 📡 API Endpoints

### Webhook Endpoints

#### Monday.com Webhook
```bash
POST /api/webhooks/monday
```
- **Purpose**: Receives Monday.com item creation events
- **Authentication**: None (webhook signature verification)
- **Response**: Immediate acknowledgment, processes in background

#### Mailchimp Webhook
```bash
POST /api/webhooks/mailchimp
```
- **Purpose**: Receives Mailchimp email activity events
- **Authentication**: None (webhook signature verification)
- **Response**: Immediate acknowledgment, processes in background

### Batch Monitoring API (Protected)

#### Get All Batches
```bash
GET /api/mailchimp/batches
```
**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "id": "px6yzxyoeb",
      "status": "finished",
      "total_operations": 1,
      "finished_operations": 1,
      "errored_operations": 0,
      "submitted_at": "2025-08-29T17:03:57+00:00",
      "completed_at": "2025-08-29T17:03:59+00:00"
    }
  ],
  "total": 1,
  "timestamp": "2025-08-29T17:09:29.871Z"
}
```

#### Get Specific Batch Status
```bash
GET /api/mailchimp/batches/{batchId}
```
**Response:**
```json
{
  "success": true,
  "batch": {
    "id": "px6yzxyoeb",
    "status": "finished",
    "total_operations": 1,
    "finished_operations": 1,
    "errored_operations": 0,
    "response_body_url": "https://..."
  },
  "timestamp": "2025-08-29T17:09:29.871Z"
}
```

#### Get Active Batches Only
```bash
GET /api/mailchimp/batches/active
```
**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "id": "batch_456",
      "status": "processing",
      "total_operations": 1,
      "finished_operations": 0,
      "errored_operations": 0
    }
  ],
  "count": 1,
  "timestamp": "2025-08-29T17:09:29.871Z"
}
```

### System Status Endpoints

#### Health Check
```bash
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-29T17:09:29.871Z"
}
```

#### System Status
```bash
GET /api/status
```
**Response:**
```json
{
  "status": "operational",
  "configured": true,
  "services": {
    "monday": "connected",
    "mailchimp": "connected",
    "discord": "connected",
    "sentry": "connected"
  },
  "timestamp": "2025-08-29T17:09:29.871Z"
}
```

## 🔒 Security Features

### API Key Authentication
- **Required**: All batch monitoring endpoints require header
- **Security**: Invalid or missing keys return 401 Unauthorized

### Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit info included in response headers
- **Response**: 429 status with retry information when exceeded

### IP Whitelisting (Optional)
- **Environment Variable**: `ALLOWED_IPS` (comma-separated)
- **Fallback**: Allows all IPs if not configured
- **Security**: Returns 403 Forbidden for unauthorized IPs

### Request Logging
- **All requests logged** with IP and User-Agent
- **Rate limit violations** logged
- **Unauthorized access attempts** tracked

### Security Headers
- **XSS Protection**: `X-XSS-Protection: 1; mode=block`
- **Content Type Options**: `X-Content-Type-Options: nosniff`
- **Frame Options**: `X-Frame-Options: DENY`

### Input Validation
- **Batch ID format validation**
- **Email format validation**
- **Request body validation**

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MAILCHIMP_API_KEY` | Mailchimp API key for enrollment | ✅ | `6-us1` |
| `MAILCHIMP_AUDIENCE_ID` | Mailchimp audience ID | ✅ | `bf2` |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp server prefix | ✅ | `us1` |
| `MONDAY_API_KEY` | Monday.com API key | ✅ | `eyIUzI1NiJ9...` |
| `MONDAY_BOARD_ID` | Monday.com board ID | ✅ | `6432503726` |
| `SENTRY_DSN` | Sentry DSN for error tracking | ❌ | `https://...@...ingest.sentry.io/...` |
| `MONDAY_SIGNING_SECRET` | Monday.com webhook secret | ❌ | `abc123...` |
| `MAILCHIMP_WEBHOOK_SECRET` | Mailchimp webhook secret | ❌ | `abc123...` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_IPS` | Comma-separated list of allowed IPs | Allow all |
| `ENROLLMENT_TAG` | Tag to add to enrolled subscribers | `Newly Enquiried from API` |
| `WELCOME_CAMPAIGN_ID` | Welcome campaign ID | None |
| `NODE_ENV` | Environment (development/production) | `development` |

### How to Get API Keys

#### Mailchimp
1. Go to Mailchimp → Account → Extras → API Keys
2. Generate a new API key
3. Go to Audience → Settings → Audience name and defaults
4. Copy the Audience ID
5. Note your server prefix (e.g., us1, us2)

#### Monday.com
1. Go to Monday.com → Admin → API
2. Generate a new API key
3. Note your board ID from the URL
4. Set up webhook signing secret

#### Discord
1. Go to your Discord server → Server Settings → Integrations → Webhooks
2. Create a new webhook
3. Copy the webhook URL

#### App API Key
Generate a secure API key for batch monitoring:
```bash
# Generate a secure API key
openssl rand -base64 32
```

## 📊 Monitoring & Debugging

### Batch Monitoring
```bash
# Check all batches
  https://your-app.vercel.app/api/mailchimp/batches

# Check active batches
  https://your-app.vercel.app/api/mailchimp/batches/active

# Check specific batch
  https://your-app.vercel.app/api/mailchimp/batches/batch_id
```

### Status Endpoint
Check system status: `https://your-app.vercel.app/api/status`

### Sentry Dashboard
- **Performance**: Look for `monday_webhook` transactions
- **Issues**: Check for webhook processing errors
- **Breadcrumbs**: Track webhook flow and email extraction

### Vercel Logs
```bash
vercel logs --follow
```

### Discord Notifications
You'll receive notifications for:
- ✅ Successful enrollments (batch queued or direct)
- ❌ Failed enrollments
- 📧 Email activity (sends, opens, clicks)
- ⚠️ System warnings

## 🛠️ Troubleshooting

### System Not Working

#### 1. Check Environment Variables
Visit: `https://your-app.vercel.app/api/status`
Should show: `"configured": true`

#### 2. Check Webhook URLs
- **Monday.com webhook**: `https://your-app.vercel.app/api/webhooks/monday`
- **Mailchimp webhook**: `https://your-app.vercel.app/api/webhooks/mailchimp`

#### 3. Test Webhook Endpoints
```bash
# Test Monday.com webhook
curl -X POST https://your-app.vercel.app/api/webhooks/monday \
  -H "Content-Type: application/json" \
  -d '{"challenge": "test123"}'

# Expected response: {"challenge": "test123"}

# Test Mailchimp webhook
curl -X POST https://your-app.vercel.app/api/webhooks/mailchimp \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'

# Expected response: {"success": true, "message": "Webhook received, processing in background"}
```


#### 4. Check Vercel Logs
```bash
vercel logs --follow
```

### Common Issues

#### "configured": false
Missing environment variables. Add all required variables to Vercel.

#### No webhook events in Sentry
Monday.com webhook not configured or pointing to wrong URL.

#### Enrollment fails
Check Mailchimp API key and audience ID.

#### Email tracking not working
Check Mailchimp webhook configuration.

#### Batch operations failing
- Check Mailchimp API key permissions
- Verify audience ID is correct
- Check server prefix matches your Mailchimp account

#### Rate limiting errors
- Reduce request frequency
- Check if you're hitting the 100 requests/15min limit
- Consider implementing caching if needed

## 📁 Project Structure

```
├── routes/
│   ├── webhookRoutes.js          # Main webhook endpoints
│   ├── mailchimpRoutes.js        # Batch monitoring API
│   ├── statusRoutes.js           # System status endpoint
│   ├── mondayRoutes.js           # Monday.com API endpoints
│   └── webhookHandlers/          # Webhook processing logic
│       ├── handleEmailSend.js    # Email send events
│       ├── handleEmailOpen.js    # Email open events
│       ├── handleEmailClick.js   # Email click events
│       └── processEmailEvent.js  # Common email processing
├── utils/
│   ├── mondayService.js          # Monday.com API functions
│   ├── mailchimpEnrollmentService.js # Enrollment logic with batch API
│   ├── mailchimpClient.js        # Mailchimp API client
│   ├── discordNotifier.js        # Discord notifications
│   ├── sentry.js                 # Error tracking with safe flush
│   ├── authMiddleware.js         # API key authentication
│   └── validateEnvs.js           # Environment validation
├── scripts/                      # Testing and setup scripts
├── tests/                        # Test files
├── BATCH_API_DOCS.md            # Detailed batch API documentation
└── vercel.json                   # Vercel configuration
```

## 🔒 Security & Error Handling

### Webhook Verification
- Monday.com webhooks are verified using HMAC signatures
- Mailchimp webhooks are verified using webhook secrets
- Invalid signatures return 403 Forbidden responses

### Error Handling
- **Graceful Error Responses**: All webhook endpoints return proper HTTP status codes
- **Span Management**: Sentry spans are properly closed to prevent memory leaks
- **Background Processing**: Webhooks are acknowledged immediately, then processed asynchronously
- **Error Logging**: Comprehensive error tracking with Sentry and Discord notifications
- **Network Error Handling**: Sentry flush errors are handled silently to reduce log noise

### Request Validation
- Empty request bodies are rejected with 400 Bad Request
- Malformed webhook data is logged and handled gracefully
- All exceptions are caught and logged with context
- API key validation on protected endpoints

### Environment Variables
- All sensitive data stored in Vercel environment variables
- No hardcoded API keys or secrets
- Environment validation on startup

### Security Scanning
- Snyk integration for vulnerability scanning
- Pre-commit hooks for security checks
- **Note**: Vercel dependency vulnerabilities (like undici) are known issues that will be fixed in future Vercel updates

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# Configure webhooks in Monday.com and Mailchimp
# Test batch monitoring API
```

### Other Platforms
- Railway
- Heroku
- DigitalOcean App Platform

## 📈 Performance & Reliability

### Webhook Processing
- **Asynchronous Processing**: Webhooks are acknowledged immediately, then processed in background
- **Error Resilience**: Comprehensive error handling with proper HTTP responses
- **Memory Management**: Sentry spans are properly closed to prevent memory leaks
- **Request Validation**: Invalid requests are rejected with appropriate status codes

### Batch Processing Benefits
- **No Timeouts**: 2-3 second response vs. 30-60 second direct API calls
- **High Reliability**: Mailchimp handles processing in background
- **Better Scalability**: Can handle 15-30x more webhooks
- **Error Resilience**: Network issues don't affect webhook responses

### Reliability Features
- **Immediate Acknowledgment**: Prevents webhook timeouts from external services
- **Graceful Degradation**: System continues working even if individual webhooks fail
- **Retry Logic**: Built-in retry mechanisms for transient failures
- **Error Isolation**: Failures in one webhook don't affect others
- **Fallback Processing**: Falls back to direct API if batch fails

### Rate Limiting
- **Batch API**: 100 requests per 15 minutes per IP
- **Mailchimp**: 10 requests/second
- **Monday.com**: 1000 requests/minute
- **Discord**: 5 requests/second

### Monitoring
- **Sentry Performance Monitoring**: Track webhook processing times and errors
- **Vercel Function Logs**: Real-time logging of webhook events and errors
- **Discord Notifications**: Instant alerts for successful enrollments and errors
- **Span Tracking**: Detailed performance tracing for debugging webhook issues
- **Batch Monitoring**: Real-time status of Mailchimp batch operations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Monday.com API](https://developer.monday.com/)
- [Mailchimp Marketing API](https://mailchimp.com/developer/)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Sentry](https://sentry.io/)
- [Vercel](https://vercel.com/)
- [Snyk Security](https://snyk.io/)

## 🆘 Support

### Getting Help
1. Check the troubleshooting section above
2. Review Vercel logs for errors
3. Check Sentry for error details
4. Verify webhook configurations
5. Test batch monitoring API

### Common Questions

**Q: Why isn't my system enrolling customers?**
A: Check that Monday.com webhook is configured and environment variables are set.

**Q: How do I track email activity?**
A: Configure Mailchimp webhook to point to `/api/webhooks/mailchimp`.

**Q: Where do I see notifications?**
A: Check your Discord channel for real-time notifications.

**Q: How do I debug issues?**
A: Use Sentry dashboard, Vercel logs, Discord notifications, and batch monitoring API.

**Q: What happens if a webhook fails?**
A: Errors are logged to Sentry, notifications sent to Discord, and proper HTTP error responses are returned.

**Q: How do I prevent webhook timeouts?**
A: Webhooks are acknowledged immediately, then processed asynchronously to prevent timeouts.

**Q: What's the difference between batch and direct API?**
A: Batch API provides immediate response (2-3s) while Mailchimp processes in background. Direct API blocks until processing completes (30-60s).

**Q: How do I monitor batch operations?**
A: Use the batch monitoring API endpoints with your API key to check status.

**Q: What about Snyk security vulnerabilities in Vercel dependencies?**
A: Vercel dependency vulnerabilities (like undici) are known issues that will be fixed in future Vercel updates. These don't affect your application's security. 