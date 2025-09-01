// pages/api/auth/verify.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import redis from '../../../lib/redis';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  console.log('✅ Verify API hit:', token);

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
      console.log('❌ Invalid token or error:', error);
      console.log('❌ REDIRECTING TO LOGIN-FAILED FROM TOKEN CHECK');
      res.redirect(302, '/?error=login-failed');
      return;
    }

    console.log('✅ Token verified:', tokenData);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await redis.set(`session:${sessionToken}`, JSON.stringify({
      email: tokenData.email,
      user_id: tokenData.user_id
    }), 'EX', 30 * 24 * 60 * 60);

    console.log('✅ Session token created:', sessionToken);

    await supabase
      .from('magic_tokens')
      .delete()
      .eq('token', token);

      res.setHeader('Set-Cookie', [
        `auth-token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=None; Secure`
      ]);


    console.log('✅ Cookie set, redirecting');
    res.redirect(302, `/${tokenData.user_id}`);
    return;

  } catch (error) {
    console.error('Verify error:', error);
    console.log('❌ REDIRECTING TO LOGIN-FAILED FROM CATCH BLOCK');
    res.redirect(302, '/?error=login-failed');
    return;
  }
}
