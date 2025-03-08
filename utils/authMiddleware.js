const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Middleware to authenticate requests using API key
 * 
 * This middleware checks for the presence of a valid API key
 * in the request headers. The API key should be provided in
 * the 'x-api-key' header and must match the API_KEY environment
 * variable.
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  // Check if API key is provided and matches the expected value
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing API key' 
    });
  }
  
  next();
}

module.exports = { apiKeyAuth }; 