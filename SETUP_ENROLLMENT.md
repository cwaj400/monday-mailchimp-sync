# Monday.com to Mailchimp Enrollment Setup Guide

This guide will help you set up automatic enrollment of customers in Mailchimp campaigns when they submit inquiries through Monday.com.

## 🎯 Overview

The enrollment system automatically:
1. Detects new inquiries in Monday.com
2. Extracts and validates email addresses
3. Enrolls customers in your Mailchimp audience
4. Adds enrollment tags for segmentation
5. Sends notifications via Discord
6. Adds audit notes to Monday.com items

## 📋 Prerequisites

- ✅ Monday.com account with API access
- ✅ Mailchimp account with API access
- ✅ Discord webhook URL (for notifications)
- ✅ Node.js application deployed and accessible via HTTPS

## 🔧 Environment Configuration

Add these variables to your `.env` file:

```bash
# Monday.com Configuration
MONDAY_API_KEY=your_monday_api_key
MONDAY_BOARD_ID=your_monday_board_id
MONDAY_WEBHOOK_SECRET=your_monday_webhook_secret
MONDAY_SIGNING_SECRET=your_monday_signing_secret

# Mailchimp Configuration
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=your_audience_id
MAILCHIMP_WEBHOOK_SECRET=your_webhook_secret

# Enrollment Configuration
ENROLLMENT_TAG=Inquiry Enrolled
WELCOME_CAMPAIGN_ID=your_welcome_campaign_id

# Discord Configuration
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Sentry Configuration (for error tracking)
SENTRY_DSN=your_sentry_dsn
```

## 🚀 Step-by-Step Setup

### Step 1: Configure Monday.com

1. **Get API Key**:
   - Go to Monday.com → Admin → API
   - Generate a new API key
   - Copy the key to `MONDAY_API_KEY`

2. **Get Board ID**:
   - Open your inquiry board in Monday.com
   - The board ID is in the URL: `https://monday.com/boards/BOARD_ID`
   - Copy the ID to `MONDAY_BOARD_ID`

3. **Set up Webhook**:
   - Go to Monday.com → Developers → Webhooks
   - Click "Add webhook"
   - Configure:
     - **URL**: `https://your-domain.com/api/webhooks/monday`
     - **Event**: `Item Created`
     - **Board**: Select your inquiry board
   - Copy the webhook secret to `MONDAY_WEBHOOK_SECRET`

4. **Verify Email Column**:
   - Ensure your Monday.com board has an email column
   - Note the column ID (e.g., `email_mknrc1cr`)
   - Update `EMAIL_COLUMN_ID` in your `.env` if different

### Step 2: Configure Mailchimp

1. **Get API Key**:
   - Go to Mailchimp → Account → Extras → API Keys
   - Generate a new API key
   - Copy the key to `MAILCHIMP_API_KEY`

2. **Get Server Prefix**:
   - Found in your Mailchimp API key URL
   - Format: `https://SERVER_PREFIX.api.mailchimp.com`
   - Copy to `MAILCHIMP_SERVER_PREFIX`

3. **Get Audience ID**:
   - Go to Mailchimp → Audience → Settings → Audience name and defaults
   - Copy the Audience ID to `MAILCHIMP_AUDIENCE_ID`

4. **Create Enrollment Tag**:
   - Go to Mailchimp → Audience → Tags
   - Create a new tag: `Inquiry Enrolled`
   - This will be used for segmentation

5. **Optional: Create Welcome Campaign**:
   - Create a welcome campaign in Mailchimp
   - Set up a segment with the `Inquiry Enrolled` tag
   - Copy the campaign ID to `WELCOME_CAMPAIGN_ID`

### Step 3: Configure Discord Notifications

1. **Create Discord Webhook**:
   - Go to your Discord server → Server Settings → Integrations → Webhooks
   - Create a new webhook
   - Copy the webhook URL to `DISCORD_WEBHOOK_URL`

### Step 4: Deploy and Test

1. **Deploy your application**:
   ```bash
   npm run deploy
   ```

