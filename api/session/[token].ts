// pages/api/session/[token].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    query: { token },
  } = req;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid session token' });
  }

  try {
    // Fetch CV data for the given session token
    const { data: cvData, error: cvError } = await supabase
      .from('cv_data')
      .select('cv_file_url, cv_data')
      .eq('session_token', token)
      .single();

    if (cvError || !cvData) {
      console.error(cvError);
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch token count from 'users' table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tokens')
      .eq('session_token', token)
      .single();

    if (userError || !userData) {
      console.error(userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Return session data
    return res.status(200).json({
      cvFileUrl: cvData.cv_file_url,
      cvData: cvData.cv_data,
      tokens: userData.tokens,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
