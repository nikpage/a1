// pages/api/auth/send-magic-link.js
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getBaseUrl = () => {
  if (process.env.VERCEL_ENV === 'production') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://thecv.pro';
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, user_id, rememberMe = false } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 900000); // 15 minutes
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/verify?token=${token}`;

    const { data: insertedToken, error: insertError } = await supabase
      .from('magic_tokens')
      .insert([
        {
          email: email.toLowerCase(),
          token,
          user_id,
          expires_at: expires.toISOString(),
          remember_me: rememberMe,
          used: false
        }
      ])
      .select()
      .single();

    console.log('✅ Inserted token:', insertedToken);

    if (insertError) {
      console.error('Token storage error:', insertError);
      return res.status(500).json({ error: 'Failed to generate login link' });
    }

    const { error: emailError } = await resend.emails.send({
      from: 'login@thecv.pro',
      to: email,
      subject: 'Your TheCV.Pro Login Link',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to TheCV.Pro</h2>
          <p>Click the link below to access your CV analysis:</p>
          <a href="${magicLink}" style="display: inline-block; background: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Login to TheCV.Pro
          </a>
          <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this login, you can safely ignore this email.</p>
        </div>
      `
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.status(200).json({
      success: true,
      message: `Login link sent to ${email}`
    });

  } catch (error) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
