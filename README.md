# Monday-Mailchimp Integration

A robust integration service that synchronizes contacts between Monday.com and Mailchimp, with Discord notifications for important events.

## 🌟 Features

- **Bidirectional Sync**: Keep Monday.com and Mailchimp contacts in sync
- **Webhook Support**: Process Mailchimp events (subscribe, unsubscribe, profile updates)
- **Discord Notifications**: Real-time alerts for important events and errors
- **Environment Management**: Support for development, testing, and production environments
- **Security**: Snyk integration for vulnerability scanning

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Monday.com account with API access
- Mailchimp account with API access
- Discord webhook URL (for notifications)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/monday-mailchimp-sync.git
   cd monday-mailchimp-sync
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your API keys and configuration.

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create environment-specific files for different environments:
- `.env.development` - Development environment
- `.env.test` - Testing environment
- `.env.production` - Production environment

Required variables:
```
# System
NODE_ENV=development

# Monday.com
MONDAY_API_KEY=your_monday_api_key
MONDAY_BOARD_ID=your_monday_board_id
MONDAY_SIGNING_SECRET=your_monday_signing_secret
MONDAY_CLIENT_ID=your_monday_client_id

# Mailchimp
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=your_audience_id
MAILCHIMP_WEBHOOK_SECRET=your_webhook_secret

# Discord
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

Optional variables:
```
```

## 📊 API Endpoints

### Webhooks
- `POST /api/webhooks/mailchimp` - Receive Mailchimp webhook events

### Monday.com
- `GET /api/monday` - Check Monday.com connection status
- `GET /api/monday/getLeads` - Get leads from Monday.com
- `POST /api/monday/updateTouchpoints` - Update touchpoints for contacts
- `POST /api/monday/webhook` - Handle Monday.com webhook events
- `GET /api/monday/board/:boardId` - Get board information
- `GET /api/monday/board/:boardId/items` - Get items from a board
- `POST /api/monday/item/:itemId/increment-touchpoints` - Increment touchpoints for an item

### Mailchimp
- `GET /api/mailchimp` - Check Mailchimp connection status and account information
- `GET /api/mailchimp/list` - Get Mailchimp audience information
- `GET /api/mailchimp/list/members` - Get audience members (paginated)
- `POST /api/mailchimp/list/members` - Add a single member to the audience
- `GET /api/mailchimp/list/campaigns` - Get campaigns for the audience
- `GET /api/mailchimp/list/growth-history` - Get audience growth history

### Sync
- `POST /api/sync/run` - Manually trigger synchronization
- `GET /api/sync/status` - Check sync status

### System
- `GET /api/status` - Check service status
- `GET /health` - Simple health check

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run specific test suites:
```bash
npm run test:monday    # Monday.com tests
npm run test:mailchimp # Mailchimp tests
npm run test:discord   # Discord notification tests
```

Generate test coverage report:
```bash
npm run test:coverage
```

## 🔒 Security

This project uses Snyk for security scanning. Snyk runs automatically before each commit via Husky.

To run a security scan manually:
```bash
npx snyk test
```

To bypass Snyk check during commits (use sparingly):
```bash
SKIP_SNYK=true git commit -m "Your commit message"
```

## 🚢 Deployment

### Vercel

This project is configured for deployment on Vercel. The `vercel.json` file contains the necessary configuration.

To deploy to Vercel:
1. Install Vercel CLI: `npm install -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel`

Make sure to set all environment variables in the Vercel dashboard.

## 📁 Project Structure

### Root Directory
- `.husky/` - Git hooks for pre-commit checks and automation
- `.env` - Environment variables for local development
- `.env.development` - Development-specific environment variables
- `.env.test` - Test-specific environment variables
- `.env.production` - Production-specific environment variables
- `vercel.json` - Vercel deployment configuration
- `.snyk` - Snyk security policy configuration
- `package.json` - Project dependencies and scripts
- `server.js` - Main application entry point

### Routes Directory (`/routes`)
Contains all API route handlers organized by service:

- `webhookRoutes.js` - Routes for handling incoming webhooks from Mailchimp
- `mondayRoutes.js` - Routes for Monday.com API interactions
- `mailchimpRoutes.js` - Routes for Mailchimp API interactions
- `syncRoutes.js` - Routes for triggering and managing synchronization
- `settingsRoutes.js` - Routes for application settings management

#### Webhook Handlers (`/routes/webhookHandlers`)
- `handleSubscriberEvent.js` - Processes Mailchimp subscriber events (subscribe, unsubscribe)
- `handleCampaignEvent.js` - Processes Mailchimp campaign events (send, open, click)
- `handleEmailOpen.js` - Processes Mailchimp email open events
- `handleEmailClick.js` - Processes Mailchimp email click events
- `handleEmailSend.js` - Processes Mailchimp email send events
- `handleWebhookError.js` - Error handling for webhook events

### Utils Directory (`/utils`)
Utility functions and service clients:

- `mondayService.js` - Functions for interacting with Monday.com API
- `mondayClient.js` - Axios client configured for Monday.com API
- `mailchimpClient.js` - Client for Mailchimp API
- `discordNotifier.js` - Functions for sending notifications to Discord
- `validateEnvs.js` - Environment variable validation and loading
- `syncService.js` - Core synchronization logic

### Services Directory (`/services`)
Business logic and core functionality:

- `cronService.js` - Scheduled tasks for periodic synchronization

### Tests Directory (`/tests`)
Test files organized by service:

- `monday-*.test.js` - Tests for Monday.com functionality
- `mailchimp-*.test.js` - Tests for Mailchimp functionality
- `discord-*.test.js` - Tests for Discord notification functionality

### Scripts Directory (`/scripts`)
Utility scripts for development and testing:

- `test-monday.js` - Script to test Monday.com API connection
- `test-mailchimp.js` - Script to test Mailchimp API connection
- `test-discord.js` - Script to test Discord webhook notifications
- `test-webhook.js` - Script to simulate Mailchimp webhook events
- `test-touchpoints.js` - Script to test touchpoint incrementation
- `test-add-monday-note.js` - Script to test adding notes to Monday items
- `test-sync.js` - Script to test synchronization process

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
- [Snyk Security](https://snyk.io/)

## 🌐 Web Interface

The application provides a simple web interface:

- **Home Page**: View service status and available endpoints
- **Status API**: Check service health at `/api/status`
- **Health Check**: Simple health check at `/health` 