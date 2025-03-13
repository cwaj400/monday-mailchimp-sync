const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailClick = async function(event, res) {
    console.log('handleEmailClick');
    const email = event.msg.email;
    const campaignTitle = event.msg.subject || 'Unknown Campaign';
    const url = event.msg.url || 'a link';
    
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
  