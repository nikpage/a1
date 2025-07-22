// pages/api/auth/verify.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

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
      return res.status(400).json({ error: 'invalid-token' });
    }

    console.log('✅ Token verified:', tokenData);

    const sessionToken = jwt.sign(
      {
        email: tokenData.email,
        user_id: tokenData.user_id
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Session token created:', sessionToken);

    await supabase
      .from('magic_tokens')
      .delete()
      .eq('token', token);

    res.setHeader('Set-Cookie', [
      `auth-token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Strict`
    ]);

    console.log('✅ Cookie set, redirecting');
    return res.status(200).json({ redirect: `/${tokenData.user_id}` });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'login-failed' });
  }
}
