const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailSend = async function(req, res) {
    console.log('handleEmailSend');
    const email = req.body.data.email;
    const campaignTitle = req.body.data.campaign_title || 'Unknown Campaign';
    

    console.log({body: req.body.data});
  
    // Common validation
    if (!email) {
      console.error('Email not provided in webhook data');
      return res.status(400).json({ error: 'Email not provided in webhook data' });
    }
    
    // Find Monday item and process
    const result = await processEmailEvent(email, 'send', {
      campaignTitle,
      noteText: `📧 Email Sent: "${campaignTitle}" was sent to ${email}`
    });
    
    return res.json(result);
  }