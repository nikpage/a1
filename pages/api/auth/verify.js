import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    // 1. Verify token exists and is valid
    const { data: tokenData, error: tokenError } = await supabase
      .from('magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) return res.status(401).json({ error: 'Invalid token' });

    // 2. Verify email-user association exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', tokenData.user_id)
      .eq('email', tokenData.email)
      .single();

    if (userError || !user) return res.status(401).json({ error: 'Account not found' });

    // 3. Mark token as used
    await supabase
      .from('magic_tokens')
      .update({ used: true })
      .eq('token', token);

    // 4. Create session
    const sessionToken = jwt.sign(
      {
        email: user.email,
        user_id: user.id,
        session_id: crypto.randomBytes(16).toString('hex') // Extra security
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 5. Set secure cookie
    res.setHeader('Set-Cookie', [
      `auth-token=${sessionToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Domain=thecv.pro' : ''}`
    ]);

    return res.status(200).json({ redirect: `/${user.id}` });

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}
