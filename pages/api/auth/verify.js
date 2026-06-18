// pages/api/auth/verify.js
import { createClient } from '@supabase/supabase-js';
import { mintSessionToken } from '../../../lib/auth';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'missing-token' });
  }

  try {
    const { data: tokenData, error } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !tokenData) {
      res.redirect(302, '/?error=login-failed');
      return;
    }

    await supabase.from('magic_tokens').delete().eq('token', token);

    const sessionToken = mintSessionToken({ user_id: tokenData.user_id, email: tokenData.email });
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `auth-token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; ${
        isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'
      }`
    ]);

    res.redirect(302, `/${tokenData.user_id}`);
  } catch (err) {
    console.error('Verify error:', err);
    res.redirect(302, '/?error=login-failed');
  }
}
