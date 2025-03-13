const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailOpen = async function(event, res) {
    console.log('handleEmailOpen');
    const email = event.msg.email;
    const campaignTitle = event.msg.subject || 'Unknown Campaign';
    
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