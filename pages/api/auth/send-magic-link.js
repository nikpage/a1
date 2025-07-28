import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, rememberMe = false } = req.body; // REMOVED user_id from request

  if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  try {
    // 1. Find or create user by email only
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    let userId;
    if (user) {
      userId = user.id;
    } else {
      // Auto-create new user if email doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ email: email.toLowerCase() }])
        .select('id')
        .single();

      if (createError) throw createError;
      userId = newUser.id;
    }

    // 2. Generate and store token (tied to user_id from DB, not client-provided)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const { error: insertError } = await supabase
      .from('magic_tokens')
      .insert([{
        email: email.toLowerCase(),
        token,
        user_id: userId, // From DB, not client
        expires_at: expires.toISOString(),
        remember_me: rememberMe,
        used: false
      }]);

    if (insertError) throw insertError;

    // 3. Send email ONLY to the verified email
    const magicLink = `${process.env.APP_URL}/verify?token=${token}`;
    await resend.emails.send({
      from: 'login@thecv.pro',
      to: email,
      subject: 'Your Secure Login Link',
      html: `...` // Your existing email template
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
