const express = require('express');

// Simple API key middleware
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  // Check if API key is provided and matches the expected value
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing API key' 
    });
  }
  
  next();
}

module.exports = { apiKeyAuth }; 