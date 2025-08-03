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
    const { data: allTokens, error: allTokensError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token);

    console.log('All tokens query error:', allTokensError);
    console.log('All tokens found:', allTokens?.length || 0);
    console.log('All tokens data:', JSON.stringify(allTokens, null, 2));

    // Now try with just the 'used' filter
    const { data: unusedTokens, error: unusedError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false);

    console.log('Unused tokens query error:', unusedError);
    console.log('Unused tokens found:', unusedTokens?.length || 0);
    console.log('Unused tokens data:', JSON.stringify(unusedTokens, null, 2));

    // Check if we have exactly one unused token
    if (!unusedTokens || unusedTokens.length === 0) {
      console.log('❌ No unused tokens found');
      return res.status(401).json({ error: 'Invalid or used token' });
    }

    if (unusedTokens.length > 1) {
      console.log('❌ Multiple unused tokens found - this shouldn\'t happen');
      return res.status(401).json({ error: 'Token conflict' });
    }

    const tokenData = unusedTokens[0];
    console.log('✅ Found valid unused token');

    // Now check expiration manually
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    const isExpired = now > expiresAt;

    console.log('Time comparison:', {
      now_iso: now.toISOString(),
      expires_at_iso: tokenData.expires_at,
      now_timestamp: now.getTime(),
      expires_timestamp: expiresAt.getTime(),
      difference_minutes: (expiresAt.getTime() - now.getTime()) / (1000 * 60),
      is_expired: isExpired
    });

    if (isExpired) {
      console.log('❌ Token is expired');
      return res.status(401).json({ error: 'Token expired' });
    }

    // Token is valid, proceed with user lookup
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

    console.log('✅ User found:', user.email);

    // Mark token as used
    const { error: updateError } = await supabase
      .from('magic_tokens')
      .update({ used: true })
      .eq('token', token);

    if (updateError) {
      console.error('Error marking token as used:', updateError);
    }

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
