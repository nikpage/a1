// pages/api/auth/send-magic-link.js
import rateLimiter from '../../../lib/rateLimiter';
import originCheck from '../../../lib/originCheck';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getBaseUrl() {
  return process.env.APP_URL || 'http://localhost:3000';
}

export default async function handler(req, res) {
  // Security middleware from your new version
  if (!originCheck(req, res)) return;
  if (!rateLimiter(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simplified logic from your working version
  const { email, user_id, rememberMe = false } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // The single, direct database write from your working version
    const { error: insertError } = await supabase
      .from('magic_tokens')
      .insert([{
        email: email.toLowerCase(),
        token,
        user_id: user_id, // Use user_id directly
        expires_at: expires.toISOString(),
        remember_me: rememberMe,
        used: false
      }]);

    if (insertError) {
      // This will now report the true database error if it fails
      console.error('Magic token insert error:', insertError);
      throw insertError;
    }

    const magicLink = `${getBaseUrl()}/verify?token=${token}`;
    await resend.emails.send({
      from: 'login@thecv.pro',
      to: email,
      subject: 'Your Secure Login Link',
      html: `<p>Click <a href="${magicLink}">here</a> to log in.</p>`
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error in send-magic-link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
