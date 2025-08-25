# 🚀 Production Setup Guide

This guide will help you deploy your Monday.com to Mailchimp enrollment system to production.

## 📋 Prerequisites

1. **Monday.com API Token**: Valid API token with webhook permissions
2. **Mailchimp API Key**: Valid API key with audience access
3. **Discord Webhook URL**: For real-time notifications
4. **Sentry DSN**: For error monitoring (optional but recommended)
5. **Production Hosting**: Vercel, Railway, Heroku, etc.

## 🔧 Environment Variables

Set these on your production platform:

```bash
# Monday.com Configuration
MONDAY_API_TOKEN=your_monday_api_token_here
MONDAY_BOARD_ID=6432503726
MONDAY_WEBHOOK_SECRET=your_webhook_secret_here

# Mailchimp Configuration
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_AUDIENCE_ID=your_audience_id
ENROLLMENT_TAG=Inquiry Enrolled

# Discord Configuration
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Error Monitoring
SENTRY_DSN=your_sentry_dsn

# Production URL (set after deployment)
PRODUCTION_URL=https://your-production-domain.com
```

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts and get your URL
# Example: https://your-app.vercel.app
```

### Option 2: Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up

# Get URL from Railway dashboard
```

### Option 3: Heroku

```bash
# Install Heroku CLI
# Create app and deploy via Git
heroku create your-app-name
git push heroku main
```

## 🔗 Setting Up the Webhook

Once deployed:

1. **Get your production URL** (e.g., `https://your-app.vercel.app`)

2. **Set the production URL**:
   ```bash
   export PRODUCTION_URL="https://your-production-domain.com"
   ```

3. **Create the webhook**:
   ```bash
   npm run setup-production-webhook
   ```

## 🧪 Testing

1. **Create a test item** in your Monday.com Leads board
2. **Add a valid email address** (e.g., `angelljamesw@gmail.com`)
3. **Watch for**:
   - New subscriber in Mailchimp
   - Discord notification
   - Enrollment tag applied

## 📊 Monitoring

### Check Webhook Status
```bash
npm run list-webhooks
```

### Test Enrollment System
```bash
npm run test:your-board
```

### Check Mailchimp Subscriber
```bash
npm run check-mailchimp angelljamesw@gmail.com
```

## 🔍 Troubleshooting

### Webhook Not Working
1. Check webhook status: `npm run list-webhooks`
2. Verify production URL is accessible
3. Check server logs for errors
4. Ensure environment variables are set

### Enrollment Failing
1. Run test: `npm run test:your-board`
2. Check Mailchimp API key and audience ID
3. Verify email validation rules
4. Check Discord webhook URL

### Server Issues
1. Check production logs
2. Verify all environment variables
3. Test API connections
4. Check Sentry for errors

## 🎯 Production Checklist

- ✅ Server deployed and accessible
- ✅ Environment variables configured
- ✅ Monday.com webhook created
- ✅ Mailchimp integration working
- ✅ Discord notifications active
- ✅ Error monitoring enabled
- ✅ Test enrollment successful

## 🆘 Support

If you encounter issues:
1. Check server logs
2. Run diagnostic scripts
3. Verify all configurations
4. Test with known good data

Your enrollment system is designed to be robust and handle errors gracefully!
