const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailOpen = async function(req, res) {
    console.log('handleEmailOpen');
    console.log({body: req.body.data});
    const email = req.body.data.email;
    const campaignTitle = req.body.data.campaign_title || 'Unknown Campaign';
    
    if (!email) {
      console.error('Email not provided in webhook data');
      return res.status(400).json({ error: 'Email not provided in webhook data' });
    }
    
    const result = await processEmailEvent(email, 'open', {
      campaignTitle,
      noteText: `👁️ Email Opened: ${email} opened "${campaignTitle}"`
    });
    
    return res.json(result);
  }