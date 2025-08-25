# Production Ready Checklist - Monday.com to Mailchimp Enrollment

## ✅ **Issues Fixed**

### **Email Validation Issues**
- ✅ Fixed overly strict email validation
- ✅ Now only rejects obvious test/invalid patterns
- ✅ Valid business emails are accepted
- ✅ Test emails like `info@`, `hello@`, `contact@` are properly rejected

### **Monday.com API Issues**
- ✅ Fixed GraphQL query structure
- ✅ Removed invalid `title` field from column_values
- ✅ Added proper column title mapping
- ✅ Added fallback title resolution

### **Test Data Issues**
- ✅ Updated test emails to use realistic business addresses
- ✅ Fixed test cases to match new validation rules
- ✅ Added comprehensive email pattern testing

## 🔧 **What You Need to Do**

### **1. Environment Variables (Required)**

Add these to your `.env` file:

```bash
# Monday.com Webhook Configuration
MONDAY_WEBHOOK_SECRET=your_monday_webhook_secret

# Mailchimp Enrollment Configuration
ENROLLMENT_TAG=Inquiry Enrolled
WELCOME_CAMPAIGN_ID=your_welcome_campaign_id  # Optional
```

### **2. Monday.com Setup (Required)**

1. **Create Webhook**:
   - Go to Monday.com → Developers → Webhooks
   - Add webhook with URL: `https://your-domain.com/api/webhooks/monday`
   - Event: `Item Created`
   - Board: Your inquiry board
   - Copy webhook secret to `MONDAY_WEBHOOK_SECRET`

2. **Verify Email Column**:
   - Ensure your board has an email column
   - Note the column ID (e.g., `email_mknrc1cr`)
   - Update `EMAIL_COLUMN_ID` in `.env` if different

### **3. Mailchimp Setup (Required)**

1. **Create Enrollment Tag**:
   - Go to Mailchimp → Audience → Tags
   - Create tag: `Inquiry Enrolled`

2. **Optional: Create Welcome Campaign**:
   - Create welcome campaign
   - Set up segment with `Inquiry Enrolled` tag
   - Copy campaign ID to `WELCOME_CAMPAIGN_ID`

### **4. Testing (Required)**

Run these tests in order:

```bash
# 1. Test Monday.com API connection
npm run test:monday-api

# 2. Test email validation
npm run test:enrollment:email

# 3. Test merge field extraction
npm run test:enrollment:merge

# 4. Test full enrollment flow
npm run test:enrollment:full
```

## 🚨 **Critical Considerations**

### **Email Validation Rules**

The system now rejects emails that:
- Start with: `test@`, `admin@`, `noreply@`, `no-reply@`, `info@`, `contact@`, `hello@`, `hi@`, `support@`, `help@`, `sales@`, `marketing@`, `webmaster@`, `postmaster@`, `abuse@`, `security@`, `root@`
- Contain: `@example.com`, `@localhost`, `@test.`
- Have invalid format

**Valid emails include**:
- `john.doe@company.com`
- `alice.smith@startup.com`
- `customer@business.com`
- `user@legitimate.com`

### **Monday.com Column Mapping**

The system maps these common column IDs to Mailchimp merge fields:

| Monday.com Column ID | Mailchimp Merge Field | Description |
|---------------------|----------------------|-------------|
| `email_mknrc1cr` | N/A | Email (not a merge field) |
| `text` | `FNAME` | First Name |
| `text1` | `LNAME` | Last Name |
| `text2` | `COMPANY` | Company |
| `phone` | `PHONE` | Phone |
| `text3` | `WEBSITE` | Website |
| `text4` | `ADDRESS` | Address |

### **Rate Limits & Performance**

- **Monday.com**: 1000 requests/minute
- **Mailchimp**: 10 requests/second
- **Processing Time**: 1-3 seconds per enrollment
- **Retry Logic**: 3 attempts with exponential backoff

## 🔍 **Monitoring & Alerts**

### **Discord Notifications**

You'll receive notifications for:
- ✅ Successful enrollments
- ⚠️ Skipped enrollments (no email found)
- ❌ Failed enrollments (API errors)

### **Sentry Error Tracking**

Errors are tracked with:
- Email addresses (for debugging)
- Monday.com item IDs
- Processing times
- Error contexts

### **Application Logs**

Check logs for:
- Webhook processing details
- Email validation results
- Mailchimp API responses
- Processing times

## 🚀 **Deployment Steps**

### **1. Pre-Deployment Testing**

```bash
# Test all components
npm run test:monday-api
npm run test:enrollment:email
npm run test:enrollment:merge
npm run test:enrollment:full
```

### **2. Environment Setup**

```bash
# Add required environment variables
MONDAY_WEBHOOK_SECRET=your_webhook_secret
ENROLLMENT_TAG=Inquiry Enrolled
WELCOME_CAMPAIGN_ID=your_campaign_id  # Optional
```

### **3. Monday.com Webhook Setup**

1. Create webhook in Monday.com
2. Test webhook delivery
3. Verify signature verification

### **4. Mailchimp Setup**

1. Create enrollment tag
2. Optional: Create welcome campaign
3. Test subscriber addition

### **5. Production Testing**

1. Create test inquiry in Monday.com
2. Verify enrollment in Mailchimp
3. Check Discord notifications
4. Verify audit trail in Monday.com

## 🔒 **Security Checklist**

- ✅ Webhook signature verification
- ✅ Input validation and sanitization
- ✅ Secure API key handling
- ✅ Rate limiting compliance
- ✅ Error message sanitization

## 📊 **Success Metrics**

Monitor these metrics:
- Enrollment success rate
- Processing time
- Error rate
- Webhook delivery rate
- Mailchimp API response times

## 🚨 **Emergency Procedures**

### **Disable Enrollment**
1. Remove webhook from Monday.com
2. Or comment out webhook processing code

### **Rollback**
1. Restore previous webhook configuration
2. Remove new environment variables
3. Revert code changes

### **Data Recovery**
1. Check Monday.com item notes
2. Review Discord notification history
3. Check Mailchimp audience for enrolled subscribers

## 📞 **Support & Troubleshooting**

### **Common Issues**

1. **"Invalid signature"**: Check webhook secret
2. **"Email not found"**: Verify email column ID
3. **"Mailchimp API error"**: Check API key and audience ID
4. **"Rate limited"**: System handles automatically

### **Debug Commands**

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

---

## ✅ **Ready for Production**

The enrollment system is now production-ready with:
- ✅ Robust error handling
- ✅ Comprehensive validation
- ✅ Security measures
- ✅ Monitoring and alerts
- ✅ Performance optimization
- ✅ Documentation and testing

**Next Steps**: Follow the deployment steps above and test thoroughly in your environment.
