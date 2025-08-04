// pages/api/auth/ send-magic-link.js

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import rateLimiter from '../../../lib/rateLimiter';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getBaseUrl = () => {
  if (process.env.VERCEL) { return 'https://thecv.pro'; }
  return 'http://localhost:3000';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { email, user_id } = req.body;

  if (!email || !email.includes('@')) { return res.status(400).json({ error: 'Valid email required' }); }
  if (!user_id) { return res.status(400).json({ error: 'User ID required' }); }

  try {
    const isAllowed = await rateLimiter(req, 3, 60);
    if (!isAllowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 900000);
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/verify?token=${token}`;

    const { error: insertError } = await supabase.from('magic_tokens').insert([{
      email: email.toLowerCase(),
      token,
      user_id,
      expires_at: expires.toISOString(),
      remember_me: req.body.rememberMe || false,
      used: false
    }]);

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      throw new Error('Failed to store magic token.');
    }

    const { error: emailError } = await resend.emails.send({
      from: 'login@thecv.pro',
      to: email,
      subject: 'Your TheCV.Pro Login Link',
      html: `<p>Click this link to log in: <a href="${magicLink}">Login</a>. It expires in 15 minutes.</p>`
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      // NOTE: A more advanced implementation would delete the previously inserted token here.
      throw new Error('Failed to send magic link email.');
    }

    return res.status(200).json({ success: true, message: `Login link sent to ${email}` });

  } catch (error) {
    console.error('Magic link process failed:', error.message);
    return res.status(500).json({ error: 'Could not send login link.' });
  }
}
