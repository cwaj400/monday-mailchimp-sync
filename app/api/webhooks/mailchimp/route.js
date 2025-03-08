import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendDiscordNotification } from '@/utils/discordNotifier';
import { 
  findMondayItemByEmail, 
  incrementTouchpoints,
  addNoteToMondayItem
} from '@/utils/mondayService';

// Verify Mailchimp webhook signature
function verifyMailchimpSignature(req, body) {
  const MAILCHIMP_WEBHOOK_SECRET = process.env.MAILCHIMP_WEBHOOK_SECRET;
  
  if (!MAILCHIMP_WEBHOOK_SECRET) {
    console.warn('MAILCHIMP_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }
  
  const signature = req.headers.get('x-mailchimp-signature');
  if (!signature) {
    console.error('No Mailchimp signature provided');
    return false;
  }
  
  // Create a signature using the request body and the secret
  const calculatedSignature = crypto
    .createHmac('sha1', MAILCHIMP_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
  
  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Verify the webhook signature
    if (!verifyMailchimpSignature(req, body)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Process the webhook based on event type
    const eventType = body.type;
    
    // Handle different event types (similar to your existing code)
    // You would import and call your handler functions here
    
    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    await sendDiscordNotification(
      '❌ Mailchimp Webhook Error',
      `An error occurred while processing a Mailchimp webhook event.`,
      {
        'Error': error.message,
        'Stack Trace': error.stack?.substring(0, 300) + '...'
      },
      'ED4245'
    );
    
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error.message },
      { status: 500 }
    );
  }
} 