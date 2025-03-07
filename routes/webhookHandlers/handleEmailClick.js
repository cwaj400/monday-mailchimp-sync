const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailClick = async function(req, res) {
    console.log('handleEmailClick');
    console.log({body: req.body.data});
    const email = req.body.data.email;
    const campaignTitle = req.body.data.campaign_title || 'Unknown Campaign';
    const url = req.body.data.url || 'a link';
    
    if (!email) {
      console.error('Email not provided in webhook data');
      return res.status(400).json({ error: 'Email not provided in webhook data' });
    }
    
    const result = await processEmailEvent(email, 'click', {
      campaignTitle,
      url,
      noteText: `🖱️ Email Link Clicked: ${email} clicked on ${url} in "${campaignTitle}"`
    });
    
    return res.json(result);
  }
  