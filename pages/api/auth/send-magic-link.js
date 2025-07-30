//api/auth/send-magic-link.js
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function genSessionId() {
  return crypto.randomUUID()
}

function getBaseUrl() {
 if (process.env.VERCEL_URL) {
   return `https://${process.env.VERCEL_URL}`;
 }
 return process.env.APP_URL || 'http://localhost:3000';
}


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, rememberMe = false } = req.body;

  if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    let userId;
    if (user) {
      userId = user.user_id;
    } else {
      const newUserId = genSessionId();
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          user_id: newUserId,
          email: email.toLowerCase()
        }])
        .select('user_id')
        .single();

      if (createError) throw createError;
      userId = newUser.user_id;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('magic_tokens')
      .insert([{
        email: email.toLowerCase(),
        token,
        user_id: userId,
        expires_at: expires.toISOString(),
        remember_me: rememberMe,
        used: false
      }]);

    if (insertError) throw insertError;

    const magicLink = `${getBaseUrl()}/verify?token=${token}`;
    await resend.emails.send({
      from: 'login@thecv.pro',
      to: email,
      subject: 'Your Secure Login Link',
      html: `<p>Click <a href="${magicLink}">here</a> to log in.</p>`
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
