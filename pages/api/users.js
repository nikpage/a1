// pages/api/users.js
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const secret = uuidv4();
    try {
      console.log('Attempting to insert user with secret:', secret);
      const { data, error } = await supabase
        .from('users')
        .insert({ secret })
        .select('id, secret')
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message, details: error });
      }

      console.log('Supabase response:', data);
      return res.status(200).json({ userId: data.id, secret: data.secret });
    } catch (err) {
      console.error('Unexpected error:', err.message, err.stack);
      return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  }

  if (req.method === 'GET') {
    const { secret } = req.query;
    if (!secret) {
      return res.status(400).json({ error: 'Secret parameter is required' });
    }

    try {
      console.log('Fetching user with secret:', secret);
      const result = await supabase
        .from('users')
        .select('id, email, token_balance, secret')
        .eq('secret', secret);

      if (result.error || !result.data || result.data.length !== 1) {
        console.error('Supabase error:', result.error || 'User not found');
        return res.status(404).json({ error: 'User not found', details: result.error });
      }

      const data = result.data[0];
      return res.status(200).json(data);
    } catch (err) {
      console.error('Unexpected error:', err.message, err.stack);
      return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  }

  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
