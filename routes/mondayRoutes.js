const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/mondayClient');
const { findMondayItemByEmail, getXMondayContacts, getAllMondayContacts } = require('../utils/mondayService');

router.get('/', (req, res) => {
  res.json({
    message: 'OK'
  });
});

router.get('/find-by-email', async (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }
  
  try {
    const item = await findMondayItemByEmail(email);
    
    if (item) {
      return res.json({
        success: true,
        item: {
          id: item.id,
          name: item.name
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `No item found with email: ${email}`
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/all-x-contacts', async (req, res) => {
  const x = req.query.quantity;
  const contacts = await getAllMondayContacts(x);
  res.json(contacts);
});

module.exports = router;
