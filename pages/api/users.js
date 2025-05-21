// pages/api/users.js
import { supabase } from '../../lib/supabase';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // generate a secret for the “secret-URL” login
    const secret = randomUUID();
    const { data, error } = await supabase
      .from('users')
      .insert({ secret })
      .select('id, secret')
      .single();

    if (error) throw error;

    res.status(200).json({
      userId: data.id,
      secret: data.secret,
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: error.message });
  }
}
