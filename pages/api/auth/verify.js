//api/auth/verify.js
console.log('VERIFY HANDLER CALLED - token:', req.query.token);

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
    // Find unused token that hasn't expired (48 hours)
    console.log('--- VERIFY DEBUG LOG START ---');
console.log('Token received:', `"${token}"`, 'Length:', token?.length);
console.log('Current UTC time:', new Date().toISOString());

const { data: checkTokens, error: checkError } = await supabase
  .from('magic_tokens')
  .select('*')
  .eq('token', token);

console.log('Tokens found ignoring filters:', checkTokens);
console.log('Error (if any) on check query:', checkError);
console.log('--- VERIFY DEBUG LOG END ---');

    const { data: tokenData, error: tokenError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .limit(1);
      if (tokenError || !tokenData) {
        console.error('Token not found or expired:', tokenError);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, email')
      .eq('user_id', tokenData.user_id)
      .eq('email', tokenData.email)
      .limit(1);
    if (userError || !user) {
      console.error('User not found:', userError);
      return res.status(401).json({ error: 'Account not found' });
    }

    // Mark token as used
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
