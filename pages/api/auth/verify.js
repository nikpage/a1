// pages/api/auth/verify.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimiter from '../../../lib/rateLimiter';
import originCheck from '../../../lib/originCheck';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (!originCheck(req, res)) return;
  if (!rateLimiter(req, res)) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const { data: tokenData, error: tokenError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      console.error('Token error:', tokenError, 'tokenData:', tokenData, 'token:', token);
      return res.status(401).json({ error: 'Invalid token', debug: { tokenError, tokenData, token } });
    }

    // Log what we're about to query for user
    console.log('Looking up user with:', {
      user_id: tokenData.user_id,
      email: tokenData.email
    });

    // Try strict match: user_id AND email
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, email')
      .eq('user_id', tokenData.user_id)
      .eq('email', tokenData.email)
      .single();

    if (userError || !user) {
      console.warn('Strict user lookup failed:', { userError, user, tokenData });

      // Fallback: try by user_id only
      const { data: fallbackUser, error: fallbackError } = await supabase
        .from('users')
        .select('user_id, email')
        .eq('user_id', tokenData.user_id)
        .maybeSingle();

      if (fallbackError || !fallbackUser) {
        console.error('User fallback lookup failed:', { fallbackError, fallbackUser, tokenData });
        return res.status(401).json({
          error: 'Account not found',
          debug: {
            userError,
            fallbackError,
            tokenData,
            tried_user_id: tokenData.user_id,
            tried_email: tokenData.email
          }
        });
      }

      user = fallbackUser;
      console.log('User found by user_id only:', user);
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('magic_tokens')
      .update({ used: true })
      .eq('token', token);

    if (updateError) {
      console.error('Failed to mark token as used:', updateError);
      // Don't block login, just log
    }

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
    return res.status(200).json({ redirect: `/${user.user_id}` });

  } catch (error) {
    console.error('Verification process error:', error);
    return res.status(500).json({ error: 'Login failed', debug: error?.message || error });
  }
}
