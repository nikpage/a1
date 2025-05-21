// pages/api/users.js
import { v4 as uuidv4 } from 'uuid';
import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Create a new user secret for dashboard access
    const secret = uuidv4();
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({ secret })
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: error.message });
      }

      // Return the generated secret and user ID
      return res.status(200).json({ userId: data.id, secret: data.secret });
    } catch (err) {
      console.error('Unexpected error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
    // Retrieve user data by secret
    const { secret } = req.query;
    if (!secret) {
      return res.status(400).json({ error: 'Secret parameter is required' });
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, tokens, secret')
        .eq('secret', secret)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Unexpected error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
