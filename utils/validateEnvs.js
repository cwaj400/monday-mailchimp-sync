const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Determine which .env file to load based on NODE_ENV
function loadEnvFile() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = `.env.${nodeEnv}`;
  const defaultEnvFile = '.env';
  
  console.log(`Attempting to load environment from ${envFile}`);
  
}

function validateEnv() {
  // Load environment variables first
  loadEnvFile();
  
  // Define required variables by category
  const systemVars = [
    'NODE_ENV',
    'APP_API_KEY'
  ];
  
  const mondayVars = [
    'MONDAY_API_KEY', 
    'MONDAY_BOARD_ID',
    'MONDAY_SIGNING_SECRET',
    'MONDAY_CLIENT_ID',
  ];
  
  const mailchimpVars = [
    'MAILCHIMP_API_KEY', 
    'MAILCHIMP_SERVER_PREFIX',
    'MAILCHIMP_AUDIENCE_ID',
    'MAILCHIMP_WEBHOOK_SECRET',
  ];
  
  const discordVars = [
    'DISCORD_WEBHOOK_URL'
  ];
  
  // Optional variables that are nice to have but not required
  const optionalVars = [
    'MAILCHIMP_AUDIENCE_NAME',
  ];
  
  // Check for missing required variables
  const missingSystem = systemVars.filter(v => !process.env[v]);
  const missingMonday = mondayVars.filter(v => !process.env[v]);
  const missingMailchimp = mailchimpVars.filter(v => !process.env[v]);
  const missingDiscord = discordVars.filter(v => !process.env[v]);
  
  // Exit if any required variables are missing
  if (missingSystem.length > 0 || missingMonday.length > 0 || 
      missingMailchimp.length > 0 || missingDiscord.length > 0) {
    
    if (missingSystem.length > 0) {
      console.error(`Missing required system variables: ${missingSystem.join(', ')}`);
    }
    if (missingMonday.length > 0) {
      console.error(`Missing required Monday variables: ${missingMonday.join(', ')}`);
    }
    if (missingMailchimp.length > 0) {
      console.error(`Missing required Mailchimp variables: ${missingMailchimp.join(', ')}`);
    }
    if (missingDiscord.length > 0) {
      console.error(`Missing required Discord variables: ${missingDiscord.join(', ')}`);
    }
    
    // Only exit in production; in development/test, just warn
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting due to missing required environment variables in production');
      process.exit(1);
    } else {
      console.warn('Continuing despite missing environment variables (non-production environment)');
    }
  } else {
    console.log('✅ All required environment variables are set');
  }
}

module.exports = {
  validateEnv,
  loadEnvFile
};