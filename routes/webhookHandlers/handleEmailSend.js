const { processEmailEvent } = require('./processEmailEvent');
const dotenv = require('dotenv');

dotenv.config();

exports.handleEmailSend = async function(event, res) {
    console.log('handleEmailSend');
    const subject = event.msg.subject || 'Unknown Campaign';
    
  
    // Common validation
    if (!event.msg.email) {
      console.error('Email not provided in webhook data');
      return res.status(400).json({ error: 'Email not provided in webhook data' });
    }
    
    // Find Monday item and process
    const result = await processEmailEvent(event.msg.email, 'send', {
      campaignTitle: subject,
      noteText: `📧 Email Sent: "${subject}" was sent to ${event.msg.email}`
    });
    
    return res.json(result);
  }