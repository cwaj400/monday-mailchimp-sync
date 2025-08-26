# Monday.com to Mailchimp Enrollment System

A robust integration service that automatically enrolls customers in Mailchimp campaigns when they submit inquiries through Monday.com, with comprehensive email tracking and Discord notifications.

## 🌟 Features

- **Automatic Enrollment**: New Monday.com inquiries automatically enroll customers in Mailchimp
- **Email Tracking**: Track when emails are sent, opened, and clicked
- **Monday.com Integration**: Real-time webhook processing for new inquiries
- **Mailchimp Integration**: API-based enrollment and webhook-based tracking
- **Discord Notifications**: Real-time alerts for enrollments and email activity
- **Error Tracking**: Sentry integration for monitoring and debugging
- **Security**: Snyk integration for vulnerability scanning

## 🔄 How It Works

### Enrollment Flow
```
Customer submits inquiry → Monday.com webhook → Extract email → Enroll in Mailchimp → Discord notification
```

### Email Tracking Flow
```
Mailchimp sends email → Mailchimp webhook → Update Monday.com → Increment touchpoints → Discord notification
```

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
# Mailchimp Configuration
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_AUDIENCE_ID=your_audience_id
MAILCHIMP_SERVER_PREFIX=us1

# Monday.com Configuration
MONDAY_API_KEY=your_monday_api_key
MONDAY_BOARD_ID=6432503726

# Discord Configuration
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Optional but recommended
SENTRY_DSN=your_sentry_dsn
MONDAY_WEBHOOK_SECRET=your_webhook_secret
ENROLLMENT_TAG=Inquiry Enrolled
```

### 3. Set Up Webhooks

#### Monday.com Webhook (for enrollment)
1. Go to Monday.com → Automations → Create automation
2. Set trigger: "When an item is created"
3. Add action: "Webhook"
4. Enter URL: `https://your-app.vercel.app/api/webhooks/monday`

#### Mailchimp Webhook (for email tracking)
1. Go to Mailchimp → Audience → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/webhooks/mailchimp`
3. Select events: Subscribe, Unsubscribe, Email opens, Email clicks

### 4. Test the System
1. Create a new item in your Monday.com board
2. Add a valid email address
3. Check Mailchimp for new subscriber
4. Check Discord for notification

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MAILCHIMP_API_KEY` | Mailchimp API key for enrollment | ✅ |
| `MAILCHIMP_AUDIENCE_ID` | Mailchimp audience ID | ✅ |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp server prefix (e.g., us1) | ✅ |
| `MONDAY_API_KEY` | Monday.com API key | ✅ |
| `MONDAY_BOARD_ID` | Monday.com board ID | ✅ |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for notifications | ✅ |
| `SENTRY_DSN` | Sentry DSN for error tracking | ❌ |
| `MONDAY_WEBHOOK_SECRET` | Monday.com webhook secret for security | ❌ |
| `ENROLLMENT_TAG` | Tag to add to enrolled subscribers | ❌ |

### How to Get API Keys

#### Mailchimp
1. Go to Mailchimp → Account → Extras → API Keys
2. Generate a new API key
3. Go to Audience → Settings → Audience name and defaults
4. Copy the Audience ID

#### Monday.com
1. Go to Monday.com → Admin → API
2. Generate a new API key
3. Note your board ID from the URL

#### Discord
1. Go to your Discord server → Server Settings → Integrations → Webhooks
2. Create a new webhook
3. Copy the webhook URL

## 📊 Monitoring & Debugging

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
- ✅ Successful enrollments
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

#### Webhook timeouts or hanging requests
- Check that webhook endpoints return responses quickly
- Verify background processing is working correctly
- Review Vercel function timeout settings

#### Memory leaks or high resource usage
- Ensure Sentry spans are properly closed
- Check for unhandled promise rejections
- Monitor function execution times

## 📁 Project Structure

```
├── routes/
│   ├── webhookRoutes.js          # Main webhook endpoints
│   ├── statusRoutes.js           # System status endpoint
│   └── webhookHandlers/          # Webhook processing logic
│       ├── handleEmailSend.js    # Email send events
│       ├── handleEmailOpen.js    # Email open events
│       ├── handleEmailClick.js   # Email click events
│       └── processEmailEvent.js  # Common email processing
├── utils/
│   ├── mondayService.js          # Monday.com API functions
│   ├── mailchimpEnrollmentService.js # Enrollment logic
│   ├── mailchimpClient.js        # Mailchimp API client
│   ├── discordNotifier.js        # Discord notifications
│   └── sentry.js                 # Error tracking
├── scripts/                      # Testing and setup scripts
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

### Request Validation
- Empty request bodies are rejected with 400 Bad Request
- Malformed webhook data is logged and handled gracefully
- All exceptions are caught and logged with context

### Environment Variables
- All sensitive data stored in Vercel environment variables
- No hardcoded API keys or secrets

### Security Scanning
- Snyk integration for vulnerability scanning
- Pre-commit hooks for security checks

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# Configure webhooks in Monday.com and Mailchimp
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

### Reliability Features
- **Immediate Acknowledgment**: Prevents webhook timeouts from external services
- **Graceful Degradation**: System continues working even if individual webhooks fail
- **Retry Logic**: Built-in retry mechanisms for transient failures
- **Error Isolation**: Failures in one webhook don't affect others

### Rate Limiting
- Mailchimp: 10 requests/second
- Monday.com: 1000 requests/minute
- Discord: 5 requests/second

### Monitoring
- **Sentry Performance Monitoring**: Track webhook processing times and errors
- **Vercel Function Logs**: Real-time logging of webhook events and errors
- **Discord Notifications**: Instant alerts for successful enrollments and errors
- **Span Tracking**: Detailed performance tracing for debugging webhook issues

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

### Common Questions

**Q: Why isn't my system enrolling customers?**
A: Check that Monday.com webhook is configured and environment variables are set.

**Q: How do I track email activity?**
A: Configure Mailchimp webhook to point to `/api/webhooks/mailchimp`.

**Q: Where do I see notifications?**
A: Check your Discord channel for real-time notifications.

**Q: How do I debug issues?**
A: Use Sentry dashboard, Vercel logs, and Discord notifications.

**Q: What happens if a webhook fails?**
A: Errors are logged to Sentry, notifications sent to Discord, and proper HTTP error responses are returned.

**Q: How do I prevent webhook timeouts?**
A: Webhooks are acknowledged immediately, then processed asynchronously to prevent timeouts. 