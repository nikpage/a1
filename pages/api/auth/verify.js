//api/auth/verify.js

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  console.log('=== VERIFY ENDPOINT START ===');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Timestamp:', new Date().toISOString());

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  console.log('Token received:', token);

  try {
    // First, let's see ALL tokens with this value (without any filters)
    const { data: unusedTokens, error: unusedError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString());

    if (unusedError || !unusedTokens || unusedTokens.length === 0) {
      console.error('Token error:', unusedError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const tokenData = unusedTokens[0];
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, email')
      .eq('user_id', tokenData.user_id)
      .eq('email', tokenData.email)
      .single();

    if (userError || !user) {
      console.error('User error:', userError);
      return res.status(401).json({ error: 'Account not found' });
    }

    await supabase
      .from('magic_tokens')
      .update({ used: true })
      .eq('token', token);
    // Create session token
    const sessionToken = jwt.sign(
      {
        email: user.email,
        user_id: user.user_id,
        session_id: crypto.randomBytes(16).toString('hex')
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieString = `auth-token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure; Domain=thecv.pro' : ''}`;

    res.setHeader('Set-Cookie', cookieString);

    console.log('✅ Login successful, redirecting to:', `/${user.user_id}`);
    return res.status(200).json({ redirect: `/${user.user_id}` });

  } catch (error) {
    console.error('❌ Verification process error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}
