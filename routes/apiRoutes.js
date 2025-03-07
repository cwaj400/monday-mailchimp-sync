const express = require('express');
const axios = require('axios');
const { getAccessToken } = require('./authRoutes');

const router = express.Router();

router.get('/monday-data', async (req, res) => {
  const token = getAccessToken();
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated with Monday.com' });
  }
  
  try {
    const response = await axios.get('https://api.monday.com/v2/...', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to fetch data from Monday.com' });
  }
});

module.exports = router; 