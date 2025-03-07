const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

const {
  MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET,
  MONDAY_AUTH_REDIRECT_URI
} = process.env;

// In-memory token storage (for development)
// In production, use a database or secure storage solution
let tokenStore = {
  accessToken: null,
  expiresAt: null
};

// Redirect users to Monday OAuth login
router.get('/oauth', (req, res) => {
  const mondayAuthURL = `https://auth.monday.com/oauth2/authorize?client_id=${MONDAY_CLIENT_ID}&redirect_uri=${MONDAY_AUTH_REDIRECT_URI}`;
  res.redirect(mondayAuthURL);
});

// Handle OAuth callback & retrieve access token
router.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code missing' });
  }

  try {
    const tokenResponse = await axios.post('https://auth.monday.com/oauth2/token', {
      client_id: MONDAY_CLIENT_ID,
      client_secret: MONDAY_CLIENT_SECRET,
      code,
      redirect_uri: MONDAY_AUTH_REDIRECT_URI
    });

    const accessToken = tokenResponse.data.access_token;
        // Store the token
    tokenStore.accessToken = accessToken;
    // Set expiration if provided, otherwise default to 24 hours
    const expiresIn = tokenResponse.data.expires_in || 86400;
    tokenStore.expiresAt = Date.now() + expiresIn * 1000;
    
    // Redirect to a success page or your app's main page
    res.redirect('/auth-success');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Failed to retrieve access token' });
  }
});

// Add a route to check if we have a valid token
router.get('/token-status', (req, res) => {
  if (tokenStore.accessToken && tokenStore.expiresAt > Date.now()) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// Add a new route for auth-success
router.get('/auth-success', (req, res) => {

    // Check if we have a valid token
    if (tokenStore.accessToken && tokenStore.expiresAt > Date.now()) {
      res.render('auth-success', {
        authenticated: true,
        message: 'Successfully authenticated with Monday.com!'
      });
    } else {
      res.render('auth-success', { 
        authenticated: false,
        message: 'Authentication failed or token expired. Please try again.'
      });
    }
  });

// Add a function to get the token for other routes to use
const getAccessToken = () => {
  if (tokenStore.accessToken && tokenStore.expiresAt > Date.now()) {
    return tokenStore.accessToken;
  }
  return null;
};

// Export the router and the token getter
module.exports = { 
  router,
  getAccessToken
};