2. **Test the integration**:
   ```bash
   # Test email validation
   npm run test:enrollment email
   
   # Test merge field extraction
   npm run test:enrollment merge
   
   # Test full enrollment flow
   npm run test:enrollment full
   ```

3. **Create a test inquiry**:
   - Add a new item to your Monday.com board
   - Include a valid email address
   - Check Discord for enrollment notification
   - Verify the customer appears in Mailchimp

## 🔍 Troubleshooting

### Common Issues

1. **"Invalid signature" error**:
   - Verify `MONDAY_WEBHOOK_SECRET` matches your webhook configuration
   - Ensure webhook URL is accessible via HTTPS

2. **"Email not found" error**:
   - Check that your Monday.com board has an email column
   - Verify the column ID in `EMAIL_COLUMN_ID`
   - Test email extraction with the test script

3. **"Mailchimp API error"**:
   - Verify API key and server prefix
   - Check that audience ID is correct
   - Ensure API key has proper permissions

4. **"Rate limited" error**:
   - The system automatically handles rate limiting
   - Check logs for retry attempts
   - Consider reducing webhook frequency if needed

### Debug Commands

```bash
# Check Monday.com connection
curl https://your-domain.com/api/status/monday

# Check Mailchimp connection
curl https://your-domain.com/api/status/mailchimp

# Test webhook endpoint
curl -X POST https://your-domain.com/api/webhooks/monday \
  -H "Content-Type: application/json" \
  -H "x-monday-signature: test" \
  -d '{"type":"test"}'
```

## 📊 Monitoring

### Discord Notifications

You'll receive notifications for:
- ✅ Successful enrollments
- ⚠️ Skipped enrollments (no email found)
- ❌ Failed enrollments (API errors)

### Sentry Error Tracking

Errors are automatically tracked in Sentry with:
- Email addresses (for debugging)
- Monday.com item IDs
- Processing times
- Error contexts

### Logs

Check your application logs for:
- Webhook processing details
- Email validation results
- Mailchimp API responses
- Processing times

## 🔒 Security Considerations

1. **Webhook Security**:
   - All webhooks require signature verification
   - Invalid signatures are rejected immediately
   - Webhook secrets should be kept secure

2. **Email Validation**:
   - Invalid email patterns are rejected
   - Test emails are filtered out
   - Email addresses are normalized

3. **API Security**:
   - API keys are stored in environment variables
   - Rate limiting is handled automatically
   - Error messages don't expose sensitive data

## 📈 Performance

### Rate Limits

- **Monday.com**: 1000 requests per minute
- **Mailchimp**: 10 requests per second
- **Discord**: 5 requests per second

The system includes:
- Automatic retry logic
- Exponential backoff
- Rate limit handling
- Background processing

### Processing Times

Typical processing times:
- Email validation: < 10ms
- Monday.com API calls: 100-500ms
- Mailchimp API calls: 200-1000ms
- Total enrollment: 1-3 seconds

## 🎯 Best Practices

1. **Email Quality**:
   - Use proper email validation in your forms
   - Avoid test emails in production
   - Monitor bounce rates in Mailchimp

2. **Data Mapping**:
   - Map Monday.com columns to Mailchimp merge fields
   - Use consistent naming conventions
   - Validate data before sending to Mailchimp

3. **Monitoring**:
   - Set up alerts for failed enrollments
   - Monitor webhook delivery rates
   - Track enrollment success rates

4. **Testing**:
   - Test with real email addresses
   - Verify merge field mapping
   - Check notification delivery

## 🚨 Emergency Procedures

### Disable Enrollment

To temporarily disable enrollment:
1. Remove the webhook from Monday.com
2. Or comment out the webhook processing code

### Rollback

To rollback changes:
1. Restore previous webhook configuration
2. Remove new environment variables
3. Revert code changes

### Data Recovery

If data is lost:
1. Check Monday.com item notes for enrollment records
2. Review Discord notification history
3. Check Mailchimp audience for enrolled subscribers

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs
3. Check Sentry for error details
4. Contact your development team

---

**Note**: This system is designed to be robust and handle edge cases, but always test thoroughly in a staging environment before deploying to production.
